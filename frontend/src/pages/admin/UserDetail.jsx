import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import {
  Badge, Dialog, Facts, Loading, Meter, Section, Stat,
  fmtBytes, fmtDate, fmtDateTime, fmtNum, relTime, useLoad,
} from './ui';

const WHY = { trip: 'A trip', family: 'Family', work: 'Work', curiosity: 'Curiosity' };

// Twenty characters from an alphabet without look-alikes (no 0/O, 1/l/I), so
// it survives being read out over the phone.
function generatePassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(20));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const state = useLoad(() => api.admin.user(id), [id]);

  // Which dialog is open, plus the state of the request it makes.
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const open = (name, extra = {}) => { setError(''); setDialog({ name, ...extra }); };
  const close = () => { if (!busy) setDialog(null); };

  // Runs one change, then reloads so the page shows what the server now holds.
  const run = async (fn, done) => {
    setBusy(true); setError('');
    try {
      await fn();
      setDialog(null);
      if (done) setNotice(done);
      await state.reload();
    } catch (e) {
      setError(e.message || 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="bo-crumb"><Link to="/admin/users">← Users</Link></p>
      <Loading state={state}>
        {({ user: u, progress, practice, cards, voice, audit }) => (
          <>
            <div className="bo-head">
              <div>
                <h1>{u.displayName}</h1>
                <p>
                  {u.email} · #{u.id}{' '}
                  <span className="bo-badges">
                    {u.isDisabled ? <Badge tone="bad">Suspended</Badge> : <Badge tone="good">Active</Badge>}
                    {u.isAdmin && <Badge tone="info">Admin</Badge>}
                    {u.isSelf && <Badge>You</Badge>}
                  </span>
                </p>
              </div>
            </div>

            {notice && <div className="bo-notice" role="status">{notice} <button className="bo-link" onClick={() => setNotice('')}>Dismiss</button></div>}

            <div className="bo-stats">
              <Stat label="Lessons passed" value={`${progress.filter((p) => p.quizCompleted).length} / ${u.totalLessons}`}
                note={`Scheduled to be on day ${u.currentDay}`} />
              <Stat label="Streak" value={`${u.streakCount} day${u.streakCount === 1 ? '' : 's'}`}
                note={`Last dose ${relTime(u.lastDoseAt)}`} />
              <Stat label="XP" value={fmtNum(u.totalXp)} />
              <Stat label="Review cards" value={fmtNum(cards.total)} note={`${fmtNum(cards.due)} due now`} />
            </div>

            <div className="bo-grid-2">
              <Section title="Account" aside={<button className="bo-link" onClick={() => open('edit', { form: { displayName: u.displayName, email: u.email, planLengthDays: u.planLengthDays } })}>Edit</button>}>
                <Facts rows={[
                  ['Course', u.courseTitle],
                  ['Joined', fmtDateTime(u.createdAt)],
                  ['Last seen', relTime(u.lastSeenAt, 'not since the backoffice was installed')],
                  ['Course started', fmtDate(u.startDate)],
                  ['Plan', `${u.planLengthDays} days`],
                  ['Time zone', u.timeZoneId],
                  ['Reminders', u.remindersEnabled
                    ? `On, ${u.reminderLocalTime}${u.hasPushToken ? ' · phone registered' : ' · browser only'}`
                    : 'Off'],
                  ['Last reminder', relTime(u.lastNotifiedAt)],
                  ['Their why', WHY[u.why] || '—'],
                  u.habitAnswer && ['"What makes you open this?"', u.habitAnswer],
                ]} />
              </Section>

              <Section title="Actions">
                <div className="bo-actions">
                  <Action label="Set a new password" onClick={() => open('password', { password: generatePassword() })}>
                    There is no email reset; you give them the new one yourself.
                  </Action>
                  <Action label="Download their data" onClick={() => run(() => api.admin.exportUser(u.id), 'Export downloaded.')}>
                    Everything stored about this account, as a JSON file.
                  </Action>
                  <Action label="Reset progress" onClick={() => open('reset')}>
                    Back to day 1. Lesson progress, streak and XP are cleared.
                  </Action>
                  {u.isAdmin
                    ? <Action label="Remove admin role" disabled={u.isSelf} onClick={() => open('role', { isAdmin: false })}>
                        {u.isSelf ? 'You cannot change your own role.' : 'They keep their learner account.'}
                      </Action>
                    : <Action label="Make admin" onClick={() => open('role', { isAdmin: true })}>
                        Full access to this backoffice, including other accounts.
                      </Action>}
                  {u.isDisabled
                    ? <Action label="Lift suspension" onClick={() => open('status', { disabled: false })}>
                        They can sign in again, with everything as it was.
                      </Action>
                    : <Action label="Suspend account" danger disabled={u.isSelf} onClick={() => open('status', { disabled: true })}>
                        {u.isSelf ? 'You cannot suspend yourself.' : 'Signs them out everywhere and blocks sign-in. Nothing is deleted.'}
                      </Action>}
                  <Action label="Delete account" danger disabled={u.isSelf} onClick={() => open('delete')}>
                    {u.isSelf ? 'You cannot delete yourself here.' : 'Permanent: progress, cards and recordings go too.'}
                  </Action>
                </div>
              </Section>
            </div>

            <Section title="Last 30 practice days">
              {practice.length === 0 ? <p className="muted">No practice recorded yet.</p> : (
                <div className="bo-scroll">
                  <table className="bo-table">
                    <thead><tr><th>Day</th><th>Dose</th><th>Opened</th><th className="num">Items</th><th className="num">Time</th><th>Quiz</th></tr></thead>
                    <tbody>
                      {practice.map((d) => (
                        <tr key={d.day}>
                          <td>{fmtDate(d.day)}</td>
                          <td>{d.completed ? <Badge tone="good">Completed</Badge> : d.opened ? <Badge tone="warn">Opened only</Badge> : '—'}</td>
                          <td>{d.opened ? (d.openedUnprompted ? 'Unprompted' : 'After reminder') : '—'}</td>
                          <td className="num">{d.itemsAnswered || '—'}</td>
                          <td className="num">{d.durationSeconds != null ? `${d.durationSeconds}s` : '—'}</td>
                          <td>{d.quizPassed ? 'Passed one' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <div className="bo-grid-2">
              <Section title="Lessons">
                {progress.length === 0 ? <p className="muted">No lesson opened yet.</p> : (
                  <div className="bo-scroll">
                    <table className="bo-table">
                      <thead><tr><th>Lesson</th><th>Quiz</th><th className="num">Best</th><th>Passed</th></tr></thead>
                      <tbody>
                        {progress.map((p) => (
                          <tr key={p.lessonId}>
                            <td>{p.lessonId}. {p.title}</td>
                            <td>{p.quizCompleted ? <Badge tone="good">Passed</Badge> : p.quizTotal ? <Badge tone="warn">Not yet</Badge> : <Badge>Viewed</Badge>}</td>
                            <td className="num">{p.quizTotal ? `${p.bestQuizScore}/${p.quizTotal}` : '—'}</td>
                            <td>{fmtDate(p.completedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section title="Review cards">
                <Facts rows={[
                  ['Cards', fmtNum(cards.total)],
                  ['Due now', fmtNum(cards.due)],
                  ['Average strength', `${cards.averageStrength}%`],
                  ['Pinned', fmtNum(cards.pinned)],
                  ['Leeches (forgotten 3+ times)', fmtNum(cards.leeches)],
                  ['Voice takes kept', `${fmtNum(voice.count)} · ${fmtBytes(voice.bytes)}`],
                ]} />
                {cards.boxes.length > 0 && (
                  <>
                    <h3 className="bo-h3">By review box</h3>
                    {cards.boxes.map((b) => (
                      <div className="bo-box-row" key={b.box}>
                        <span>Box {b.box}</span>
                        <Meter ratio={b.count / cards.total} label={fmtNum(b.count)} />
                      </div>
                    ))}
                  </>
                )}
              </Section>
            </div>

            <Section title="Admin history for this account">
              {audit.length === 0 ? <p className="muted">No admin has changed this account.</p> : (
                <table className="bo-table">
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id}>
                        <td>{fmtDateTime(a.createdAt)}</td>
                        <td><code>{a.action}</code>{a.detail && <div className="bo-sub">{a.detail}</div>}</td>
                        <td className="muted">{a.adminEmail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            {dialog?.name === 'edit' && (
              <Dialog title="Edit account" confirmLabel="Save" busy={busy} error={error} onClose={close}
                onConfirm={() => run(() => api.admin.updateUser(u.id, {
                  displayName: dialog.form.displayName,
                  email: dialog.form.email,
                  planLengthDays: parseInt(dialog.form.planLengthDays, 10) || u.planLengthDays,
                }), 'Account updated.')}>
                {[['displayName', 'Display name', 'text'], ['email', 'Email (what they sign in with)', 'email'], ['planLengthDays', 'Plan length in days (30–365)', 'number']].map(([key, label, type]) => (
                  <div className="field" key={key}>
                    <label>{label}</label>
                    <input type={type} value={dialog.form[key]}
                      onChange={(e) => setDialog({ ...dialog, form: { ...dialog.form, [key]: e.target.value } })} />
                  </div>
                ))}
              </Dialog>
            )}

            {dialog?.name === 'password' && (
              <Dialog title="Set a new password" confirmLabel="Set password" busy={busy} error={error} onClose={close}
                onConfirm={() => run(() => api.admin.setPassword(u.id, dialog.password),
                  'Password changed. Pass the new one to them yourself — it is not shown again.')}>
                <p>This replaces the password for <strong>{u.email}</strong>. Copy it before you confirm; it is not stored anywhere you can read it back.</p>
                <div className="field">
                  <label>New password (8 characters or more)</label>
                  <input value={dialog.password} autoComplete="off" spellCheck="false" className="bo-mono"
                    onChange={(e) => setDialog({ ...dialog, password: e.target.value })} />
                </div>
                <div className="row">
                  <button className="bo-link" onClick={() => setDialog({ ...dialog, password: generatePassword() })}>Generate another</button>
                  <button className="bo-link" onClick={() => navigator.clipboard?.writeText(dialog.password)}>Copy</button>
                </div>
              </Dialog>
            )}

            {dialog?.name === 'reset' && (
              <Dialog title="Reset progress?" confirmLabel="Reset progress" danger busy={busy} error={error} onClose={close}
                onConfirm={() => run(() => api.admin.resetProgress(u.id), 'Progress reset to day 1.')}>
                <p>{u.displayName} goes back to day 1: lesson progress, streak and {fmtNum(u.totalXp)} XP are cleared. Their review cards and settings stay. This cannot be undone.</p>
              </Dialog>
            )}

            {dialog?.name === 'role' && (
              <Dialog title={dialog.isAdmin ? 'Make this account an admin?' : 'Remove the admin role?'}
                confirmLabel={dialog.isAdmin ? 'Make admin' : 'Remove role'} busy={busy} error={error} onClose={close}
                onConfirm={() => run(() => api.admin.setRole(u.id, dialog.isAdmin), dialog.isAdmin ? 'Admin role granted.' : 'Admin role removed.')}>
                <p>{dialog.isAdmin
                  ? `${u.email} will be able to see and change every account, including making other admins.`
                  : `${u.email} loses access to the backoffice immediately. Their learner account is untouched.`}</p>
              </Dialog>
            )}

            {dialog?.name === 'status' && (
              <Dialog title={dialog.disabled ? 'Suspend this account?' : 'Lift the suspension?'}
                confirmLabel={dialog.disabled ? 'Suspend' : 'Lift suspension'} danger={dialog.disabled}
                busy={busy} error={error} onClose={close}
                onConfirm={() => run(() => api.admin.setStatus(u.id, dialog.disabled), dialog.disabled ? 'Account suspended.' : 'Suspension lifted.')}>
                <p>{dialog.disabled
                  ? `${u.email} is signed out on every device and cannot sign back in. Nothing is deleted, and you can lift this at any time.`
                  : `${u.email} will be able to sign in again, with their progress as they left it.`}</p>
              </Dialog>
            )}

            {dialog?.name === 'delete' && (
              <Dialog title="Delete this account?" confirmLabel="Delete permanently" danger confirmText={u.email}
                busy={busy} error={error} onClose={close}
                onConfirm={async () => {
                  setBusy(true); setError('');
                  try {
                    await api.admin.deleteUser(u.id);
                    navigate('/admin/users', { replace: true });
                  } catch (e) {
                    setError(e.message || 'That did not work.');
                    setBusy(false);
                  }
                }}>
                <p>This removes <strong>{u.displayName}</strong>, their progress on {progress.length} lesson{progress.length === 1 ? '' : 's'}, {fmtNum(cards.total)} review cards and {fmtNum(voice.count)} recording{voice.count === 1 ? '' : 's'}. It cannot be undone. If you only want to stop them signing in, suspend instead.</p>
              </Dialog>
            )}
          </>
        )}
      </Loading>
    </>
  );
}

function Action({ label, children, onClick, danger, disabled }) {
  return (
    <div className="bo-action">
      <button className={`btn btn-sm ${danger ? 'bo-btn-danger-ghost' : 'btn-ghost'}`} onClick={onClick} disabled={disabled}>{label}</button>
      <span>{children}</span>
    </div>
  );
}
