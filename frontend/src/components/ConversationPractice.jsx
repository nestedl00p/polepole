import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useMicRecorder } from '../hooks/useMicRecorder';
import { lessonStrings } from '../lib/lessonStrings';
import { speakSwahili, stopSpeaking } from '../lib/speak';

// Conversation practice: a spoken role-play with an AI partner. The learner
// reads the scene, hears the partner's opening line, then answers out loud —
// each turn goes to /api/conversation/turn, which transcribes the recording
// (Whisper), asks the model for the partner's reply, and returns it with audio.
//
// The transcript lives here and is sent with every turn, so the server keeps
// nothing: "that's not what I said" just drops the last exchange and the
// learner records again.

let playing = null;

// Plays the reply in the course voice when the server sent audio; otherwise
// (cloud TTS off) falls back to speak.js, which ends at the device voice.
function playReply(turn) {
  stopSpeaking();
  if (playing) { playing.pause(); playing = null; }
  if (turn.audioUrl) {
    playing = new Audio(turn.audioUrl);
    playing.play().catch(() => speakSwahili(turn.text));
  } else {
    speakSwahili(turn.text);
  }
}

export default function ConversationPractice({ block = {}, lessonId }) {
  const { user } = useAuth();
  const t = lessonStrings(user?.course);
  const scenario = block.scenario || {};
  const rec = useMicRecorder();

  const [status, setStatus] = useState(null);   // null = unknown
  const [started, setStarted] = useState(false);
  const [turns, setTurns] = useState([]);       // [{ role, text, translation?, feedback?, audioUrl? }]
  const [phase, setPhase] = useState('idle');   // idle | recording | thinking
  const [notice, setNotice] = useState(null);
  const [done, setDone] = useState(false);
  const [typed, setTyped] = useState('');
  const [showHelp, setShowHelp] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    api.conversationStatus().then(setStatus).catch(() => setStatus({ enabled: false }));
    return () => { stopSpeaking(); if (playing) playing.pause(); };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [turns, phase]);

  const opening = { role: 'partner', text: scenario.opening, translation: scenario.openingTranslation };

  const start = () => {
    setTurns([]); setDone(false); setNotice(null); setTyped(''); setStarted(true);
    playReply(opening);
  };

  const send = async ({ blob, text }) => {
    setNotice(null);
    setPhase('thinking');
    try {
      const form = new FormData();
      form.append('lessonId', String(lessonId));
      form.append('history', JSON.stringify(turns.map(({ role, text: line }) => ({ role, text: line }))));
      if (blob) {
        const ext = (blob.type || '').includes('ogg') ? 'ogg' : 'webm';
        form.append('file', blob, `turn.${ext}`);
      } else {
        form.append('text', text);
      }

      const r = await api.conversationTurn(form);
      if (typeof r.turnsLeft === 'number') setStatus((s) => ({ ...s, turnsLeft: r.turnsLeft }));

      if (r.unclear) {
        setNotice(t.cvUnclear);
      } else {
        const partner = {
          role: 'partner',
          text: r.reply,
          translation: r.translation,
          audioUrl: r.audio ? `data:${r.audioType || 'audio/mpeg'};base64,${r.audio}` : null,
        };
        setTurns((prev) => [
          ...prev,
          { role: 'learner', text: r.heard, feedback: r.feedback, spoken: !!blob },
          partner,
        ]);
        setDone(!!r.done);
        setTyped('');
        playReply(partner);
      }
    } catch (err) {
      setNotice(err.status === 429 || err.status === 503 ? err.message : t.cvError);
    } finally {
      setPhase('idle');
    }
  };

  const onMic = async () => {
    if (phase === 'recording') {
      const blob = await rec.stop();
      if (!blob) { setPhase('idle'); return; }
      await send({ blob });
    } else {
      stopSpeaking();
      if (playing) playing.pause();
      setNotice(null);
      if (await rec.start()) setPhase('recording');
    }
  };

  const onType = (e) => {
    e.preventDefault();
    const text = typed.trim();
    if (text && phase === 'idle') send({ text });
  };

  // Whisper misheard: drop the last exchange so the learner can say it again.
  const redo = () => {
    setTurns((prev) => prev.slice(0, -2));
    setDone(false);
    setNotice(null);
  };

  const canSpeak = status?.speech && rec.supported !== false;
  const outOfTurns = status?.turnsLeft === 0;
  const lastLearner = turns.length >= 2 ? turns.length - 2 : -1;
  const learnerTurns = turns.filter((x) => x.role === 'learner').length;

  return (
    <div className="block">
      <div className="vb cv">
        <div className="vb-title">{block.calloutTitle || t.cvTitle}</div>
        {block.intro && <p className="vb-intro">{block.intro}</p>}

        <div className="cv-scene">
          <p>{scenario.setting}</p>
          <p className="cv-goal"><strong>{t.cvGoal}</strong> {scenario.goal}</p>
        </div>

        {status === null ? null : !status.enabled ? (
          <div className="pd-note">{t.cvUnavailable}</div>
        ) : !started ? (
          <button type="button" className="btn btn-primary" onClick={start} disabled={outOfTurns}>
            {outOfTurns ? t.cvNoTurns : t.cvStart}
          </button>
        ) : (
          <>
            <div className="cv-thread" aria-live="polite">
              {[opening, ...turns].map((turn, i) => {
                const idx = i - 1; // index into turns; -1 is the opening line
                return turn.role === 'partner' ? (
                  <div key={i} className="cv-row partner">
                    <div className="cv-bubble">
                      <div className="cv-line">
                        <span>{turn.text}</span>
                        <button
                          type="button" className="speak-btn speak-btn-light speak-btn-sm"
                          onClick={() => playReply(turn)} title={t.cvReplay} aria-label={t.cvReplay}
                        >🔊</button>
                      </div>
                      {showHelp && turn.translation && <div className="cv-tr">{turn.translation}</div>}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="cv-row learner">
                    <div className="cv-bubble">
                      <div className="cv-line"><span>{turn.text}</span></div>
                    </div>
                    {turn.feedback && <div className="cv-feedback">💡 {turn.feedback}</div>}
                    {idx === lastLearner && turn.spoken && phase === 'idle' && (
                      <button type="button" className="cv-redo" onClick={redo}>{t.cvRedo}</button>
                    )}
                  </div>
                );
              })}
              {phase === 'thinking' && (
                <div className="cv-row partner"><div className="cv-bubble cv-typing">…</div></div>
              )}
              <div ref={endRef} />
            </div>

            {notice && <div className="pd-err cv-notice">{notice}</div>}

            {done ? (
              <div className="cv-done">
                <span>🎉 {t.cvDone(learnerTurns)}</span>
                <button type="button" className="btn btn-gold btn-sm" onClick={start} disabled={outOfTurns}>
                  {t.cvAgain}
                </button>
              </div>
            ) : outOfTurns ? (
              <div className="pd-note">{t.cvNoTurns}</div>
            ) : (
              <>
                <div className="pd-controls">
                  {canSpeak && (
                    <button
                      type="button"
                      className={`pd-mic ${phase === 'recording' ? 'rec' : ''}`}
                      onClick={onMic}
                      disabled={phase === 'thinking'}
                    >
                      {phase === 'recording' ? t.cvStop : phase === 'thinking' ? t.cvThinking : t.cvSpeak}
                    </button>
                  )}
                  {phase === 'recording' && <span className="pd-live">● {t.cvListening}</span>}
                  {rec.error && <span className="pd-err">{rec.error}</span>}
                  <form className="cv-type" onSubmit={onType}>
                    <input
                      type="text" value={typed} maxLength={300}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder={canSpeak ? t.cvOrType : t.cvType}
                      disabled={phase !== 'idle'}
                      aria-label={t.cvType}
                    />
                    <button type="submit" className="btn btn-ghost btn-sm" disabled={phase !== 'idle' || !typed.trim()}>
                      {t.cvSend}
                    </button>
                  </form>
                </div>
                {status.speech === false && <div className="cv-hint">{t.cvTypeOnly}</div>}
              </>
            )}

            <div className="cv-help">
              <button type="button" className="cv-toggle" onClick={() => setShowHelp((v) => !v)}>
                {showHelp ? t.cvHideHelp : t.cvShowHelp}
              </button>
              {showHelp && scenario.phrases?.length > 0 && (
                <div className="cv-phrases">
                  {scenario.phrases.map((p, i) => (
                    <span key={i} className="cv-phrase" title={p.english}>
                      <b>{p.swahili}</b> <i>{p.english}</i>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
