import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { DayBars, Loading, PageHead, Section, Stat, fmtNum, relTime, useLoad } from './ui';

export default function Overview() {
  const state = useLoad(() => api.admin.overview(), []);

  return (
    <>
      <PageHead title="Overview" actions={<button className="btn btn-sm btn-ghost" onClick={state.reload}>Refresh</button>}>
        Who is here, and whether they are coming back.
      </PageHead>

      <Loading state={state}>
        {(d) => (
          <>
            <div className="bo-stats">
              <Stat label="Accounts" value={fmtNum(d.users.total)}
                note={`${fmtNum(d.users.new7d)} new this week · ${fmtNum(d.users.new30d)} in 30 days`} />
              <Stat label="Seen in 24 hours" value={fmtNum(d.users.seen24h)}
                note={`${fmtNum(d.users.seen7d)} in 7 days · ${fmtNum(d.users.seen30d)} in 30`} />
              <Stat label="Doses completed" value={fmtNum(d.totals.dosesCompleted)}
                note={`${fmtNum(d.totals.cards)} review cards in play`} />
              <Stat label="Lessons passed" value={fmtNum(d.totals.lessonsCompleted)}
                note={`${fmtNum(d.totals.voiceTakes)} voice takes kept`} />
            </div>

            <div className="bo-grid-2">
              <Section title="Sign-ups">
                <DayBars title="New accounts per day" points={d.series} valueKey="signups" unit="sign-ups" />
              </Section>
              <Section title="Practice">
                <DayBars title="Learners practising per day" points={d.series} valueKey="practising" unit="learner-days" />
              </Section>
            </div>
            <p className="bo-footnote">
              Sign-ups are counted by UTC day; practice by each learner's own calendar day.
              "Seen" only counts visits since the backoffice was installed.
            </p>

            <div className="bo-grid-2">
              <Section title="By course">
                <table className="bo-table">
                  <thead><tr><th>Course</th><th className="num">Accounts</th><th className="num">Share</th></tr></thead>
                  <tbody>
                    {d.users.byCourse.map((c) => (
                      <tr key={c.id}>
                        <td>{c.flag} {c.title}</td>
                        <td className="num">{fmtNum(c.count)}</td>
                        <td className="num">{d.users.total ? `${Math.round((c.count / d.users.total) * 100)}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="bo-footnote">
                  {fmtNum(d.users.withPhone)} with a phone registered for reminders ·{' '}
                  {fmtNum(d.users.admins)} admin{d.users.admins === 1 ? '' : 's'} ·{' '}
                  {fmtNum(d.users.suspended)} suspended
                </p>
              </Section>

              <Section title="Newest accounts" aside={<Link to="/admin/users">All users →</Link>}>
                {d.recentSignups.length === 0 ? <p className="muted">No accounts yet.</p> : (
                  <table className="bo-table">
                    <tbody>
                      {d.recentSignups.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <Link to={`/admin/users/${u.id}`}>{u.displayName}</Link>
                            <div className="bo-sub">{u.email}</div>
                          </td>
                          <td className="num muted">{relTime(u.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>
            </div>
          </>
        )}
      </Loading>
    </>
  );
}
