import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import ContentBlock from '../components/ContentBlock';
import SpeakButton from '../components/SpeakButton';

export default function LessonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.getLesson(id)
      .then(setLesson)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="spinner" />;
  if (error) return (
    <div className="container page">
      <div className="error-box">{error}</div>
      <Link to="/" className="btn btn-ghost">← Back to dashboard</Link>
    </div>
  );
  if (!lesson) return null;

  return (
    <div className="container page">
      <Link to="/" className="muted">← Dashboard</Link>
      <div className="lesson-head mt">
        <div>
          <div className="day-num">Day {lesson.id} · {lesson.theme}</div>
          <h1>{lesson.title}</h1>
          <div className="subtitle">{lesson.subtitle}</div>
        </div>
      </div>

      {lesson.blocks.map((b, i) => <ContentBlock key={i} block={b} />)}

      {lesson.vocabulary?.length > 0 && (
        <div className="block">
          <h2>Vocabulary</h2>
          <div className="vocab-grid mt">
            {lesson.vocabulary.map((v, i) => (
              <div className="vocab-chip" key={i}>
                <div className="vocab-sw-row">
                  <div className="sw">{v.swahili}</div>
                  <SpeakButton text={v.swahili} size="sm" />
                </div>
                <div className="en">{v.english}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mt" style={{ textAlign: 'center' }}>
        <p className="mb"><strong>Ready to test yourself?</strong> Pass the quiz (70%+) to earn XP and unlock the next lesson.</p>
        <button className="btn btn-gold" onClick={() => navigate(`/lesson/${lesson.id}/quiz`)}>
          Take the quiz · {lesson.quiz.length} questions →
        </button>
      </div>
    </div>
  );
}
