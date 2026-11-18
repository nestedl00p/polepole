import { useLocale } from '../context/LocaleContext';

// The last seven days, oldest first: a filled dot for a day with practice.
//
// It shows what happened and nothing else — no "don't break it" framing, no
// countdown. A missed day is an empty dot, not a warning.
// "2026-11-13" → weekday, without letting the Date constructor read it as UTC
// midnight and shift it a day for anyone west of Greenwich.
function weekday(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  return days[new Date(y, m - 1, d).getDay()];
}

export default function WeekStrip({ week, light = false }) {
  const w = useLocale().t.weekStrip;
  if (!week?.length) return null;
  const practised = week.filter((d) => d.practised).length;

  return (
    <div
      className={`week-strip ${light ? 'week-strip-light' : ''}`}
      role="img"
      aria-label={w.summary(practised, week.length)}
    >
      {week.map((d) => (
        <span
          key={d.date}
          className={`week-dot ${d.practised ? 'on' : ''} ${d.isToday ? 'today' : ''}`}
          title={`${weekday(d.date, w.days)}${d.isToday ? ` ${w.today}` : ''} — ${d.practised ? w.practised : w.noPractice}`}
        />
      ))}
      <span className="week-strip-lbl">{w.last7}</span>
    </div>
  );
}
