import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale, COURSE_FOR_LOCALE } from '../context/LocaleContext';
import Logo from '../components/Logo';
import SpeakButton from '../components/SpeakButton';
import { setSpeechCourse } from '../lib/speak';
import { askNotificationPermission, notificationsSupported } from '../lib/reminders';

// The first thing a visitor does: three words, before any account exists.
//
// Sign-up used to come first — direction, name, email, password and a plan
// length, all asked before the learner had been given anything. This page
// turns that round, in the order the design sets out:
//
//   three items → the reward (a score and a proverb)
//     → "keep your progress?" → the account
//     → "when should I remind you?" → the reminder
//     → "what's your why?"
//
// Every ask comes after something was given, and the last two can be skipped.
//
// See docs/DAILY-PRACTICE-LOOP.md, "Reminder time and your why".

const WHYS = [
  { id: 'trip', icon: '✈️' },
  { id: 'family', icon: '👪' },
  { id: 'work', icon: '💼' },
  { id: 'curiosity', icon: '✨' },
];

function deviceTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
}

export default function TasterPage() {
  const { user, register, setUser } = useAuth();
  const navigate = useNavigate();

  // Someone already signed in has no use for the taster — but only checked on
  // arrival, because this page deliberately keeps going after sign-up.
  const arrivedSignedIn = useRef(!!user);

  // The course taught in the reader's language: three words of English for
  // a Swahili reader, of Swahili for everyone else.
  const { locale, t: all } = useLocale();
  const t = all.taster;
  const course = COURSE_FOR_LOCALE[locale];
  const [taster, setTaster] = useState(null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState('items'); // items | reward | account | reminder | why
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null);
  const [answers, setAnswers] = useState([]); // { itemKey, exercise, answer, correct }

  useEffect(() => {
    if (arrivedSignedIn.current) return;
    setTaster(null); setFailed(false);
    setStep('items'); setIdx(0); setPicked(null); setResult(null); setAnswers([]);
    api.taster(course)
      .then((t) => {
        setTaster(t);
        // Point the 🔊 button at the language being learned, as signing in
        // would — there is no account yet to do it.
        setSpeechCourse(course === 'en'
          ? { id: 'en', targetLanguage: 'en', ttsLocale: 'en-US' }
          : { id: course, targetLanguage: 'sw', ttsLocale: 'sw-KE' });
      })
      .catch(() => setFailed(true));
  }, [course]);

  if (arrivedSignedIn.current) return <Navigate to="/app" replace />;

  const shell = (children) => (
    <div className="auth-wrap">
      <div className="card card-pad-lg auth-card taster-card">
        <div className="row spread" style={{ marginBottom: 14 }}>
          <Link to="/" className="brand"><Logo size={30} /></Link>
          {step === 'items' && <Link to="/login" className="muted taster-login">{all.common.login}</Link>}
        </div>
        {children}
      </div>
    </div>
  );

  if (failed) return shell(<p>{t.loadFailed} <Link to="/login">{t.createInstead}</Link>.</p>);
  if (!taster) return shell(<div className="spinner" />);
  if (!taster.items.length) return shell(<p>{t.nothingYet} <Link to="/login">{all.auth.createAnAccount}</Link>.</p>);

  const items = taster.items;
  const item = items[idx];

  const choose = async (opt) => {
    if (result || picked) return;
    setPicked(opt);
    try {
      const res = await api.answerTaster({ course, itemKey: item.itemKey, exercise: item.exercise, answer: opt });
      setResult(res);
      setAnswers((a) => [...a, { itemKey: item.itemKey, exercise: item.exercise, answer: opt, correct: res.correct }]);
    } catch {
      setPicked(null);
    }
  };

  const next = () => {
    setPicked(null); setResult(null);
    if (idx + 1 < items.length) setIdx(idx + 1);
    else setStep('reward');
  };

  if (step === 'items') {
    return shell(
      <>
        <div className="dose-kicker">{t.kicker}</div>
        <div className="sb-progress">
          {items.map((_, i) => (
            <span key={i} className={`sb-dot ${i < idx ? 'done' : ''} ${i === idx ? 'active' : ''}`} />
          ))}
          <span className="sb-count">{idx + 1} / {items.length}</span>
        </div>

        <div className="dose-label">{all.exercise[item.exercise]}</div>
        <div className="dose-prompt">
          <span>{item.prompt}</span>
          {item.exercise === 'tambua' && <SpeakButton text={item.prompt} />}
        </div>

        <div>
          {item.options.map((opt) => {
            const isPicked = picked === opt;
            const isAnswer = result && opt === result.correctAnswer;
            const cls = !result
              ? (isPicked ? 'option selected' : 'option')
              : isAnswer ? 'option dose-right' : isPicked ? 'option dose-wrong' : 'option dose-dim';
            return (
              <button key={opt} className={cls} onClick={() => choose(opt)} disabled={!!result || !!picked}>
                {opt}
              </button>
            );
          })}
        </div>

        {result && (
          <div className="dose-feedback">
            <div className={result.correct ? 'feedback-correct' : 'feedback-wrong'}>
              {result.correct ? all.common.right : all.common.itIs(result.correctAnswer)}
            </div>
            <div className="row center mt">
              <button className="btn btn-gold" onClick={next} autoFocus>
                {idx + 1 < items.length ? all.common.next : all.common.finish}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (step === 'reward') {
    const right = answers.filter((a) => a.correct).length;
    return shell(
      <div style={{ textAlign: 'center' }}>
        <div className="dose-kicker">{t.thatsADose}</div>
        <div className="result-score">{right}/{answers.length}</div>
        <p className="muted">
          {t.reward}
        </p>

        {taster.methali && (
          <div className="dose-methali taster-methali">
            <div className="dose-label">{t.oneToKeep}</div>
            <div className="dose-methali-text">
              <span>{taster.methali.target}</span>
              <SpeakButton text={taster.methali.target} />
            </div>
            <div className="dose-methali-gloss">{taster.methali.source}</div>
            {taster.methali.note && <div className="dose-methali-note">{taster.methali.note}</div>}
          </div>
        )}

        <div className="row center mt">
          <button className="btn btn-gold" onClick={() => setStep('account')} autoFocus>{t.keepProgressCta}</button>
        </div>
        <p className="muted taster-switch">
          {t.keepNote}
        </p>
      </div>
    );
  }

  if (step === 'account') {
    return shell(
      <AccountStep
        onSubmit={async (form) => {
          await register({
            ...form,
            planLengthDays: 30,
            courseId: course,
            // Replayed and re-graded by the server, so the cards it creates
            // are the ones these answers earned.
            tasterAnswers: answers.map(({ itemKey, exercise, answer }) => ({ itemKey, exercise, answer })),
          });
          setStep('reminder');
        }}
      />
    );
  }

  if (step === 'reminder') {
    return shell(<ReminderStep onDone={(u) => { if (u) setUser(u); setStep('why'); }} />);
  }

  return shell(<WhyStep onDone={(u) => { if (u) setUser(u); navigate('/app'); }} />);
}

function AccountStep({ onSubmit }) {
  const { t: all } = useLocale();
  const t = all.taster;
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await onSubmit({ displayName, email, password });
    } catch (err) {
      setError(err.message || all.common.somethingWrong);
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="auth-title">{t.accountTitle}</h1>
      <p className="auth-sub">{t.accountSub}</p>
      {error && <div className="error-box">{error}</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label>{all.common.displayName}</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={all.common.namePlaceholder} />
        </div>
        <div className="field">
          <label>{all.common.email}</label>
          <input type="email" value={email} required autoComplete="email"
            onChange={(e) => setEmail(e.target.value)} placeholder={all.common.emailPlaceholder} />
        </div>
        <div className="field">
          <label>{all.common.password}</label>
          <input type="password" value={password} required minLength={6} autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)} placeholder={all.common.passwordPlaceholder} />
        </div>
        <button className="btn btn-primary btn-block mt" disabled={busy}>
          {busy ? all.common.pleaseWait : all.common.createAccount}
        </button>
      </form>
      <div className="switch-link">
        {all.common.haveAccount} <Link to="/login">{all.common.login}</Link>
      </div>
    </>
  );
}

function ReminderStep({ onDone }) {
  const { t: all } = useLocale();
  const t = all.taster;
  const r = all.reminder;
  const [time, setTime] = useState('08:00');
  const [busy, setBusy] = useState(false);

  const save = async (enabled) => {
    setBusy(true);
    try {
      // Asked from this click, which is the only place a browser will honour
      // it — but not waited for. The prompt can sit unanswered indefinitely,
      // and onboarding must not sit there with it.
      if (enabled) askNotificationPermission();
      const tz = deviceTimeZone();
      const payload = enabled ? { enabled: true, localTime: time } : { enabled: false };
      if (tz) payload.timeZoneId = tz;
      onDone(await api.updateReminders(payload));
    } catch {
      onDone(null); // never trap someone in onboarding over a reminder
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <h1 className="auth-title">{t.reminderTitle}</h1>
      <p className="auth-sub">{t.reminderSub}</p>
      <input className="taster-time" type="time" value={time} onChange={(e) => setTime(e.target.value || '08:00')} aria-label={r.timeLabel} />
      <p className="muted taster-note">
        {notificationsSupported()
          ? r.tabOnly
          : r.unsupported}
      </p>
      <div className="row center mt" style={{ gap: 10 }}>
        <button className="btn btn-primary" onClick={() => save(true)} disabled={busy}>{r.remindMe}</button>
        <button className="btn btn-ghost btn-sm" onClick={() => save(false)} disabled={busy}>{t.noReminders}</button>
      </div>
    </div>
  );
}

function WhyStep({ onDone }) {
  const { t: all } = useLocale();
  const t = all.taster;
  const [busy, setBusy] = useState(false);

  const pick = async (why) => {
    setBusy(true);
    try {
      onDone(why ? await api.updateWhy(why) : null);
    } catch {
      onDone(null);
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <h1 className="auth-title">{t.whyTitle}</h1>
      <p className="auth-sub">{t.whySub}</p>
      <div className="why-options">
        {WHYS.map((w) => (
          <button key={w.id} className="why-opt" onClick={() => pick(w.id)} disabled={busy}>
            <span className="why-icon">{w.icon}</span>
            <span>{all.whys[w.id]}</span>
          </button>
        ))}
      </div>
      <div className="row center mt">
        <button className="btn btn-ghost btn-sm" onClick={() => pick(null)} disabled={busy}>{all.common.skip}</button>
      </div>
    </div>
  );
}
