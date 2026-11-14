import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { askNotificationPermission, notificationPermission, notificationsSupported } from '../lib/reminders';

const PACE_OPTIONS = [
  { days: 30, label: 'Intensive', desc: '1 lesson/day' },
  { days: 45, label: 'Steady', desc: '~3 lessons / 2 days' },
  { days: 60, label: 'Relaxed', desc: '~1 lesson / 2 days' },
  { days: 90, label: 'Casual', desc: '~1 lesson / 3 days' },
  { days: 180, label: 'Extended', desc: '~1 lesson / 6 days' },
];

export default function Settings() {
  const { user, setUser, refreshUser } = useAuth();
  const [plan, setPlan] = useState(user.planLengthDays);
  const [custom, setCustom] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true); setSaved(false);
    try {
      const value = custom ? parseInt(custom, 10) : plan;
      const updated = await api.updatePace(value);
      setUser(updated);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  const restart = async () => {
    if (!confirm('Restart the course? This resets your progress, XP, and streak. This cannot be undone.')) return;
    setBusy(true);
    try {
      const updated = await api.restart();
      setUser(updated);
      await refreshUser();
      alert('Course restarted. Karibu tena!');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page narrow">
      <div className="page-head">
        <h1>Settings</h1>
        <p>Your reminder, your pace, or a fresh start.</p>
      </div>

      <ReminderCard user={user} setUser={setUser} />

      <div className="card mb">
        <h2 className="block" style={{ fontSize: '1.1rem' }}>Your pace</h2>
        <p className="muted mb">
          You're currently on a <strong>{user.planLengthDays}-day</strong> plan. You can extend it anytime —
          lessons spread out across more days, but you can always study ahead once you pass each quiz.
        </p>
        <div className="pace-options">
          {PACE_OPTIONS.map((p) => (
            <div key={p.days}
              className={`pace-opt ${!custom && plan === p.days ? 'active' : ''}`}
              onClick={() => { setPlan(p.days); setCustom(''); setSaved(false); }}>
              <div className="n">{p.days}</div>
              <div className="d"><strong>{p.label}</strong><br />{p.desc}</div>
            </div>
          ))}
        </div>

        <div className="field mt">
          <label>Or a custom number of days (30–365)</label>
          <input type="number" min={30} max={365} value={custom}
            placeholder="e.g. 120"
            onChange={(e) => { setCustom(e.target.value); setSaved(false); }} />
        </div>

        <button className="btn btn-primary mt" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save pace'}
        </button>
        {saved && <span className="feedback-correct" style={{ marginLeft: 12 }}>✓ Saved!</span>}
      </div>

      <div className="card">
        <h2 className="block" style={{ fontSize: '1.1rem' }}>Danger zone</h2>
        <p className="muted mb">Restarting wipes all progress and begins the course fresh from Day 1.</p>
        <button className="btn btn-ghost" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
          onClick={restart} disabled={busy}>
          Restart course
        </button>
      </div>
    </div>
  );
}

const WHYS = [
  { id: 'trip', label: 'A trip' },
  { id: 'family', label: 'Family' },
  { id: 'work', label: 'Work' },
  { id: 'curiosity', label: 'Curiosity' },
];

// One reminder a day, at a time the learner picks. Everything here saves as
// it is changed — there is no state worth a separate Save button.
function ReminderCard({ user, setUser }) {
  const [permission, setPermission] = useState(notificationPermission());
  const [error, setError] = useState('');

  const update = async (payload) => {
    setError('');
    try {
      setUser(await api.updateReminders(payload));
    } catch (e) {
      setError(e.message || 'Could not save that.');
    }
  };

  const toggle = async () => {
    const turningOn = !user.remindersEnabled;
    // Asked from this click, the only place a browser will honour it — and
    // not waited for: the prompt can sit unanswered, and the switch should
    // not sit there with it.
    if (turningOn) askNotificationPermission().then(setPermission);
    await update({ enabled: turningOn });
  };

  const setWhy = async (why) => {
    setError('');
    try {
      setUser(await api.updateWhy(user.why === why ? null : why));
    } catch (e) {
      setError(e.message || 'Could not save that.');
    }
  };

  return (
    <div className="card mb">
      <h2 className="block" style={{ fontSize: '1.1rem' }}>Daily reminder</h2>
      <p className="muted mb">
        One a day, at the time you choose. It names the words waiting in your dose and nothing else.
      </p>

      <div className="row spread reminder-row">
        <label className="reminder-toggle">
          <input type="checkbox" checked={user.remindersEnabled} onChange={toggle} />
          <span>Remind me</span>
        </label>
        <input
          className="taster-time reminder-time"
          type="time"
          value={user.reminderLocalTime}
          disabled={!user.remindersEnabled}
          aria-label="Reminder time"
          onChange={(e) => e.target.value && update({ localTime: e.target.value })}
        />
      </div>

      {/* Said plainly: what this browser can and cannot do. */}
      {user.remindersEnabled && (
        <p className="muted reminder-note">
          {!notificationsSupported()
            ? 'This browser cannot show notifications. The phone app will use this time.'
            : permission === 'granted'
              ? 'In a browser the reminder can only appear while PolePole is open in a tab. The phone app delivers it either way.'
              : permission === 'denied'
                ? 'Notifications are blocked for this site in your browser settings, so nothing will appear here. The phone app will still use this time.'
                : (
                  <>
                    This browser has not been allowed to show notifications yet.{' '}
                    <a href="#" onClick={async (e) => { e.preventDefault(); setPermission(await askNotificationPermission()); }}>Allow them</a>
                  </>
                )}
          {user.hasPushToken && ' Your phone is registered.'}
        </p>
      )}

      <div className="field mt">
        <label>What's your why? (used only if you drift away for a few days)</label>
        <div className="why-chips">
          {WHYS.map((w) => (
            <button
              key={w.id}
              type="button"
              className={`why-chip ${user.why === w.id ? 'active' : ''}`}
              aria-pressed={user.why === w.id}
              onClick={() => setWhy(w.id)}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-box mt">{error}</div>}
    </div>
  );
}
