
Start the tunnel manually so its routes can find there way here. 
> cloudflared tunnel run mytunnel

Then start dev servers.
> npm run dev

Look here to hit my routes... may need to get a pin.
https://dash.cloudflare.com/03c2a5c7efdf0177ea4c6b51151e9d39/tunnels/c1009c82-a25c-4a14-a868-9bb5243cc991/routes

PIN (one-time code)
The PIN is valid for 10 minutes (OTP_EXPIRY_MS = 10 * 60 * 1000 in server/storage-api.js). After that you must request a new PIN.

Logged-in session (after you verify the PIN)
After a successful verify, the app gets a JWT whose lifetime is JWT_EXPIRES_IN, defaulting to 8 hours if the env var isn’t set:

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const OTP_EXPIRY_MS = 10 * 60 * 1000;
So under defaults you stay signed in for 8 hours without entering a new PIN; when the JWT expires, the API returns 401 and you’d need to log in again (new PIN). You can change session length by setting JWT_EXPIRES_IN (e.g. 24h, 7d) in your environment.

