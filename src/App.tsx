import { useState, useEffect, useCallback } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import OTPLogin from './components/OTPLogin'
import { getToken, isTokenValid, clearToken, getTokenExpiryMs } from './auth'

/** Whole minutes until expiry (no seconds — matches once-per-minute UI updates). */
function formatSessionRemaining(ms: number): string {
  if (ms <= 0) return '0m'
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function useAuth() {
  const [authenticated, setAuthenticated] = useState(() => {
    const token = getToken()
    return token !== null && isTokenValid(token)
  })

  const onAuthenticated = useCallback(() => {
    setAuthenticated(true)
  }, [])

  const signOut = useCallback(() => {
    clearToken()
    setAuthenticated(false)
  }, [])

  return { authenticated, onAuthenticated, signOut }
}

function App() {
  const { authenticated, onAuthenticated, signOut } = useAuth()
  const [count, setCount] = useState(0)
  const [sessionRemaining, setSessionRemaining] = useState(() => {
    const exp = getTokenExpiryMs()
    return exp ? formatSessionRemaining(exp - Date.now()) : ''
  })

  useEffect(() => {
    if (!authenticated) return

    const exp = getTokenExpiryMs()
    if (exp == null) {
      signOut()
      return
    }
    const msUntilExpiry = exp - Date.now()
    if (msUntilExpiry <= 0) {
      signOut()
      return
    }

    const tick = () => {
      const e = getTokenExpiryMs()
      if (e == null) {
        signOut()
        return
      }
      const left = e - Date.now()
      if (left <= 0) {
        signOut()
        return
      }
      setSessionRemaining(formatSessionRemaining(left))
    }

    tick()
    const intervalId = window.setInterval(tick, 60_000)
    const expiryId = window.setTimeout(signOut, msUntilExpiry)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(expiryId)
    }
  }, [authenticated, signOut])

  if (!authenticated) {
    return <OTPLogin onAuthenticated={onAuthenticated} />
  }

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      <p className="tunnel-notice">
        Important: To access routes from netbizsystems.com, the Cloudflare tunnel must be running.
      </p>
      <div className="session-footer">
        <button type="button" onClick={signOut} className="sign-out-btn">
          Sign out
        </button>
        <span className="session-remaining" title="Time until you need to sign in again (JWT session)">
          Sign-in expires in {sessionRemaining}
        </span>
      </div>
    </>
  )
}

export default App
