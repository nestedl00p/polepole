import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function QuizPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});       // questionId -> answer
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getLesson(id).then((l) => setLesson(l)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="spinner" />;
  if (!lesson) return <div className="container page"><p>Quiz not found.</p></div>;

  const questions = lesson.quiz;
  const q = questions[idx];
  const total = questions.length;

  const setAnswer = (val) => setAnswers((a) => ({ ...a, [q.id]: val }));
  const current = answers[q?.id] ?? '';

  const next = () => { setShowHint(false); setIdx((i) => Math.min(i + 1, total - 1)); };
  const prev = () => { setShowHint(false); setIdx((i) => Math.max(i - 1, 0)); };

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload = questions.map((qq) => ({ questionId: qq.id, answer: answers[qq.id] ?? '' }));
      const res = await api.submitQuiz(lesson.id, payload);
      setResult(res);
      await refreshUser();
    } finally {
      setSubmitting(false);
    }
  };

  // ----- Result screen -----
  if (result) {
    const pct = Math.round((result.score / result.total) * 100);
    return (
      <div className="container page narrow">
        <div className="card result-card">
          <div className="result-score">{result.score}/{result.total}</div>
          <div className={result.passed ? 'result-pass' : 'result-fail'}>
            {result.passed ? '🎉 Umefaulu! You passed!' : 'Karibu tena — try again to pass'}
          </div>
          <p className="muted mt">{pct}% correct {result.passed ? '(70% needed to advance)' : '— you need 70% to unlock the next lesson'}</p>
          {result.xpEarned > 0 && <div className="xp-pop">+{result.xpEarned} XP ⭐</div>}

          <div className="mt" style={{ textAlign: 'left' }}>
            <h2 className="block" style={{ fontSize: '1.05rem' }}>Review</h2>
            {result.feedback.map((f, i) => {
              const question = questions.find((x) => x.id === f.questionId);
              return (
                <div key={i} className="dialogue-line">
                  <div className="sw">{i + 1}. {question?.prompt}</div>
                  <div className={f.correct ? 'feedback-correct' : 'feedback-wrong'}>
                    {f.correct ? '✓ Correct' : `✗ Your answer: ${f.yourAnswer || '(blank)'} — Correct: ${f.correctAnswer}`}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="row center mt" style={{ gap: 12 }}>
            {result.passed ? (
              <>
                <button className="btn btn-primary" onClick={() => navigate('/')}>Back to dashboard →</button>
                {lesson.id < 31 && (
                  <button className="btn btn-gold" onClick={() => navigate(`/lesson/${lesson.id + 1}`)}>
                    Next lesson →
                  </button>
                )}
              </>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={() => { setResult(null); setIdx(0); }}>Try again</button>
                <button className="btn btn-primary" onClick={() => navigate(`/lesson/${lesson.id}`)}>Review lesson</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ----- Question screen -----
  const allAnswered = questions.every((qq) => (answers[qq.id] ?? '').trim() !== '');

  return (
    <div className="container page narrow">
      <Link to={`/lesson/${lesson.id}`} className="muted">← Back to lesson</Link>
      <div className="quiz-progress mt">Question {idx + 1} of {total} · {lesson.title}</div>
      <div className="progress-bar mb"><span style={{ width: `${((idx + 1) / total) * 100}%` }} /></div>

      <div className="question-card">
        <div className="question-prompt">{q.prompt}</div>

        {q.type === 'multiple_choice' ? (
          <div>
            {q.options.map((opt, i) => (
              <button key={i}
                className={`option ${current === opt ? 'selected' : ''}`}
                onClick={() => setAnswer(opt)}>
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <div>
            <input className="text-answer" value={current}
              placeholder="Type your answer in Swahili…"
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && idx < total - 1) next(); }}
              autoFocus />
            {q.hint && (
              <div className="hint" onClick={() => setShowHint((s) => !s)}>
                {showHint ? `💡 ${q.hint}` : '💡 Show hint'}
              </div>
            )}
          </div>
        )}

        <div className="row spread mt">
          <button className="btn btn-ghost btn-sm" onClick={prev} disabled={idx === 0}>← Prev</button>
          {idx < total - 1 ? (
            <button className="btn btn-primary btn-sm" onClick={next}>Next →</button>
          ) : (
            <button className="btn btn-gold" onClick={submit} disabled={!allAnswered || submitting}>
              {submitting ? 'Grading…' : 'Submit quiz'}
            </button>
          )}
        </div>
        {!allAnswered && idx === total - 1 && (
          <p className="muted mt" style={{ fontSize: '0.85rem' }}>Answer every question before submitting.</p>
        )}
      </div>
    </div>
  );
}
