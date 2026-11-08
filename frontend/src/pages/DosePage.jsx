import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import SpeakButton from '../components/SpeakButton';
import { useMicRecorder } from '../hooks/useMicRecorder';
import { speechEnabled, assessPronunciation } from '../lib/speechAssess';

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
};

const scoreClass = (s) => (s >= 80 ? 'good' : s >= 55 ? 'ok' : 'low');

export default function DosePage() {
  const navigate = useNavigate();
  const [dose, setDose] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState(null);   // answer result for the current item
  const [log, setLog] = useState([]);           // one entry per answered item
  const [done, setDone] = useState(false);

  const load = () => {
    setLoading(true);
    setIdx(0);
    setResult(null);
    setLog([]);
    setDone(false);
    api.dose().then(setDose).finally(() => setLoading(false));
  };

  useEffect(load, []);

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

  const next = () => {
    setResult(null);
    if (idx + 1 < items.length) setIdx(idx + 1);
    else setDone(true);
  };

  // Skipping does not post an answer, so an item the learner could not attempt
  // is left exactly where it was rather than being marked wrong.
  const skip = () => {
    setResult(null);
    if (idx + 1 < items.length) setIdx(idx + 1);
    else setDone(true);
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

          {log.length > 0 && (
            <div className="dose-summary mt">
              {log.map((e, i) => (
                <div key={i} className="dose-summary-row">
                  <span className={e.correct ? 'feedback-correct' : 'feedback-wrong'}>
                    {e.correct ? '✓' : '✗'}
                  </span>
                  <span className="dose-summary-word">{e.item.itemKey}</span>
                  <span className="dose-strength-track" aria-hidden="true">
                    <span style={{ width: `${e.strength}%` }} />
                  </span>
                  <span className="dose-summary-pct">{e.strength}%</span>
                </div>
              ))}
            </div>
          )}

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

      <div className="question-card">
        <div className="dose-label">{LABELS[item.exercise]}</div>

        {item.exercise === 'sema' ? (
          <SemaItem item={item} result={result} onAnswered={onAnswered} onSkip={skip} />
        ) : (
          <TapItem item={item} result={result} onAnswered={onAnswered} />
        )}

        {result && (
          <div className="dose-feedback">
            <div className={result.correct ? 'feedback-correct' : 'feedback-wrong'}>
              {result.correct ? '✓ Sawa!' : `✗ It's "${result.correctAnswer}"`}
            </div>
            <div className="dose-strength">
              <span className="dose-strength-lbl">Strength</span>
              <span className="dose-strength-track">
                <span style={{ width: `${result.strength}%` }} />
              </span>
              <span className="dose-strength-pct">{result.strength}%</span>
            </div>
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
      </div>

      <p className="muted dose-foot">
        {items.length} items · about 90 seconds
      </p>
    </div>
  );
}

// Recognise / produce: four options, one tap, no typing.
function TapItem({ item, result, onAnswered }) {
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);

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
  const rec = useMicRecorder();

  useEffect(() => { speechEnabled().then(setEnabled); }, []);
  useEffect(() => { setPhase('idle'); setAssessed(null); }, [item.itemKey]);

  const unavailable = enabled === false || rec.supported === false;

  const onMic = async () => {
    if (phase === 'recording') {
      const blob = await rec.stop();
      if (!blob) { setPhase('idle'); return; }
      setPhase('checking');
      try {
        const a = await assessPronunciation(blob, item.target);
        setAssessed(a);
        onAnswered(await api.answerDose({
          itemKey: item.itemKey,
          exercise: 'sema',
          speechScore: Math.round(a.score),
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
