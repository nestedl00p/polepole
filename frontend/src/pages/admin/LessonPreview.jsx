// One lesson of any course, as a learner on that course sees it — plus the
// quiz with its answers. An account belongs to a single course, so this is how
// an admin reads the other direction. Nothing here records progress.
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { CourseOverride } from '../../context/AuthContext';
import ContentBlock from '../../components/ContentBlock';
import SpeakButton from '../../components/SpeakButton';
import { Badge, Loading, PageHead, Section, useLoad } from './ui';

export default function LessonPreview() {
  const { courseId, id } = useParams();
  const state = useLoad(() => api.admin.lesson(courseId, id), [courseId, id]);
  const back = `/admin/content?course=${encodeURIComponent(courseId)}`;

  return (
    <Loading state={state}>
      {({ course, lesson, previousId, nextId }) => {
        // Vocabulary is stored as {swahili, english}; which side is being
        // learned depends on the course.
        const learnEnglish = course.targetLanguage === 'en';
        const learning = (v) => (learnEnglish ? v.english : v.swahili);
        const known = (v) => (learnEnglish ? v.swahili : v.english);
        const to = (lessonId) => `/admin/content/${course.id}/lessons/${lessonId}`;

        return (
          <>
            <PageHead
              title={`${lesson.id}. ${lesson.title}`}
              actions={
                <>
                  {previousId != null && <Link className="btn btn-sm btn-ghost" to={to(previousId)}>← Previous</Link>}
                  {nextId != null && <Link className="btn btn-sm btn-ghost" to={to(nextId)}>Next →</Link>}
                </>
              }
            >
              <Link to={back}>{course.flag} {course.title}</Link> · Week {lesson.week} · {lesson.theme} · {lesson.xpReward} XP
              {lesson.subtitle && <> — {lesson.subtitle}</>}
            </PageHead>

            {/* key: a builder keeps its own state, which must not carry over
                from one lesson to the next. */}
            <CourseOverride course={course} key={`${course.id}-${lesson.id}`}>
              <div className="lesson-page">
                {lesson.blocks.map((b, i) => (
                  b.type === 'conversation'
                    ? <ConversationOutline key={i} block={b} />
                    : <ContentBlock key={i} block={b} lessonId={lesson.id} />
                ))}

                {lesson.vocabulary?.length > 0 && (
                  <div className="block">
                    <h2>Vocabulary</h2>
                    <div className="vocab-grid mt">
                      {lesson.vocabulary.map((v, i) => (
                        <div className="vocab-chip" key={i}>
                          <div className="vocab-sw-row">
                            <div className="sw">{learning(v)}</div>
                            <SpeakButton text={learning(v)} size="sm" />
                          </div>
                          <div className="en">{known(v)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CourseOverride>

            <Section title="Quiz" aside={`${lesson.quiz.length} questions · answers shown`}>
              {lesson.quiz.length === 0 ? (
                <p><Badge tone="warn">None</Badge> This lesson has no quiz, so it cannot be passed.</p>
              ) : (
                <ol className="bo-quiz">
                  {lesson.quiz.map((q) => (
                    <li key={q.id}>
                      <div>{q.prompt} <span className="bo-sub">#{q.id} · {q.type}</span></div>
                      {q.options?.length > 0 ? (
                        <ul>
                          {q.options.map((o, i) => (
                            <li key={i}>
                              {o} {same(o, q.answer) && <Badge tone="good">answer</Badge>}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div><Badge tone="good">answer</Badge> {q.answer}</div>
                      )}
                      {q.hint && <div className="bo-sub">Hint: {q.hint}</div>}
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          </>
        );
      }}
    </Loading>
  );
}

const same = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

// The role-play is laid out rather than run: a live turn is answered from the
// admin's own course, which may not be this one, and spends their daily turns.
function ConversationOutline({ block }) {
  const s = block.scenario || {};
  return (
    <div className="block">
      <div className="vb cv">
        <div className="vb-title">{block.calloutTitle || 'Conversation practice'}</div>
        {block.intro && <p className="vb-intro">{block.intro}</p>}
        <div className="cv-scene">
          <p>{s.setting}</p>
          <p className="cv-goal"><strong>Goal:</strong> {s.goal}</p>
          {s.role && <p><strong>Partner (given to the model):</strong> {s.role}</p>}
          <p><strong>Opening line:</strong> {s.opening}{s.openingTranslation && <> — <i>{s.openingTranslation}</i></>}</p>
        </div>
        {s.phrases?.length > 0 && (
          <div className="cv-phrases">
            {s.phrases.map((p, i) => (
              <span key={i} className="cv-phrase"><b>{p.swahili}</b> <i>{p.english}</i></span>
            ))}
          </div>
        )}
        <p className="bo-footnote">Shown as an outline — the live role-play runs only in the learner app.</p>
      </div>
    </div>
  );
}
