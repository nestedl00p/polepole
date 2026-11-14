import { useState } from 'react';
import { api } from '../../api/client';
import { Badge, Loading, Meter, PageHead, Section, Stat, fmtNum, fmtPct, useLoad } from './ui';

const TONE = { error: 'bad', warning: 'warn' };

export default function Content() {
  const state = useLoad(() => api.admin.content(), []);
  const [picked, setPicked] = useState(null);

  return (
    <>
      <PageHead title="Content">
        What each course contains, how far learners get, and anything in the lesson files that needs fixing.
      </PageHead>

      <Loading state={state}>
        {({ courses }) => {
          const course = courses.find((c) => c.id === picked) || courses[0];
          return (
            <>
              <div className="bo-tabs" role="tablist">
                {courses.map((c) => (
                  <button key={c.id} role="tab" aria-selected={c.id === course.id}
                    className={c.id === course.id ? 'active' : ''} onClick={() => setPicked(c.id)}>
                    {c.flag} {c.title}
                    {c.issues.length > 0 && <Badge tone="warn">{c.issues.length}</Badge>}
                  </button>
                ))}
              </div>

              <div className="bo-stats">
                <Stat label="Learners" value={fmtNum(course.learners)} />
                <Stat label="Lessons" value={fmtNum(course.lessonCount)} />
                <Stat label="Vocabulary" value={fmtNum(course.vocabCount)} note="words and phrases" />
                <Stat label="Quiz questions" value={fmtNum(course.quizCount)} note={`${fmtNum(course.methaliCount)} proverbs`} />
              </div>

              <Section title="File checks" aside={<code>{course.lessonsFile}</code>}>
                {course.issues.length === 0 ? (
                  <p><Badge tone="good">All clear</Badge> No duplicate ids, unanswerable questions or gaps in the lesson order.</p>
                ) : (
                  <ul className="bo-issues">
                    {course.issues.map((issue, i) => (
                      <li key={i}>
                        <Badge tone={TONE[issue.severity] || 'neutral'}>{issue.severity}</Badge>
                        <span>{issue.lessonId != null && <strong>Lesson {issue.lessonId}: </strong>}{issue.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="bo-footnote">
                  Lessons ship inside the app image. To change them, edit <code>backend/SwahiliCourse.Api/Data/{course.lessonsFile}</code> and redeploy.
                </p>
              </Section>

              <Section title="Lessons and how far learners get">
                <div className="bo-scroll">
                  <table className="bo-table">
                    <thead>
                      <tr>
                        <th>Lesson</th><th className="num">Vocab</th><th className="num">Quiz</th>
                        <th className="num">Opened</th><th>Passed (of all learners)</th><th className="num">Avg. best score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {course.lessons.map((l) => (
                        <tr key={l.id}>
                          <td>
                            {l.id}. {l.title}
                            <div className="bo-sub">Week {l.week} · {l.blocks} blocks · {l.xpReward} XP</div>
                          </td>
                          <td className="num">{l.vocab}</td>
                          <td className="num">{l.quiz}</td>
                          <td className="num">{fmtNum(l.viewed)}</td>
                          <td>
                            <Meter ratio={course.learners ? l.completed / course.learners : 0}
                              label={`${fmtNum(l.completed)}${course.learners ? ` · ${fmtPct(l.completed / course.learners)}` : ''}`} />
                          </td>
                          <td className="num">{fmtPct(l.averageScore)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </>
          );
        }}
      </Loading>
    </>
  );
}
