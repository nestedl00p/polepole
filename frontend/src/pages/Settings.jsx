import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale, LocaleSelect } from '../context/LocaleContext';
import { askNotificationPermission, notificationPermission, notificationsSupported } from '../lib/reminders';

const PACE_DAYS = [30, 45, 60, 90, 180];

export default function Settings() {
  const { user, setUser, refreshUser } = useAuth();
  const { t: all } = useLocale();
  const t = all.settings;
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
    if (!confirm(t.restartConfirm)) return;
    setBusy(true);
    try {
      const updated = await api.restart();
      setUser(updated);
      await refreshUser();
      alert(t.restartDone);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page narrow">
      <div className="page-head">
        <h1>{t.title}</h1>
        <p>{t.sub}</p>
      </div>

      <div className="card mb">
        <h2 className="block" style={{ fontSize: '1.1rem' }}>{t.languageTitle}</h2>
        <p className="muted mb">{t.languageBody}</p>
        <LocaleSelect />
      </div>

      <ReminderCard user={user} setUser={setUser} />

      <div className="card mb">
        <h2 className="block" style={{ fontSize: '1.1rem' }}>{t.paceTitle}</h2>
        <p className="muted mb">
          {t.paceBody[0]}<strong>{t.paceBody[1](user.planLengthDays)}</strong>{t.paceBody[2]}
        </p>
        <div className="pace-options">
          {PACE_DAYS.map((days) => (
            <div key={days}
              className={`pace-opt ${!custom && plan === days ? 'active' : ''}`}
              onClick={() => { setPlan(days); setCustom(''); setSaved(false); }}>
              <div className="n">{days}</div>
              <div className="d"><strong>{all.pace[days].label}</strong><br />{all.pace[days].desc}</div>
            </div>
          ))}
        </div>

        <div className="field mt">
          <label>{t.customLabel}</label>
          <input type="number" min={30} max={365} value={custom}
            placeholder={t.customPlaceholder}
            onChange={(e) => { setCustom(e.target.value); setSaved(false); }} />
        </div>

        <button className="btn btn-primary mt" onClick={save} disabled={busy}>
          {busy ? all.common.saving : t.savePace}
        </button>
        {saved && <span className="feedback-correct" style={{ marginLeft: 12 }}>{t.saved}</span>}
      </div>

      <div className="card">
        <h2 className="block" style={{ fontSize: '1.1rem' }}>{t.dangerTitle}</h2>
        <p className="muted mb">{t.dangerBody}</p>
        <button className="btn btn-ghost" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
          onClick={restart} disabled={busy}>
          {t.restart}
        </button>
      </div>
    </div>
  );
}

const WHYS = ['trip', 'family', 'work', 'curiosity'];

// One reminder a day, at a time the learner picks. Everything here saves as
// it is changed — there is no state worth a separate Save button.
function ReminderCard({ user, setUser }) {
  const { t: all } = useLocale();
  const t = all.settings;
  const r = all.reminder;
  const [permission, setPermission] = useState(notificationPermission());
  const [error, setError] = useState('');

  const update = async (payload) => {
    setError('');
    try {
      setUser(await api.updateReminders(payload));
    } catch (e) {
      setError(e.message || t.couldNotSave);
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
      setError(e.message || t.couldNotSave);
    }
  };

  return (
    <div className="card mb">
      <h2 className="block" style={{ fontSize: '1.1rem' }}>{t.reminderTitle}</h2>
      <p className="muted mb">
        {t.reminderBody}
      </p>

      <div className="row spread reminder-row">
        <label className="reminder-toggle">
          <input type="checkbox" checked={user.remindersEnabled} onChange={toggle} />
          <span>{r.remindMe}</span>
        </label>
        <input
          className="taster-time reminder-time"
          type="time"
          value={user.reminderLocalTime}
          disabled={!user.remindersEnabled}
          aria-label={r.timeLabel}
          onChange={(e) => e.target.value && update({ localTime: e.target.value })}
        />
      </div>

      {/* Said plainly: what this browser can and cannot do. */}
      {user.remindersEnabled && (
        <p className="muted reminder-note">
          {!notificationsSupported()
            ? r.unsupported
            : permission === 'granted'
              ? r.tabOnly
              : permission === 'denied'
                ? r.blocked
                : (
                  <>
                    {r.notAllowedYet}{' '}
                    <a href="#" onClick={async (e) => { e.preventDefault(); setPermission(await askNotificationPermission()); }}>{r.allow}</a>
                  </>
                )}
          {user.hasPushToken && ` ${r.phoneRegistered}`}
        </p>
      )}

      <div className="field mt">
        <label>{t.whyLabel}</label>
        <div className="why-chips">
          {WHYS.map((w) => (
            <button
              key={w}
              type="button"
              className={`why-chip ${user.why === w ? 'active' : ''}`}
              aria-pressed={user.why === w}
              onClick={() => setWhy(w)}
            >
              {all.whys[w]}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-box mt">{error}</div>}
    </div>
  );
}
