import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { setToken } from '../auth';

interface Props {
  onAuthenticated: () => void;
}

type Step = 'email' | 'pin';

export default function OTPLogin({ onAuthenticated }: Props) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devMode, setDevMode] = useState(false);

  async function requestPin() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send PIN');
      setDevMode(data.devMode === true);
      setStep('pin');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function verifyPin() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setToken(data.token);
      onAuthenticated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#f5f5f5',
      }}
    >
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 380 }}>
        <Typography variant="h5" fontWeight={700} mb={0.5}>
          Sign in
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          {step === 'email'
            ? 'Enter your email to receive a one-time PIN.'
            : `Enter the 6-digit PIN sent to ${email}.`}
        </Typography>

        {step === 'email' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Access is limited to emails listed in <code>OTP_ALLOWED_EMAILS</code>.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {devMode && step === 'pin' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Dev mode: PIN is printed in the server console (no SMTP configured).
          </Alert>
        )}

        {step === 'email' ? (
          <>
            <TextField
              label="Email address"
              type="email"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && email && requestPin()}
              autoFocus
              sx={{ mb: 2 }}
            />
            <Button
              variant="contained"
              fullWidth
              size="large"
              disabled={!email || loading}
              onClick={requestPin}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Send PIN'}
            </Button>
          </>
        ) : (
          <>
            <TextField
              label="6-digit PIN"
              type="text"
              inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
              fullWidth
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && pin.length === 6 && verifyPin()}
              autoFocus
              sx={{ mb: 2 }}
            />
            <Button
              variant="contained"
              fullWidth
              size="large"
              disabled={pin.length !== 6 || loading}
              onClick={verifyPin}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Verify PIN'}
            </Button>
            <Button
              fullWidth
              size="small"
              sx={{ mt: 1 }}
              onClick={() => { setStep('email'); setPin(''); setError(''); }}
            >
              Use a different email
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
}
