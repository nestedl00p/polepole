// Shared pieces of the backoffice: formatting, the load hook, and the few
// components every page uses.
import { useCallback, useEffect, useRef, useState } from 'react';

// The API serialises SQLite timestamps without a zone marker, and a bare
// "2026-11-14T08:00:00" is read by Date as *local* time. They are all UTC.
export function parseUtc(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const s = String(value);
  // A bare calendar day ("2026-11-14") is a date, not an instant: build it in
  // local time, or it would show as the day before anywhere west of Greenwich.
  const day = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s);
  if (day) return new Date(+day[1], +day[2] - 1, +day[3]);
  const hasZone = /(Z|[+-]\d\d:?\d\d)$/.test(s);
  const d = new Date(hasZone || !s.includes('T') ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(value) {
  const d = parseUtc(value);
  return d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

export function fmtDateTime(value) {
  const d = parseUtc(value);
  return d
    ? d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
}

// "3 hours ago". Falls back to the date once it is more than a month old.
export function relTime(value, never = 'never') {
  const d = parseUtc(value);
  if (!d) return never;
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} d ago`;
  return fmtDate(d);
}

export function fmtBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function fmtPct(ratio, digits = 0) {
  return ratio == null ? '—' : `${(ratio * 100).toFixed(digits)}%`;
}

export const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString());

// Loads on mount and whenever deps change. A reply that arrives after a newer
// request started is dropped, so fast typing in a search box cannot leave an
// older result on screen.
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const seq = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await fn();
      if (mine === seq.current) setState({ data, error: '', loading: false });
    } catch (e) {
      if (mine === seq.current) setState((s) => ({ ...s, error: e.message || 'Could not load that.', loading: false }));
    }
  }, deps);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export function PageHead({ title, children, actions }) {
  return (
    <div className="bo-head">
      <div>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {actions && <div className="bo-head-actions">{actions}</div>}
    </div>
  );
}

export function Loading({ state, children }) {
  if (state.error) {
    return (
      <div className="error-box">
        {state.error} <button className="bo-link" onClick={state.reload}>Try again</button>
      </div>
    );
  }
  if (!state.data) return <div className="spinner" />;
  return children(state.data);
}

// tone: neutral | good | warn | bad | info. Always carries a word, never
// colour alone.
export function Badge({ tone = 'neutral', children }) {
  return <span className={`bo-badge bo-badge-${tone}`}>{children}</span>;
}

export function Stat({ label, value, note }) {
  return (
    <div className="bo-stat">
      <div className="bo-stat-label">{label}</div>
      <div className="bo-stat-value">{value}</div>
      {note && <div className="bo-stat-note">{note}</div>}
    </div>
  );
}

export function Section({ title, aside, children }) {
  return (
    <section className="bo-card">
      {(title || aside) && (
        <div className="bo-card-head">
          {title && <h2>{title}</h2>}
          {aside && <div className="bo-card-aside">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// Label / value rows.
export function Facts({ rows }) {
  return (
    <dl className="bo-facts">
      {rows.filter(Boolean).map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pager({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="bo-pager">
      <button className="btn btn-sm btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Previous</button>
      <span className="muted">Page {page} of {pages}</span>
      <button className="btn btn-sm btn-ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</button>
    </div>
  );
}

// A modal for anything that changes or destroys something. `confirmText`
// makes the admin type a phrase first — for the things that cannot be undone.
export function Dialog({ title, children, confirmLabel, danger, confirmText, onConfirm, onClose, busy, error }) {
  const [typed, setTyped] = useState('');
  const ready = !confirmText || typed.trim().toLowerCase() === confirmText.toLowerCase();

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="bo-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bo-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <div className="bo-dialog-body">{children}</div>
        {confirmText && (
          <div className="field">
            <label>Type <strong>{confirmText}</strong> to confirm</label>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" />
          </div>
        )}
        {error && <div className="error-box">{error}</div>}
        <div className="bo-dialog-actions">
          <button className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          {onConfirm && (
            <button
              className={`btn btn-sm ${danger ? 'bo-btn-danger' : 'btn-primary'}`}
              onClick={onConfirm}
              disabled={busy || !ready}
            >
              {busy ? 'Working…' : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// One measure over time, as thin bars on a single axis. Hovering (or
// focusing) a day shows its value; the figure underneath carries the total so
// the chart is never the only way to read the number.
export function DayBars({ title, points, valueKey, unit }) {
  const [hover, setHover] = useState(null);
  const values = points.map((p) => p[valueKey]);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const W = 600, H = 120, gap = 2;
  const bw = (W - gap * (points.length - 1)) / points.length;
  const shown = hover != null ? points[hover] : null;

  return (
    <figure className="bo-chart">
      <figcaption>
        <span className="bo-chart-title">{title}</span>
        <span className="bo-chart-read">
          {shown
            ? <><strong>{fmtNum(shown[valueKey])}</strong> {unit} · {fmtDate(shown.date)}</>
            : <><strong>{fmtNum(total)}</strong> {unit} in {points.length} days · peak {fmtNum(max === 1 && total === 0 ? 0 : Math.max(...values))}</>}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
        aria-label={`${title}: ${total} ${unit} over ${points.length} days`}
        onMouseLeave={() => setHover(null)}>
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="bo-chart-axis" />
        {points.map((p, i) => {
          const h = p[valueKey] === 0 ? 0 : Math.max(3, (p[valueKey] / max) * (H - 8));
          const x = i * (bw + gap);
          return (
            <g key={p.date} onMouseEnter={() => setHover(i)}>
              {/* Full-height hit target: a short bar should not be hard to point at. */}
              <rect x={x - gap / 2} y="0" width={bw + gap} height={H} fill="transparent" />
              {h > 0 && (
                <path
                  className={`bo-chart-bar ${hover === i ? 'is-hover' : ''}`}
                  d={roundedTop(x, H - h, bw, h, Math.min(4, bw / 2, h))}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="bo-chart-x">
        <span>{fmtDate(points[0]?.date)}</span>
        <span>{fmtDate(points[points.length - 1]?.date)}</span>
      </div>
    </figure>
  );
}

// A bar whose top corners are rounded and whose foot sits square on the baseline.
function roundedTop(x, y, w, h, r) {
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

// A proportion as a slim meter with its figure beside it.
export function Meter({ ratio, label }) {
  const pct = Math.max(0, Math.min(1, ratio || 0)) * 100;
  return (
    <div className="bo-meter" title={label}>
      <div className="bo-meter-track"><span style={{ width: `${pct}%` }} /></div>
      <span className="bo-meter-label">{label}</span>
    </div>
  );
}
