// The last seven days, oldest first: a filled dot for a day with practice.
//
// It shows what happened and nothing else — no "don't break it" framing, no
// countdown. A missed day is an empty dot, not a warning.
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// "2026-11-13" → weekday, without letting the Date constructor read it as UTC
// midnight and shift it a day for anyone west of Greenwich.
function weekday(date) {
  const [y, m, d] = date.split('-').map(Number);
  return DAY[new Date(y, m - 1, d).getDay()];
}

export default function WeekStrip({ week, light = false }) {
  if (!week?.length) return null;
  const practised = week.filter((d) => d.practised).length;

  return (
    <div
      className={`week-strip ${light ? 'week-strip-light' : ''}`}
      role="img"
      aria-label={`Practised on ${practised} of the last ${week.length} days`}
    >
      {week.map((d) => (
        <span
          key={d.date}
          className={`week-dot ${d.practised ? 'on' : ''} ${d.isToday ? 'today' : ''}`}
          title={`${weekday(d.date)}${d.isToday ? ' (today)' : ''} — ${d.practised ? 'practised' : 'no practice'}`}
        />
      ))}
      <span className="week-strip-lbl">last 7 days</span>
    </div>
  );
}
