import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

const PACE_OPTIONS = [
  { days: 30, label: 'Intensive', desc: '1 lesson/day' },
  { days: 45, label: 'Steady', desc: '~3 lessons/2 days' },
  { days: 60, label: 'Relaxed', desc: '~1 lesson/2 days' },
  { days: 90, label: 'Casual', desc: '~1 lesson/3 days' },
];

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [planLengthDays, setPlan] = useState(30);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (mode === 'register') {
        await register({ email, password, displayName, planLengthDays });
      } else {
        await login(email, password);
      }
      navigate('/app');
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="card card-pad-lg auth-card">
        <Link to="/" className="brand" style={{ marginBottom: 18, display: 'inline-flex' }}>
          <Logo size={32} />
        </Link>
        <h1 className="auth-title">{mode === 'register' ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-sub">
          {mode === 'register'
            ? 'Set your pace and start learning Swahili today.'
            : 'Log in to continue your Swahili journey.'}
        </p>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="field">
              <label>Display name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Amani" />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} required
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} required minLength={6}
              onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>

          {mode === 'register' && (
            <div className="field">
              <label>Choose your pace (you can change this later)</label>
              <div className="pace-options">
                {PACE_OPTIONS.map((p) => (
                  <div key={p.days}
                    className={`pace-opt ${planLengthDays === p.days ? 'active' : ''}`}
                    onClick={() => setPlan(p.days)}>
                    <div className="n">{p.days}</div>
                    <div className="d"><strong>{p.label}</strong><br />{p.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="btn btn-primary btn-block mt" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Log in'}
          </button>
        </form>

        <div className="switch-link">
          {mode === 'register' ? (
            <>Already have an account?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setError(''); }}>Log in</a>
            </>
          ) : (
            <>New here?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('register'); setError(''); }}>Create an account</a>
            </>
          )}
        </div>

        <div className="switch-link" style={{ marginTop: 10 }}>
          <Link to="/">← Back to polepole.com</Link>
        </div>
      </div>
    </div>
  );
}
