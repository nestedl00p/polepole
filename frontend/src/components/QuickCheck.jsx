import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { lessonStrings, shuffled } from '../lib/lessonStrings';

// In-lesson practice questions with instant feedback (ungraded — the real quiz
// is still at the end). One question at a time: a wrong tap shakes and can be
// retried; the right one shows a one-line explanation.
export default function QuickCheck({ block = {} }) {
  const { user } = useAuth();
  const t = lessonStrings(user?.course);
  const questions = block.questions || [];
  const [round, setRound] = useState(0);
  const [qi, setQi] = useState(0);
  const [wrong, setWrong] = useState([]);   // options tried and rejected
  const [solved, setSolved] = useState(false);
  const [firstTry, setFirstTry] = useState(0);
  const [done, setDone] = useState(false);
  const q = questions[qi];
  // Authors list the answer wherever is convenient; shuffle so it moves around.
  const options = useMemo(() => (q ? shuffled(q.options) : []), [q, round]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!q) return null;

  const pick = (opt) => {
    if (solved || wrong.includes(opt)) return;
    if (opt === q.answer) {
      setSolved(true);
      if (wrong.length === 0) setFirstTry((n) => n + 1);
    } else {
      setWrong((w) => [...w, opt]);
    }
  };

  const next = () => {
    setWrong([]);
    setSolved(false);
    if (qi + 1 >= questions.length) setDone(true);
    else setQi(qi + 1);
  };

  const restart = () => { setDone(false); setQi(0); setFirstTry(0); setWrong([]); setSolved(false); setRound((r) => r + 1); };

  return (
    <div className="block">
      <div className="vb qc">
        <div className="vb-title">{block.calloutTitle || t.quickCheck}</div>
        {block.intro && <p className="vb-intro">{block.intro}</p>}

        {done ? (
          <div className="sb-done">
            <div className="sb-done-emoji">{firstTry === questions.length ? '🎉' : '👍'}</div>
            <div className="sb-done-title">{t.checkDone(firstTry, questions.length)}</div>
            <button type="button" className="btn btn-ghost btn-sm mt" onClick={restart}>{t.again}</button>
          </div>
        ) : (
          <>
            <div className="sb-progress">
              {questions.map((_, i) => (
                <span key={i} className={`sb-dot ${i < qi ? 'done' : ''} ${i === qi ? 'active' : ''}`} />
              ))}
              <span className="sb-count">{qi + 1} / {questions.length}</span>
            </div>

            <div className="qc-prompt">{q.prompt}</div>
            <div className="qc-options">
              {options.map((opt) => {
                const isWrong = wrong.includes(opt);
                const isRight = solved && opt === q.answer;
                return (
                  <button
                    type="button"
                    key={opt}
                    className={`option qc-option ${isRight ? 'correct' : ''} ${isWrong ? 'wrong qc-shake' : ''}`}
                    disabled={isWrong || (solved && !isRight)}
                    onClick={() => pick(opt)}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            <div className="qc-feedback" aria-live="polite">
              {solved ? (
                <>
                  <div>
                    <span className="sb-msg sb-msg-correct">✓ {t.correct}</span>
                    {q.explain && <span className="qc-explain"> {q.explain}</span>}
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={next}>
                    {qi + 1 >= questions.length ? t.finish : t.next}
                  </button>
                </>
              ) : wrong.length > 0 ? (
                <span className="sb-msg sb-msg-wrong">{t.tryAgain}</span>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
