import { useEffect, useState } from 'react';
import SpeakButton from './SpeakButton';
import { useMicRecorder } from '../hooks/useMicRecorder';
import { speechEnabled, assessPronunciation } from '../lib/speechAssess';

// Speak-and-check pronunciation drill. The learner hears the model phrase (🔊),
// taps the mic and says it; we transcribe (self-hosted Whisper) and score the
// word match, highlighting each target word green (said) or red (missed).

const DEFAULT_PROMPTS = [
  { swahili: 'Habari yako?', english: 'How are you?' },
  { swahili: 'Ninasoma Kiswahili', english: 'I am learning Swahili' },
  { swahili: 'Asante sana', english: 'Thank you very much' },
];

const scoreClass = (s) => (s >= 80 ? 'good' : s >= 55 ? 'ok' : 'low');

export default function PronunciationDrill({ block = {} }) {
  const prompts = block.prompts?.length ? block.prompts : DEFAULT_PROMPTS;
  const [pi, setPi] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | recording | checking | result | error
  const [result, setResult] = useState(null);
  const [enabled, setEnabled] = useState(null); // null = unknown
  const rec = useMicRecorder();
  const p = prompts[pi];

  useEffect(() => { speechEnabled().then(setEnabled); }, []);
  useEffect(() => { setPhase('idle'); setResult(null); }, [pi]);

  const onMic = async () => {
    if (phase === 'recording') {
      const blob = await rec.stop();
      if (!blob) { setPhase('idle'); return; }
      setPhase('checking');
      try {
        const r = await assessPronunciation(blob, p.swahili);
        setResult(r);
        setPhase('result');
      } catch {
        setPhase('error');
      }
    } else {
      setResult(null);
      const ok = await rec.start();
      if (ok) setPhase('recording');
    }
  };

  const retry = () => { setResult(null); setPhase('idle'); };
  const next = () => setPi((i) => (i + 1 < prompts.length ? i + 1 : 0));

  const unavailable = enabled === false || rec.supported === false;

  return (
    <div className="block">
      <div className="vb pd">
        <div className="vb-title">{block.calloutTitle || 'Say it out loud'}</div>
        <p className="vb-intro">
          {block.intro || "Tap 🔊 to hear it, then press the mic and say the phrase. We'll check what you said."}
        </p>

        <div className="sb-progress">
          {prompts.map((_, i) => (
            <span key={i} className={`sb-dot ${i < pi ? 'done' : ''} ${i === pi ? 'active' : ''}`} />
          ))}
          <span className="sb-count">{pi + 1} / {prompts.length}</span>
        </div>

        <div className="pd-phrase">
          <div className="pd-sw">
            <span>{p.swahili}</span>
            <SpeakButton text={p.swahili} />
          </div>
          <div className="pd-en">{p.english}</div>
        </div>

        {unavailable ? (
          <div className="pd-note">
            {rec.supported === false
              ? "Mic recording isn't supported in this browser — you can still tap 🔊 to hear the phrase."
              : "Speak-and-check needs the pronunciation service running. You can still tap 🔊 to hear the phrase."}
          </div>
        ) : (
          <>
            <div className="pd-controls">
              <button
                type="button"
                className={`pd-mic ${phase === 'recording' ? 'rec' : ''}`}
                onClick={onMic}
                disabled={phase === 'checking'}
              >
                {phase === 'recording' ? '■ Stop' : phase === 'checking' ? 'Checking…' : '🎤 Speak'}
              </button>
              {phase === 'recording' && <span className="pd-live">● Listening…</span>}
              {phase === 'checking' && <span className="pd-live muted">Transcribing…</span>}
              {rec.error && <span className="pd-err">{rec.error}</span>}
            </div>

            {phase === 'result' && result && (
              <div className="pd-result">
                <div className={`pd-score ${scoreClass(result.score)}`}>
                  <span className="pd-score-num">{result.score}%</span>
                  <span className="pd-score-lbl">match</span>
                </div>
                <div className="pd-detail">
                  {result.words?.length > 0 && (
                    <div className="pd-target">
                      {result.words.map((w, i) => (
                        <span key={i} className={`pd-w ${w.ok ? 'ok' : 'miss'}`}>{w.word}</span>
                      ))}
                    </div>
                  )}
                  <div className="pd-heard">
                    You said: <em>“{result.transcription || '—'}”</em>
                  </div>
                  <div className="pd-meta">
                    {typeof result.completeness === 'number' && <span>{result.completeness}% of words</span>}
                    {typeof result.confidence === 'number' && <span>· {Math.round(result.confidence)}% clarity</span>}
                    {typeof result.wpm === 'number' && result.wpm > 0 && <span>· {Math.round(result.wpm)} wpm</span>}
                  </div>
                  <div className="pd-actions">
                    <button className="btn btn-ghost btn-sm" onClick={retry}>Try again</button>
                    <button className="btn btn-gold btn-sm" onClick={next}>
                      {pi + 1 < prompts.length ? 'Next →' : 'Start over'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {phase === 'error' && (
              <div className="pd-err">
                Couldn't reach the pronunciation service.{' '}
                <button className="btn btn-ghost btn-sm" onClick={retry}>Try again</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
