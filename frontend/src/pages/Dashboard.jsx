import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listLessons().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;
  if (!data) return <div className="container page"><p>Could not load lessons.</p></div>;

  const completed = data.lessons.filter((l) => l.quizCompleted).length;
  const pct = Math.round((completed / data.totalLessons) * 100);

  const weeks = [1, 2, 3, 4];
  const weekTitles = {
    1: 'Foundations',
    2: 'Noun Classes, Numbers & Time',
    3: 'Tenses & Daily Life',
    4: 'Complex Sentences & Culture',
  };

  const open = (lesson) => {
    if (!lesson.unlocked) return;
    navigate(`/lesson/${lesson.id}`);
  };

  return (
    <div className="container page">
      <div className="page-head">
        <h1>Karibu, {user.displayName}! 👋</h1>
        <p>Your {data.planLengthDays}-day Swahili plan — you're scheduled for Day {data.currentDay}.</p>
      </div>

      <div className="stats">
        <div className="stat"><div className="num">{completed}/{data.totalLessons}</div><div className="lbl">Lessons done</div></div>
        <div className="stat"><div className="num">{user.streakCount} 🔥</div><div className="lbl">Day streak</div></div>
        <div className="stat"><div className="num">{user.totalXp}</div><div className="lbl">Total XP</div></div>
        <div className="stat"><div className="num">{pct}%</div><div className="lbl">Course complete</div></div>
      </div>

      <div className="card mb">
        <div className="row spread">
          <strong>Overall progress</strong>
          <span className="muted">{completed} of {data.totalLessons} lessons</span>
        </div>
        <div className="progress-bar"><span style={{ width: `${pct}%` }} /></div>
      </div>

      {weeks.map((w) => {
        const lessons = data.lessons.filter((l) => l.week === w);
        if (!lessons.length) return null;
        return (
          <div className="week-group" key={w}>
            <div className="week-label">
              <h2>Week {w} — {weekTitles[w]}</h2>
              <div className="line" />
            </div>
            <div className="lesson-grid">
              {lessons.map((l) => (
                <div key={l.id}
                  className={`lesson-card ${l.unlocked ? '' : 'locked'}`}
                  onClick={() => open(l)}>
                  <div className="day">Day {l.id} {l.unlocked ? '' : '🔒'}</div>
                  <h3>{l.title}</h3>
                  <div className="sub">{l.subtitle}</div>
                  <div className="foot">
                    <span className="theme-tag">{l.theme}</span>
                    {l.quizCompleted
                      ? <span className="badge badge-done">✓ {l.bestQuizScore}/{l.quizTotal}</span>
                      : l.lessonViewed
                        ? <span className="badge badge-progress">In progress</span>
                        : l.unlocked
                          ? <span className="badge badge-progress">Start</span>
                          : <span className="badge badge-lock">Locked</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
