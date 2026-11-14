import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import SpeakButton from '../components/SpeakButton';
import { useMicRecorder } from '../hooks/useMicRecorder';
import { speechEnabled, assessPronunciation } from '../lib/speechAssess';
import WeekStrip from '../components/WeekStrip';

// "Dose ya leo" — the daily practice loop. Five items, about ninety seconds,
// one of them spoken aloud.
//
// Three things here are deliberate rather than incidental, and are the whole
// point of the page:
//
//  - There is nothing to decide before starting. No deck picker, no mode
//    toggle, no difficulty. The scheduler already chose; the learner lands on
//    the first item.
//  - The dose ENDS. Five items and the session closes itself. "Endelea"
//    exists for the days someone wants more, and earns nothing extra — showing
//    up is what is rewarded, not staying.
//  - Strength is revealed only after answering, never before.
//
// See docs/DAILY-PRACTICE-LOOP.md.

const LABELS = {
  tambua: 'What does this mean?',
  tunga: 'Which word is this?',
  sema: 'Say it out loud',
  methali: 'Methali — a proverb for you',
};

// How long the learner took to answer. Feeds the strength bar and the XP
// award, so a word answered instantly counts for more than one worked out.
function useElapsed(key) {
  const started = useRef(Date.now());
  useEffect(() => { started.current = Date.now(); }, [key]);
  return () => Date.now() - started.current;
}

const scoreClass = (s) => (s >= 80 ? 'good' : s >= 55 ? 'ok' : 'low');

