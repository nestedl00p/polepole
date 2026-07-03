import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

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
        <p>Adjust your learning pace or restart the course.</p>
      </div>

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
