import { useState } from 'react'
import { ArrowUpRight, Check } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import type { PlatformRole } from '../../types'
import { useAuth } from '../../context/AuthContext'

export interface AuthPageProps {
  mode: 'login' | 'register' | 'forgot' | 'reset' | 'verify'
}

export function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate()
  const { login, register, demoLogin } = useAuth()
  const [searchParams] = useSearchParams()
  const [submitted, setSubmitted] = useState(false)
  const [role, setRole] = useState<PlatformRole>('TRAVELER')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(searchParams.get('token') || '')
  const [resetInfo, setResetInfo] = useState<{ resetToken?: string; resetLink?: string } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const copy = {
    login: ['Welcome back', 'Sign in to continue your journey.'],
    register: ['Create your account', 'A more thoughtful way to travel starts here.'],
    forgot: ['Find your way back', 'Enter your email and we’ll send a reset token.'],
    reset: ['Choose a new password', 'Keep your account safe with a strong password.'],
    verify: ['Check your inbox', 'We sent a verification link to your email.'],
  }[mode]

  const quickLogin = async (targetRole: PlatformRole) => {
    setError('')
    setLoading(true)
    try {
      const loggedUser = await demoLogin(targetRole)
      navigate({ TRAVELER: '/dashboard', TOUR_PLANNER: '/planner/dashboard', ADMIN: '/admin/dashboard' }[loggedUser.role])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const loggedUser = await login(email, password)
        navigate({ TRAVELER: '/dashboard', TOUR_PLANNER: '/planner/dashboard', ADMIN: '/admin/dashboard' }[loggedUser.role])
      } else if (mode === 'register') {
        const loggedUser = await register(name, email, password, role)
        navigate({ TRAVELER: '/dashboard', TOUR_PLANNER: '/planner/dashboard', ADMIN: '/admin/dashboard' }[loggedUser.role])
      } else if (mode === 'forgot') {
        const result = await api<{ success: boolean; message: string; resetToken?: string; resetLink?: string }>('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        })
        setSubmitted(true)
        setResetInfo(result)
      } else if (mode === 'reset') {
        await api('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token, password }),
        })
        setSubmitted(true)
      } else if (mode === 'verify') {
        await api('/api/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token }),
        })
        setSubmitted(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed')
    } finally {
      setLoading(false)
    }
  }

  if (submitted && mode === 'reset') {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="brand auth-brand"><span className="brand-mark">p</span><span>porikroma</span></div>
          <div className="modal-icon"><Check size={22} /></div>
          <h1>Password reset complete</h1>
          <p>Your password has been securely updated. You can now log in.</p>
          <button className="primary-btn auth-submit" onClick={() => navigate('/login')}>Proceed to login <ArrowUpRight size={16} /></button>
        </div>
      </main>
    )
  }

  if (submitted && mode === 'forgot') {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="brand auth-brand"><span className="brand-mark">p</span><span>porikroma</span></div>
          <div className="modal-icon"><Check size={22} /></div>
          <h1>Reset token ready</h1>
          <p>A password reset token was generated for your email.</p>
          {resetInfo?.resetToken && (
            <div style={{ background: '#f3f6f1', padding: '12px', borderRadius: '8px', margin: '14px 0', fontSize: '13px', wordBreak: 'break-all' }}>
              <strong>Reset Token:</strong>
              <p style={{ marginTop: '4px', color: '#334f3b' }}>{resetInfo.resetToken}</p>
            </div>
          )}
          {resetInfo?.resetLink && (
            <Link className="primary-btn auth-submit" to={resetInfo.resetLink} style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              Reset password now <ArrowUpRight size={16} />
            </Link>
          )}
          <button className="outline-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/login')}>Back to login</button>
        </div>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="brand auth-brand"><span className="brand-mark">p</span><span>porikroma</span></div>
        <p className="eyebrow">Your journey, thoughtfully planned</p>
        <h1>{copy[0]}</h1>
        <p className="auth-description">{copy[1]}</p>

        {mode === 'login' && (
          <div style={{ background: '#f0f4ee', border: '1px solid #d5dfd1', padding: '12px', borderRadius: '9px', marginBottom: '18px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#2d4234', display: 'block', marginBottom: '8px' }}>
              Quick One-Click Test Accounts:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              <button type="button" className="outline-btn small" onClick={() => quickLogin('TRAVELER')} style={{ justifyContent: 'center' }}>Traveler</button>
              <button type="button" className="outline-btn small" onClick={() => quickLogin('TOUR_PLANNER')} style={{ justifyContent: 'center' }}>Tour Planner</button>
              <button type="button" className="outline-btn small" onClick={() => quickLogin('ADMIN')} style={{ justifyContent: 'center' }}>Admin</button>
            </div>
          </div>
        )}

        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label>Full name<input required placeholder="Rafi Ahmed" value={name} onChange={(e) => setName(e.target.value)} /></label>
              <label>I want to join as<select value={role} onChange={(e) => setRole(e.target.value as PlatformRole)}><option value="TRAVELER">Traveler</option><option value="TOUR_PLANNER">Tour planner / Expedition host</option></select></label>
            </>
          )}
          {mode === 'reset' && (
            <label>Reset token<input required placeholder="Paste token here" value={token} onChange={(e) => setToken(e.target.value)} /></label>
          )}
          {mode !== 'reset' && (
            <label>Email address<input required type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          )}
          {(mode === 'login' || mode === 'register' || mode === 'reset') && (
            <label>Password<input required minLength={6} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          )}

          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn auth-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Submit'} <ArrowUpRight size={16} />
          </button>
        </form>

        {mode === 'login' ? (
          <>
            <Link className="auth-link" to="/forgot-password">Forgot password?</Link>
            <p className="auth-footer">New to Porikroma? <Link to="/register">Create an account</Link></p>
          </>
        ) : mode === 'register' ? (
          <p className="auth-footer">Already have an account? <Link to="/login">Log in</Link></p>
        ) : (
          <p className="auth-footer"><Link to="/login">Back to login</Link></p>
        )}
      </div>
      <div className="auth-art">
        <span>Go where the<br /><em>air feels different.</em></span>
      </div>
    </main>
  )
}

export default AuthPage