export default function DosePage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [dose, setDose] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState(null);   // answer result for the current item
  const [log, setLog] = useState([]);           // one entry per answered item
  const [done, setDone] = useState(false);
  const [closing, setClosing] = useState(null);   // result of POST /dose/complete

  const load = () => {
    setLoading(true);
    setIdx(0);
    setResult(null);
    setLog([]);
    setDone(false);
    setClosing(null);
    api.dose().then(setDose).finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Tell the server the Dose was opened. Once per visit, not per "endelea"
  // round: what is being recorded is how the day's practice started — before
  // or after the reminder — and a second round did not start anything.
  useEffect(() => { api.openDose().catch(() => {}); }, []);

  if (loading) return <div className="spinner" />;
  if (!dose) {
    return (
      <div className="container page narrow">
        <div className="card"><p>Could not load today's dose.</p></div>
      </div>
    );
  }

  // Not enough words met yet to build a four-option question.
  if (dose.message || !dose.items.length) {
    return (
      <div className="container page narrow">
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="dose-kicker">Dose ya leo</div>
          <h1 className="auth-title">Not yet</h1>
          <p className="muted mt">{dose.message || 'Nothing is due today.'}</p>
          <div className="row center mt">
            <Link to="/app" className="btn btn-primary">Go to a lesson →</Link>
          </div>
        </div>
      </div>
    );
  }

  const items = dose.items;
  const item = items[idx];
  const correctCount = log.filter((e) => e.correct).length;

  const onAnswered = (res) => {
    setResult(res);
    setLog((l) => [...l, { item, correct: res.correct, strength: res.strength }]);
  };

  // Finishing closes the dose server-side, which is what credits the day.
  // The streak is deliberately not claimed by the client: the API counts the
  // cards actually touched today, so an abandoned session earns nothing.
  const finish = async () => {
    setDone(true);
    try {
      setClosing(await api.completeDose());
      await refreshUser();
    } catch {
      /* the answers are already saved; the day can be credited on the next visit */
    }
  };

  const next = () => {
    setResult(null);
    if (idx + 1 < items.length) setIdx(idx + 1);
    else finish();
  };

  // Skipping does not post an answer, so an item the learner could not attempt
  // is left exactly where it was rather than being marked wrong.
  const skip = () => {
    setResult(null);
    if (idx + 1 < items.length) setIdx(idx + 1);
    else finish();
  };

  if (done) {
    return (
      <div className="container page narrow">
        <div className="card result-card">
          <div className="dose-kicker">Dose ya leo</div>
          <div className="result-score">{correctCount}/{log.length}</div>
          <div className="result-pass">Umemaliza! That's today done.</div>
          <p className="muted mt">
            {log.length === 0
              ? 'Nothing recorded this time.'
              : 'Each answer moved that word in your queue — tomorrow\'s dose is built from what you just did.'}
          </p>

          {/* Arrives as news: nothing in the app counts toward these, so the
              learner was not watching a bar fill. */}
          {closing?.milestones?.map((m) => (
            <div key={m.key} className="dose-milestone">
              <div className="dose-milestone-title">🏅 {m.title}</div>
              <div className="dose-milestone-detail">{m.detail}</div>
            </div>
          ))}

          {closing?.xpEarned > 0 && (
            <div className="dose-xp-total">+{closing.xpEarned} XP for finishing</div>
          )}

          {closing?.week && <div className="row center mt"><WeekStrip week={closing.week} /></div>}

          {closing?.streakAdvanced && (
            <div className="dose-streak">
              <div className="dose-streak-num">{closing.streakCount} 🔥</div>
              <div className="dose-streak-lbl">
                {closing.streakCount === 1 ? 'day' : 'days'} in a row
              </div>
              {/* Said plainly rather than hidden: a streak the learner can't
                  account for is worse than a broken one. */}
              {closing.restDayUsed && (
                <div className="dose-rest">
                  Siku ya mapumziko — you missed a day and it's been covered. The next
                  one is available in a week.
                </div>
              )}
            </div>
          )}

          {log.length > 0 && (
            <div className="dose-summary mt">
              {log.map((e, i) => (
                <div key={i} className="dose-summary-row">
                  <span className={e.correct ? 'feedback-correct' : 'feedback-wrong'}>
                    {e.correct ? '✓' : '✗'}
                  </span>
                  {/* A proverb's key is an index ("methali:3"), not something to show. */}
                  <span className="dose-summary-word">{e.item.kind === 'methali' ? (e.item.target || 'Methali') : e.item.itemKey}</span>
                  <span className="dose-strength-track" aria-hidden="true">
                    <span style={{ width: `${e.strength}%` }} />
                  </span>
                  <span className="dose-summary-pct">{e.strength}%</span>
                </div>
              ))}
            </div>
          )}

          {/* After the reward, never before it — and the server sends at most
              one of these per completion. */}
          {closing && <ClosingAsk closing={closing} onChanged={refreshUser} />}

          <div className="row center mt" style={{ gap: 12 }}>
            <button className="btn btn-primary" onClick={() => navigate('/app')}>
              Done for today
            </button>
            {/* Secondary and unrewarded on purpose: more practice is allowed,
                never incentivised. */}
            <button className="btn btn-ghost btn-sm" onClick={load}>Endelea — a few more</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container page narrow">
      <div className="dose-head">
        <div className="dose-kicker">Dose ya leo</div>
        <Link to="/app" className="muted dose-exit">Close</Link>
      </div>

      <div className="sb-progress">
        {items.map((_, i) => (
          <span key={i} className={`sb-dot ${i < idx ? 'done' : ''} ${i === idx ? 'active' : ''}`} />
        ))}
        <span className="sb-count">{idx + 1} / {items.length}</span>
      </div>

      <div className={`question-card ${item.exercise === 'methali' ? 'dose-methali-card' : ''}`}>
        <div className="dose-label">{LABELS[item.exercise]}</div>

        {item.exercise === 'methali' ? (
          <MethaliItem item={item} result={result} onAnswered={onAnswered} />
        ) : item.exercise === 'sema' ? (
          <SemaItem item={item} result={result} onAnswered={onAnswered} onSkip={skip} />
        ) : (
          <TapItem item={item} result={result} onAnswered={onAnswered} />
        )}

        {result && item.exercise !== 'methali' && (
          <div className="dose-feedback">
            <div className={result.correct ? 'feedback-correct' : 'feedback-wrong'}>
              {result.correct ? '✓ Sawa!' : `✗ It's "${result.correctAnswer}"`}
              {result.xpEarned > 0 && <span className="dose-xp">+{result.xpEarned} XP</span>}
            </div>
            <div className="dose-strength">
              <span className="dose-strength-lbl">Strength</span>
              <span className="dose-strength-track">
                <span style={{ width: `${result.strength}%` }} />
              </span>
              <span className="dose-strength-pct">{result.strength}%</span>
            </div>
            <PinButton key={item.itemKey} itemKey={item.itemKey} initial={item.pinned} />
            <div className="muted dose-when">
              {result.intervalDays === 0
                ? 'Coming back again shortly.'
                : result.intervalDays === 1
                  ? 'Back tomorrow.'
                  : `Back in ${result.intervalDays} days.`}
            </div>
            <div className="row center mt">
              <button className="btn btn-gold" onClick={next} autoFocus>
                {idx + 1 < items.length ? 'Next →' : 'Finish'}
              </button>
            </div>
          </div>
        )}

        {/* A proverb has no right answer to reveal — acknowledging it is the
            whole interaction, and it joins the review queue from tomorrow. */}
        {result && item.exercise === 'methali' && (
          <div className="dose-feedback">
            {result.xpEarned > 0 && (
              <div className="feedback-correct">
                Imehifadhiwa — saved to your deck
                <span className="dose-xp">+{result.xpEarned} XP</span>
              </div>
            )}
            <PinButton key={item.itemKey} itemKey={item.itemKey} initial={item.pinned} />
            <div className="row center mt">
              <button className="btn btn-gold" onClick={next} autoFocus>
                {idx + 1 < items.length ? 'Next →' : 'Finish'}
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="muted dose-foot">
        {items.length} items · about 90 seconds
      </p>
    </div>
  );
}

// The bonus. Not a test — the learner is handed something they can use, and
// the only thing asked of them is to read it.
function MethaliItem({ item, result, onAnswered }) {
  const [busy, setBusy] = useState(false);

  const keep = async () => {
    if (result || busy) return;
    setBusy(true);
    try {
      onAnswered(await api.answerDose({ itemKey: item.itemKey, exercise: 'methali' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="dose-methali">
        <div className="dose-methali-text">
          <span>{item.target}</span>
          <SpeakButton text={item.target} />
        </div>
        <div className="dose-methali-gloss">{item.prompt}</div>
        {item.note && <div className="dose-methali-note">{item.note}</div>}
      </div>

      {!result && (
        <div className="row center mt">
          <button className="btn btn-gold" onClick={keep} disabled={busy} autoFocus>
            {busy ? 'Saving…' : 'Nimeelewa — got it'}
          </button>
        </div>
      )}
    </>
  );
}

// Recognise / produce: four options, one tap, no typing.
function TapItem({ item, result, onAnswered }) {
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const elapsed = useElapsed(item.itemKey);

  useEffect(() => { setPicked(null); setBusy(false); }, [item.itemKey]);

  const choose = async (opt) => {
    if (result || busy) return;
    setPicked(opt);
    setBusy(true);
    try {
      onAnswered(await api.answerDose({
        itemKey: item.itemKey,
        exercise: item.exercise,
        answer: opt,
        elapsedMs: elapsed(),
      }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="dose-prompt">
        <span>{item.prompt}</span>
        {/* Only sounded out when the prompt is the language being learned —
            speaking the translation would be giving away a `tunga` answer. */}
        {item.exercise === 'tambua' && <SpeakButton text={item.prompt} />}
      </div>

      <div>
        {item.options.map((opt, i) => {
          const isPicked = picked === opt;
          const isAnswer = result && opt === result.correctAnswer;
          const cls = !result
            ? (isPicked ? 'option selected' : 'option')
            : isAnswer
              ? 'option dose-right'
              : isPicked
                ? 'option dose-wrong'
                : 'option dose-dim';
          return (
            <button key={i} className={cls} onClick={() => choose(opt)} disabled={!!result || busy}>
              {opt}
            </button>
          );
        })}
      </div>
    </>
  );
}

// Speak: the one item per dose that asks the learner to talk. Falls back to
// hear-only when the Whisper sidecar or the mic is unavailable.
function SemaItem({ item, result, onAnswered, onSkip }) {
  const [phase, setPhase] = useState('idle'); // idle | recording | checking | error
  const [assessed, setAssessed] = useState(null);
  const [enabled, setEnabled] = useState(null);
  const [take, setTake] = useState(null);       // the recording just scored, until kept or discarded
  const [kept, setKept] = useState('no');       // no | saving | yes | error
  const [earlier, setEarlier] = useState(null); // the learner's first kept take of this word
  const rec = useMicRecorder();
  const elapsed = useElapsed(item.itemKey);

  useEffect(() => { speechEnabled().then(setEnabled); }, []);
  useEffect(() => {
    setPhase('idle'); setAssessed(null); setTake(null); setKept('no'); setEarlier(null);
    // Oldest first, so the first element is the "before".
    api.voiceTakes(item.itemKey).then((t) => setEarlier(t?.[0] ?? null)).catch(() => {});
  }, [item.itemKey]);

  // Keeping a take is the learner's own act, one tap, after they have seen
  // the score. Nothing is stored unless they ask.
  const keep = async () => {
    if (!take || kept === 'saving' || kept === 'yes') return;
    setKept('saving');
    try {
      await api.keepVoiceTake(take, item.itemKey, assessed.score);
      setKept('yes');
    } catch {
      setKept('error');
    }
  };

  const unavailable = enabled === false || rec.supported === false;

  const onMic = async () => {
    if (phase === 'recording') {
      const blob = await rec.stop();
      if (!blob) { setPhase('idle'); return; }
      setPhase('checking');
      try {
        const a = await assessPronunciation(blob, item.target);
        setAssessed(a);
        setTake(blob);
        onAnswered(await api.answerDose({
          itemKey: item.itemKey,
          exercise: 'sema',
          speechScore: Math.round(a.score),
          elapsedMs: elapsed(),
        }));
        setPhase('idle');
      } catch {
        setPhase('error');
      }
    } else {
      setAssessed(null);
      const ok = await rec.start();
      if (ok) setPhase('recording');
    }
  };

  return (
    <>
      <div className="dose-prompt dose-prompt-sema">
        <span>{item.target}</span>
        <SpeakButton text={item.target} />
      </div>
      <div className="dose-gloss">{item.prompt}</div>

      {unavailable ? (
        <div className="pd-note">
          {rec.supported === false
            ? "Mic recording isn't supported in this browser — tap 🔊 to hear it, then carry on."
            : 'Speak-and-check needs the pronunciation service running. Tap 🔊 to hear it, then carry on.'}
          <div className="row center mt">
            <button className="btn btn-ghost btn-sm" onClick={onSkip}>Skip this one →</button>
          </div>
        </div>
      ) : (
        <>
          <div className="pd-controls">
            <button
              type="button"
              className={`pd-mic ${phase === 'recording' ? 'rec' : ''}`}
              onClick={onMic}
              disabled={phase === 'checking' || !!result}
            >
              {phase === 'recording' ? '■ Stop' : phase === 'checking' ? 'Checking…' : '🎤 Speak'}
            </button>
            {phase === 'recording' && <span className="pd-live">● Listening…</span>}
            {phase === 'checking' && <span className="pd-live muted">Transcribing…</span>}
            {rec.error && <span className="pd-err">{rec.error}</span>}
          </div>

          {assessed && (
            <div className="dose-sema-result">
              <div className={`pd-score ${scoreClass(assessed.score)}`}>
                <span className="pd-score-num">{Math.round(assessed.score)}%</span>
                <span className="pd-score-lbl">match</span>
              </div>
              {assessed.words?.length > 0 && (
                <div className="pd-target">
                  {assessed.words.map((w, i) => (
                    <span key={i} className={`pd-w ${w.ok ? 'ok' : 'miss'}`}>{w.word}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {assessed && (
            <div className="dose-voice">
              {earlier && <PlayTake take={earlier} label="Your first take" />}
              {take && <PlayBlob blob={take} label="Today" />}
              <button className="btn btn-ghost btn-sm" onClick={keep} disabled={kept === 'saving' || kept === 'yes'}>
                {kept === 'yes' ? '✓ Kept' : kept === 'saving' ? 'Saving…' : 'Hifadhi sauti — keep this take'}
              </button>
              {kept === 'error' && <span className="pd-err">Couldn't save that one.</span>}
            </div>
          )}

          {phase === 'error' && (
            <div className="pd-err">
              Couldn't reach the pronunciation service.{' '}
              <button className="btn btn-ghost btn-sm" onClick={onSkip}>Skip this one →</button>
            </div>
          )}

          {!result && phase === 'idle' && !assessed && (
            <div className="row center mt">
              <button className="btn btn-ghost btn-sm" onClick={onSkip}>Skip this one →</button>
            </div>
          )}
        </>
      )}
    </>
  );
}

// "Nitakumbuka hii" — I will remember this. One tap to make a card the
// learner's own; pinned cards are favoured when future doses are built.
function PinButton({ itemKey, initial }) {
  const [pinned, setPinned] = useState(!!initial);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.pinCard(itemKey, !pinned);
      setPinned(res.pinned);
    } catch {
      /* leave it as it was */
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={`dose-pin ${pinned ? 'on' : ''}`}
      onClick={toggle}
      disabled={busy}
      aria-pressed={pinned}
    >
      📌 {pinned ? 'Pinned — it will come up more often' : 'Nitakumbuka hii — pin this'}
    </button>
  );
}

function playUrl(url, onEnd) {
  const audio = new Audio(url);
  audio.onended = onEnd;
  audio.onerror = onEnd;
  audio.play().catch(onEnd);
}

// A recording still in memory — the one just made.
function PlayBlob({ blob, label }) {
  const play = () => {
    const url = URL.createObjectURL(blob);
    playUrl(url, () => URL.revokeObjectURL(url));
  };
  return <button type="button" className="btn btn-ghost btn-sm" onClick={play}>▶ {label}</button>;
}

function ago(iso) {
  const days = Math.floor((Date.now() - new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).getTime()) / 86400000);
  if (days <= 0) return 'earlier today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}

// A kept take. Fetched with the token and played from a blob — the audio
// endpoint is private to the learner, so an <audio src> cannot reach it.
function PlayTake({ take, label }) {
  const [busy, setBusy] = useState(false);
  const play = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const url = URL.createObjectURL(await api.voiceAudio(take.id));
      playUrl(url, () => { URL.revokeObjectURL(url); setBusy(false); });
    } catch {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={play} disabled={busy}>
      ▶ {label} · {take.score}% · {ago(take.createdAt)}
    </button>
  );
}

// The one thing the completion card may ask. Each is dismissable in a tap,
// and none comes back: the server records an ask as made when it sends it.
function ClosingAsk({ closing, onChanged }) {
  const [state, setState] = useState('open'); // open | done | dismissed
  const [answer, setAnswer] = useState('');

  if (state === 'dismissed') return null;

  // A product that offers to stop notifying you is one confident it has
  // built a habit rather than rented one.
  if (closing.offerStopReminders) {
    if (state === 'done') return <div className="dose-ask"><div className="dose-ask-done">Sawa — no more reminders. You can turn them back on in Settings.</div></div>;
    const stop = async () => {
      try { await api.updateReminders({ enabled: false }); await onChanged(); } catch { /* still on; Settings has the switch */ }
      setState('done');
    };
    return (
      <div className="dose-ask">
        <div className="dose-ask-title">You've started on your own 14 days running.</div>
        <div className="dose-ask-body">Want me to stop reminding you?</div>
        <div className="row center" style={{ gap: 10 }}>
          <button className="btn btn-primary btn-sm" onClick={stop}>Yes, stop reminding me</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setState('dismissed')}>Keep them</button>
        </div>
      </div>
    );
  }

  if (closing.askHabitQuestion) {
    if (state === 'done') return <div className="dose-ask"><div className="dose-ask-done">Asante — that helps.</div></div>;
    const send = async () => {
      if (!answer.trim()) return;
      try { await api.habitAnswer(answer.trim()); } catch { /* not worth interrupting them over */ }
      setState('done');
    };
    return (
      <div className="dose-ask">
        <div className="dose-ask-title">One question, once.</div>
        <div className="dose-ask-body">What makes you open this?</div>
        <input
          className="dose-ask-input"
          value={answer}
          maxLength={280}
          placeholder="In your own words"
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
        />
        <div className="row center" style={{ gap: 10 }}>
          <button className="btn btn-primary btn-sm" onClick={send} disabled={!answer.trim()}>Send</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setState('dismissed')}>Skip</button>
        </div>
      </div>
    );
  }

  if (closing.shareOffer) {
    return <ShareOffer offer={closing.shareOffer} done={state === 'done'} onDone={() => setState('done')} onDismiss={() => setState('dismissed')} />;
  }

  return null;
}

// Weekly at most, and only ever on the learner's say-so: the recording and
// the text leave the device through the system share sheet, to whoever they
// pick. Nothing is sent by the app.
function ShareOffer({ offer, done, onDone, onDismiss }) {
  const [note, setNote] = useState('');
  const text = offer.gloss ? `${offer.text} — "${offer.gloss}"` : offer.text;

  const send = async () => {
    try {
      if (navigator.share) {
        let files;
        if (offer.voiceTakeId) {
          try {
            const blob = await api.voiceAudio(offer.voiceTakeId);
            const ext = (blob.type || '').includes('ogg') ? 'ogg' : 'webm';
            const file = new File([blob], `polepole.${ext}`, { type: blob.type || 'audio/webm' });
            if (navigator.canShare?.({ files: [file] })) files = [file];
          } catch { /* share the words without the recording */ }
        }
        await navigator.share(files ? { text, files } : { text });
        onDone();
      } else {
        await navigator.clipboard.writeText(text);
        setNote('Copied — paste it to whoever you like.');
        onDone();
      }
    } catch (e) {
      // Closing the share sheet is a "no", not an error.
      if (e?.name !== 'AbortError') setNote("Couldn't open sharing here.");
    }
  };

  return (
    <div className="dose-ask">
      <div className="dose-ask-title">You can say this now.</div>
      <div className="dose-ask-quote">{offer.text}</div>
      {offer.gloss && <div className="dose-ask-body">{offer.gloss}</div>}
      {done ? (
        <div className="dose-ask-done">{note || 'Sent on its way.'}</div>
      ) : (
        <>
          <div className="row center" style={{ gap: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={send}>
              {offer.voiceTakeId ? 'Send your recording to someone' : 'Send it to someone'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onDismiss}>Not now</button>
          </div>
          {note && <div className="pd-err">{note}</div>}
        </>
      )}
    </div>
  );
}
