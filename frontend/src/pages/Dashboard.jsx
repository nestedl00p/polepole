import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

// The dashboard leads with the Dose, not the course.
//
// It used to open on 31 clickable lesson cards plus two review modes, which put
// a decision between the learner and any action — and made the cheapest useful
// thing in the app (ninety seconds of review) the hardest to find. Now there is
// one primary button, today's lesson named as a single next step beneath it, and
// the full grid folded away for the learner who actually wants to browse.
//
// See docs/DAILY-PRACTICE-LOOP.md.

const WEEK_TITLES = {
  1: 'Foundations',
  2: 'Noun Classes, Numbers & Time',
  3: 'Tenses & Daily Life',
  4: 'Complex Sentences & Culture',
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [dose, setDose] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    Promise.all([
      api.listLessons(),
      // A dose that cannot be built yet is not an error — the hero just points
      // at a lesson instead.
      api.dose().catch(() => null),
    ])
      .then(([lessons, d]) => { setData(lessons); setDose(d); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;
  if (!data) return <div className="container page"><p>Could not load lessons.</p></div>;

  const completed = data.lessons.filter((l) => l.quizCompleted).length;
  const pct = Math.round((completed / data.totalLessons) * 100);

  // Today's lesson: the first one that is open and not yet passed.
  const nextLesson =
    data.lessons.find((l) => l.unlocked && !l.quizCompleted) ??
    data.lessons.filter((l) => l.unlocked).at(-1);

  const doseReady = !!dose && dose.items?.length > 0;

  return (
    <div className="container page">
      <div className="page-head">
        <h1>Karibu, {user.displayName}! 👋</h1>
        <p>Day {data.currentDay} of your {data.planLengthDays}-day plan.</p>
      </div>

      {/* The one primary action on the page. */}
      <div className={`dose-hero ${doseReady ? '' : 'dose-hero-done'}`}>
        <div>
          <div className="dose-kicker">Dose ya leo</div>
          <h2>{doseReady ? `${dose.items.length} items` : 'Nothing due yet'}</h2>
          <div className="dose-hero-sub">
            {doseReady
              ? 'About ninety seconds. One of them you say out loud.'
              : (dose?.message ?? 'Study a lesson and your review queue starts filling.')}
          </div>
        </div>
        {doseReady
          ? <button className="btn btn-gold" onClick={() => navigate('/dose')}>Anza →</button>
          : nextLesson && (
            <button className="btn btn-gold" onClick={() => navigate(`/lesson/${nextLesson.id}`)}>
              Open a lesson →
            </button>
          )}
      </div>

      {/* The lesson is still here and still valuable — it is just no longer what
          the learner has to make a decision about first. */}
      {nextLesson && (
        <div className="card mb next-lesson">
          <div className="row spread">
            <div>
              <div className="next-lesson-kicker">
                {nextLesson.quizCompleted ? 'Last lesson' : 'Somo la leo'} · Day {nextLesson.id}
              </div>
              <strong className="next-lesson-title">{nextLesson.title}</strong>
              <div className="muted next-lesson-sub">{nextLesson.subtitle}</div>
            </div>
            <Link to={`/lesson/${nextLesson.id}`} className="btn btn-ghost btn-sm">
              {nextLesson.lessonViewed ? 'Continue' : 'Start'} →
            </Link>
          </div>
        </div>
      )}

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

      <button
        className="btn btn-ghost btn-sm all-lessons-toggle"
        onClick={() => setShowAll((s) => !s)}
        aria-expanded={showAll}
      >
        {showAll ? 'Hide all lessons' : `All ${data.totalLessons} lessons`}
      </button>

      {showAll && [1, 2, 3, 4].map((w) => {
        const lessons = data.lessons.filter((l) => l.week === w);
        if (!lessons.length) return null;
        return (
          <div className="week-group" key={w}>
            <div className="week-label">
              <h2>Week {w} — {WEEK_TITLES[w]}</h2>
              <div className="line" />
            </div>
            <div className="lesson-grid">
              {lessons.map((l) => (
                <div key={l.id}
                  className={`lesson-card ${l.unlocked ? '' : 'locked'}`}
                  onClick={() => l.unlocked && navigate(`/lesson/${l.id}`)}>
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
