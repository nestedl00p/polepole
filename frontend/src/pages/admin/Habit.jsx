import { api } from '../../api/client';
import { Loading, PageHead, Section, Stat, fmtNum, fmtPct, useLoad } from './ui';

const WHY = { trip: 'A trip', family: 'Family', work: 'Work', curiosity: 'Curiosity', unset: 'Not answered' };

// The habit test from docs/DAILY-PRACTICE-LOOP.md: are learners coming back
// without being asked? Same numbers as GET /api/habit/report.
export default function Habit() {
  const state = useLoad(() => api.admin.habit(), []);

  return (
    <>
      <PageHead title="Habit report">
        Whether a habit is forming, against the targets set for the first cohort.
      </PageHead>

      <Loading state={state}>
        {({ all, targets, bySignupWeek, habitAnswers }) => (
          <>
            <div className="bo-stats">
              <Stat label="Dose completion" value={fmtPct(all.completionRate)}
                note={`Target ${targets.completionRate} · ${fmtNum(all.daysCompleted)} of ${fmtNum(all.daysOpened)} opened`} />
              <Stat label="Median dose time" value={all.medianDurationSeconds != null ? `${all.medianDurationSeconds}s` : '—'}
                note={`Target ${targets.medianDurationSeconds}s`} />
              <Stat label="Day-7 unprompted" value={fmtPct(all.d7UnpromptedRate)}
                note={`Target ${targets.d7UnpromptedRate} · ${all.d7Unprompted} of ${all.d7Eligible} eligible`} />
              <Stat label="Day-30 habitual" value={fmtPct(all.d30HabitualRate)}
                note={`Target ${targets.d30HabitualRate} · ${all.d30Habitual} of ${all.d30Eligible} eligible`} />
              <Stat label="Doses per lesson" value={all.dosesPerLesson ?? '—'}
                note={`Target ${targets.dosesPerLesson}`} />
            </div>

            <div className="bo-grid-2">
              <Section title="Steps on the habit path">
                <table className="bo-table">
                  <thead><tr><th>Step</th><th className="num">Learners</th><th className="num">Share</th></tr></thead>
                  <tbody>
                    {[
                      ['First dose within an hour of signing up', all.firstDoseWithinHour],
                      ['Chose their own reminder time', all.choseReminderTime],
                      ['Pinned a card in week one', all.pinnedInWeekOne],
                      ['Seven days running', all.sevenDaysRunning],
                    ].map(([label, n]) => (
                      <tr key={label}>
                        <td>{label}</td>
                        <td className="num">{fmtNum(n)}</td>
                        <td className="num">{all.learners ? fmtPct(n / all.learners) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              <Section title="Their why">
                <table className="bo-table">
                  <tbody>
                    {Object.entries(all.why).sort((a, b) => b[1] - a[1]).map(([key, n]) => (
                      <tr key={key}>
                        <td>{WHY[key] || key}</td>
                        <td className="num">{fmtNum(n)}</td>
                        <td className="num">{all.learners ? fmtPct(n / all.learners) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            </div>

            <Section title="By sign-up week">
              {bySignupWeek.length === 0 ? <p className="muted">No learners yet.</p> : (
                <div className="bo-scroll">
                  <table className="bo-table">
                    <thead>
                      <tr>
                        <th>Week</th><th className="num">Learners</th><th className="num">Completion</th>
                        <th className="num">Median</th><th className="num">D7 unprompted</th>
                        <th className="num">D30 habitual</th><th className="num">Doses / lesson</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bySignupWeek.map((c) => (
                        <tr key={c.signupWeek}>
                          <td>{c.signupWeek}</td>
                          <td className="num">{fmtNum(c.learners)}</td>
                          <td className="num">{fmtPct(c.completionRate)}</td>
                          <td className="num">{c.medianDurationSeconds != null ? `${c.medianDurationSeconds}s` : '—'}</td>
                          <td className="num">{fmtPct(c.d7UnpromptedRate)}</td>
                          <td className="num">{fmtPct(c.d30HabitualRate)}</td>
                          <td className="num">{c.dosesPerLesson ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title={'"What makes you open this?"'}>
              {habitAnswers.length === 0
                ? <p className="muted">Nobody has reached the day-30 question yet.</p>
                : <ul className="bo-quotes">{habitAnswers.map((a, i) => <li key={i}>{a}</li>)}</ul>}
            </Section>
          </>
        )}
      </Loading>
    </>
  );
}
