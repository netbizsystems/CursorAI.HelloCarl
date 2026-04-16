import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import { BlobServiceClient } from '@azure/storage-blob';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';

/** Azure Storage account (e.g. hellocarl2026): Portal → Access keys → Connection string. */
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

/** Blob container; created if missing. */
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER || 'hellocarl-data';

// Distinct from template (HelloDave) default 3001 so both apps can run locally.
const PORT = process.env.STORAGE_API_PORT || 3020;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const OTP_EXPIRY_MS = 10 * 60 * 1000;

const app = express();
app.use(express.json());

// ── OTP store ────────────────────────────────────────────────────────────────
// email (lowercase) -> { pin, expiresAt }
const otpStore = new Map();

// ── Email ────────────────────────────────────────────────────────────────────
function createTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(authHeader.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── POST /api/auth/request ────────────────────────────────────────────────────
app.post('/api/auth/request', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const allowedEmails = process.env.OTP_ALLOWED_EMAILS;
  if (allowedEmails) {
    const allowed = allowedEmails.split(',').map((e) => e.trim().toLowerCase());
    if (!allowed.includes(email.toLowerCase())) {
      return res.status(403).json({ error: 'Email not authorized' });
    }
  }

  const pin = String(crypto.randomInt(100000, 999999));
  otpStore.set(email.toLowerCase(), { pin, expiresAt: Date.now() + OTP_EXPIRY_MS });

  const transporter = createTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Your One-Time PIN',
        text: `Your PIN is: ${pin}\n\nThis PIN expires in 10 minutes.`,
        html: `<div style="font-family:sans-serif;max-width:400px;margin:40px auto;padding:32px;border:1px solid #e0e0e0;border-radius:8px">
          <h2 style="margin:0 0 16px">Your One-Time PIN</h2>
          <p style="font-size:36px;font-weight:700;letter-spacing:8px;margin:24px 0;color:#1976d2">${pin}</p>
          <p style="color:#666;font-size:14px">This PIN expires in 10 minutes. Do not share it.</p>
        </div>`,
      });
    } catch (err) {
      console.error('Failed to send email:', err.message);
      return res.status(500).json({ error: 'Failed to send email' });
    }
  } else {
    console.log(`\n[OTP DEV MODE] PIN for ${email}: ${pin}\n`);
  }

  res.json({ sent: true, devMode: !transporter });
});

// ── POST /api/auth/verify ─────────────────────────────────────────────────────
app.post('/api/auth/verify', (req, res) => {
  const { email, pin } = req.body;
  if (!email || !pin) {
    return res.status(400).json({ error: 'Email and PIN required' });
  }

  const stored = otpStore.get(email.toLowerCase());
  if (!stored) {
    return res.status(401).json({ error: 'No PIN requested for this email' });
  }
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return res.status(401).json({ error: 'PIN expired — request a new one' });
  }
  if (stored.pin !== String(pin)) {
    return res.status(401).json({ error: 'Incorrect PIN' });
  }

  otpStore.delete(email.toLowerCase());
  const token = jwt.sign({ email: email.toLowerCase() }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token });
});

// ── Storage routes (all require auth) ────────────────────────────────────────
let blobServiceClient;
let containerClient;

async function ensureContainer() {
  if (!blobServiceClient) {
    if (!AZURE_STORAGE_CONNECTION_STRING) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
    }
    blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    await containerClient.createIfNotExists();
  }
  return containerClient;
}

/** No auth — verifies the API process can reach Azure Blob storage. */
app.get('/api/health/storage', async (req, res) => {
  try {
    const container = await ensureContainer();
    await container.getProperties();
    res.json({
      ok: true,
      container: CONTAINER_NAME,
      emulator: false,
    });
  } catch (err) {
    console.error('Storage health check failed:', err);
    res.status(503).json({
      ok: false,
      error: err.message || 'Storage unreachable',
    });
  }
});

app.get('/api/storage', requireAuth, async (req, res) => {
  try {
    const container = await ensureContainer();
    const keys = [];
    for await (const blob of container.listBlobsFlat()) {
      keys.push(blob.name);
    }
    return res.json(keys);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Storage error' });
  }
});

app.get('/api/storage/:key', requireAuth, async (req, res) => {
  try {
    const container = await ensureContainer();
    const blobClient = container.getBlockBlobClient(req.params.key);
    const exists = await blobClient.exists();
    if (!exists) return res.status(404).json({ error: 'Not found' });

    const download = await blobClient.download();
    const text = await streamToString(download.readableStreamBody);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Storage error' });
  }
});

app.post('/api/storage', requireAuth, async (req, res) => {
  try {
    const container = await ensureContainer();
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });

    const blobClient = container.getBlockBlobClient(key);
    const body = typeof value === 'string' ? value : JSON.stringify(value ?? '');
    await blobClient.upload(body, body.length, { blobHTTPHeaders: { blobContentType: 'application/json' } });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Storage error' });
  }
});

app.delete('/api/storage/:key', requireAuth, async (req, res) => {
  try {
    const container = await ensureContainer();
    const { key } = req.params;
    if (!key) return res.status(400).json({ error: 'key is required' });

    const blobClient = container.getBlockBlobClient(key);
    await blobClient.deleteIfExists();
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Storage error' });
  }
});

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

async function start() {
  if (!AZURE_STORAGE_CONNECTION_STRING) {
    console.error('Missing AZURE_STORAGE_CONNECTION_STRING (Azure Storage account connection string).');
    process.exit(1);
  }
  try {
    await ensureContainer();
  } catch (err) {
    console.error('Azure Storage init failed:', err.message);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`Storage API (Azure Blob, container "${CONTAINER_NAME}") at http://127.0.0.1:${PORT}/api/storage`);
  });
}

start();
