import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale, COURSE_FOR_LOCALE, courseTaughtIn } from '../context/LocaleContext';
import { api } from '../api/client';
import Logo from '../components/Logo';

const PACE_DAYS = [30, 45, 60, 90];

export default function AuthPage() {
  const { login, register } = useAuth();
  const { locale, t } = useLocale();
  const navigate = useNavigate();
  const [mode, setMode] = useState('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [planLengthDays, setPlan] = useState(30);
  const [allCourses, setAllCourses] = useState([]);
  const [picked, setPicked] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // An account is tied to one direction, so the choice is made here at sign-up.
  useEffect(() => {
    api.listCourses().then((d) => setAllCourses(d.courses || [])).catch(() => {});
  }, []);

  // Only the courses taught in the reader's language: a lesson is written in
  // its course's teaching language, so any other would be unreadable to them.
  const courses = allCourses.filter((c) => courseTaughtIn(c, locale));
  const courseId = courses.some((c) => c.id === picked)
    ? picked
    : (courses.find((c) => c.id === COURSE_FOR_LOCALE[locale]) ?? courses[0])?.id ?? COURSE_FOR_LOCALE[locale];

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (mode === 'register') {
        await register({ email, password, displayName, planLengthDays, courseId });
      } else {
        await login(email, password);
      }
      navigate('/app');
    } catch (err) {
      setError(err.message || t.common.somethingWrong);
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
        <h1 className="auth-title">{mode === 'register' ? t.auth.createTitle : t.auth.welcomeBack}</h1>
        <p className="auth-sub">{mode === 'register' ? t.auth.createSub : t.auth.loginSub}</p>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={submit}>
          {mode === 'register' && courses.length > 1 && (
            <div className="field">
              <label>{t.auth.whatLearn}</label>
              <div className="course-options">
                {courses.map((c) => (
                  <div key={c.id}
                    className={`course-opt ${courseId === c.id ? 'active' : ''}`}
                    onClick={() => setPicked(c.id)}>
                    <span className="course-flag">{c.flag}</span>
                    <span className="course-text">
                      <strong>{c.title}</strong>
                      <span className="course-sub">{c.subtitle}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {mode === 'register' && (
            <div className="field">
              <label>{t.common.displayName}</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t.common.namePlaceholder} />
            </div>
          )}
          <div className="field">
            <label>{t.common.email}</label>
            <input type="email" value={email} required
              onChange={(e) => setEmail(e.target.value)} placeholder={t.common.emailPlaceholder} />
          </div>
          <div className="field">
            <label>{t.common.password}</label>
            <input type="password" value={password} required minLength={6}
              onChange={(e) => setPassword(e.target.value)} placeholder={t.common.passwordPlaceholder} />
          </div>

          {mode === 'register' && (
            <div className="field">
              <label>{t.auth.paceLabel}</label>
              <div className="pace-options">
                {PACE_DAYS.map((days) => (
                  <div key={days}
                    className={`pace-opt ${planLengthDays === days ? 'active' : ''}`}
                    onClick={() => setPlan(days)}>
                    <div className="n">{days}</div>
                    <div className="d"><strong>{t.pace[days].label}</strong><br />{t.pace[days].desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="btn btn-primary btn-block mt" disabled={busy}>
            {busy ? t.common.pleaseWait : mode === 'register' ? t.common.createAccount : t.common.login}
          </button>
        </form>

        <div className="switch-link">
          {mode === 'register' ? (
            <>{t.common.haveAccount}{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setError(''); }}>{t.common.login}</a>
            </>
          ) : (
            <>{t.auth.newHere}{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('register'); setError(''); }}>{t.auth.createAnAccount}</a>
            </>
          )}
        </div>

        <div className="switch-link" style={{ marginTop: 10 }}>
          <Link to="/">{t.auth.backHome}</Link>
        </div>
      </div>
    </div>
  );
}
