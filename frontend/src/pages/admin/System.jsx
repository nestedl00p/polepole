import { useState } from 'react';
import { api } from '../../api/client';
import { Badge, Dialog, Facts, Loading, PageHead, Section, fmtBytes, fmtDateTime, fmtNum, relTime, useLoad } from './ui';

const onOff = (on, yes = 'On', no = 'Off') => <Badge tone={on ? 'good' : 'neutral'}>{on ? yes : no}</Badge>;

export default function System() {
  const state = useLoad(() => api.admin.system(), []);
  const [ping, setPing] = useState(null);
  const [pinging, setPinging] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const runPing = async () => {
    setPinging(true); setPing(null);
    try { setPing(await api.admin.pingSpeech()); }
    catch (e) { setPing({ reachable: false, detail: e.message, milliseconds: 0 }); }
    finally { setPinging(false); }
  };

  const clearCache = async () => {
    setBusy(true); setError('');
    try {
      const { removed } = await api.admin.clearTtsCache();
      setConfirmClear(false);
      setNotice(`Removed ${removed} cached clip${removed === 1 ? '' : 's'}.`);
      await state.reload();
    } catch (e) {
      setError(e.message || 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="System" actions={<button className="btn btn-sm btn-ghost" onClick={state.reload}>Refresh</button>}>
        The parts that can be misconfigured, and what state each is in. Secrets are never shown — only whether they are set.
      </PageHead>

      {notice && <div className="bo-notice" role="status">{notice} <button className="bo-link" onClick={() => setNotice('')}>Dismiss</button></div>}

      <Loading state={state}>
        {(s) => (
          <>
            <div className="bo-grid-2">
              <Section title="Application">
                <Facts rows={[
                  ['Environment', <Badge tone={s.app.environment === 'Production' ? 'good' : 'warn'}>{s.app.environment}</Badge>],
                  ['Started', `${fmtDateTime(s.app.startedAt)} (${relTime(s.app.startedAt)})`],
                  ['Memory', fmtBytes(s.app.memoryBytes)],
                  ['Runtime', s.app.runtime],
                  ['Build', s.app.version || '—'],
                ]} />
              </Section>

              <Section title="Database">
                <Facts rows={[
                  ['File', <code className="bo-wrap">{s.database.path}</code>],
                  ['Size', fmtBytes(s.database.sizeBytes)],
                  ['Storage', s.database.persistent
                    ? <Badge tone="good">Persistent (DataDir)</Badge>
                    : <Badge tone="warn">App folder — lost if a container restarts</Badge>],
                  ['Schema', s.database.pendingMigrations.length === 0
                    ? <><Badge tone="good">Up to date</Badge> {s.database.appliedMigrations} migrations</>
                    : <Badge tone="bad">{s.database.pendingMigrations.length} pending</Badge>],
                  ['Latest migration', <code className="bo-wrap">{s.database.latestMigration || '—'}</code>],
                ]} />
                <h3 className="bo-h3">Rows</h3>
                <Facts rows={[
                  ['Users', fmtNum(s.database.rows.users)],
                  ['Lesson progress', fmtNum(s.database.rows.lessonProgress)],
                  ['Review cards', fmtNum(s.database.rows.cards)],
                  ['Practice days', fmtNum(s.database.rows.practiceDays)],
                  ['Voice takes', fmtNum(s.database.rows.voiceTakes)],
                  ['Audit entries', fmtNum(s.database.rows.auditEntries)],
                ]} />
              </Section>

              <Section title="Text-to-speech">
                <Facts rows={[
                  ['Provider', s.tts.provider],
                  ['Status', s.tts.configured
                    ? <Badge tone="good">Configured</Badge>
                    : <Badge tone="neutral">Off — learners hear the device voice</Badge>],
                  ['Start-up warm-up', onOff(s.tts.warmupEnabled)],
                  ['Cached clips', `${fmtNum(s.tts.cacheFiles)} · ${fmtBytes(s.tts.cacheBytes)}`],
                ]} />
                <div className="bo-action">
                  <button className="btn btn-sm bo-btn-danger-ghost" disabled={s.tts.cacheFiles === 0}
                    onClick={() => { setError(''); setConfirmClear(true); }}>Clear cache</button>
                  <span>Only after changing the voice or speed. Every clip is generated — and billed — again.</span>
                </div>
              </Section>

              <Section title="Pronunciation scoring (Whisper)">
                <Facts rows={[
                  ['Status', onOff(s.speech.enabled, 'Enabled', 'Disabled')],
                  ['Sidecar', s.speech.host || '—'],
                  ['Shared key', onOff(s.speech.apiKeySet, 'Set', 'Not set')],
                  ['Recordings kept', `${fmtNum(s.voice.files)} · ${fmtBytes(s.voice.bytes)}`],
                ]} />
                <div className="bo-action">
                  <button className="btn btn-sm btn-ghost" onClick={runPing} disabled={pinging || !s.speech.enabled}>
                    {pinging ? 'Checking…' : 'Check sidecar now'}
                  </button>
                  <span>
                    {ping
                      ? <><Badge tone={ping.reachable ? 'good' : 'bad'}>{ping.reachable ? 'Reachable' : 'No answer'}</Badge> {ping.detail} ({ping.milliseconds} ms)</>
                      : s.speech.enabled ? 'A live request to its health check.' : 'Enable Speech:Enabled to use it.'}
                  </span>
                </div>
              </Section>

              <Section title="Reminders">
                <Facts rows={[
                  ['Daily push', onOff(s.reminders.enabled)],
                  ['Phones registered', fmtNum(s.reminders.phonesRegistered)],
                  ['Learners opted in', fmtNum(s.reminders.optedIn)],
                ]} />
              </Section>

              <Section title="Access">
                <Facts rows={[
                  ['Allowed web origins', <span className="bo-wrap">{s.security.corsOrigins.join(', ')}</span>],
                  ['Habit report key', onOff(s.security.habitReportKeySet, 'Set', 'Not set')],
                  ['Admin:Emails', s.security.bootstrapAdminsConfigured
                    ? `${s.security.bootstrapAdminsConfigured} address(es) promoted at start-up`
                    : 'Not set'],
                ]} />
              </Section>
            </div>

            {confirmClear && (
              <Dialog title="Clear the speech cache?" confirmLabel="Clear cache" danger busy={busy} error={error}
                onClose={() => !busy && setConfirmClear(false)} onConfirm={clearCache}>
                <p>
                  This deletes {fmtNum(s.tts.cacheFiles)} clip{s.tts.cacheFiles === 1 ? '' : 's'} ({fmtBytes(s.tts.cacheBytes)}).
                  Each is regenerated the next time a learner plays it
                  {s.tts.configured ? `, and ${s.tts.provider} bills for it again.` : '.'}
                </p>
              </Dialog>
            )}
          </>
        )}
      </Loading>
    </>
  );
}
