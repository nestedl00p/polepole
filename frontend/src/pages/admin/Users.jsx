import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Badge, Loading, PageHead, Pager, fmtDate, fmtNum, relTime, useLoad } from './ui';

const PAGE_SIZE = 25;

export default function Users() {
  // Filters live in the URL, so a filtered list survives a refresh, the back
  // button, and being pasted to someone else.
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const search = params.get('search') || '';
  const course = params.get('course') || '';
  const status = params.get('status') || '';
  const sort = params.get('sort') || 'created';
  const page = parseInt(params.get('page') || '1', 10) || 1;

  const [typed, setTyped] = useState(search);

  const set = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  // Search as you type, a beat behind the keys.
  useEffect(() => {
    if (typed === search) return undefined;
    const t = setTimeout(() => set({ search: typed.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed]);

  const state = useLoad(
    () => api.admin.users({ search, course, status, sort, page, pageSize: PAGE_SIZE }),
    [search, course, status, sort, page],
  );

  return (
    <>
      <PageHead title="Users">Find an account, then open it to manage it.</PageHead>

      <div className="bo-filters">
        <input
          className="bo-input bo-search" type="search" value={typed}
          placeholder="Search by name, email or #id" aria-label="Search users"
          onChange={(e) => setTyped(e.target.value)}
        />
        <select className="bo-input" value={course} aria-label="Course" onChange={(e) => set({ course: e.target.value })}>
          <option value="">All courses</option>
          <option value="sw">Learning Swahili</option>
          <option value="en">Learning English</option>
        </select>
        <select className="bo-input" value={status} aria-label="Status" onChange={(e) => set({ status: e.target.value })}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="admin">Admins</option>
        </select>
        <select className="bo-input" value={sort} aria-label="Sort" onChange={(e) => set({ sort: e.target.value === 'created' ? '' : e.target.value })}>
          <option value="created">Newest first</option>
          <option value="seen">Recently seen</option>
          <option value="xp">Most XP</option>
          <option value="streak">Longest streak</option>
          <option value="email">Email A–Z</option>
        </select>
      </div>

      <Loading state={state}>
        {(d) => (
          <>
            <p className="bo-count">
              {fmtNum(d.total)} account{d.total === 1 ? '' : 's'}
              {state.loading && ' · updating…'}
            </p>
            {d.items.length === 0 ? (
              <div className="bo-card bo-empty">No accounts match those filters.</div>
            ) : (
              <div className="bo-card bo-card-flush">
                <div className="bo-scroll">
                  <table className="bo-table bo-table-rows">
                    <thead>
                      <tr>
                        <th>Account</th><th>Course</th><th>Joined</th><th>Last seen</th>
                        <th className="num">Lessons</th><th className="num">Streak</th><th className="num">XP</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.items.map((u) => (
                        <tr key={u.id} onClick={() => navigate(`/admin/users/${u.id}`)}>
                          <td>
                            <Link to={`/admin/users/${u.id}`} onClick={(e) => e.stopPropagation()}>{u.displayName}</Link>
                            <div className="bo-sub">{u.email}</div>
                          </td>
                          <td>{u.courseId === 'en' ? 'English' : 'Swahili'}</td>
                          <td>{fmtDate(u.createdAt)}</td>
                          <td>{relTime(u.lastSeenAt, '—')}</td>
                          <td className="num">{u.lessonsCompleted}</td>
                          <td className="num">{u.streakCount}</td>
                          <td className="num">{fmtNum(u.totalXp)}</td>
                          <td>
                            <span className="bo-badges">
                              {u.isDisabled ? <Badge tone="bad">Suspended</Badge> : <Badge tone="good">Active</Badge>}
                              {u.isAdmin && <Badge tone="info">Admin</Badge>}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <Pager page={d.page} pageSize={d.pageSize} total={d.total} onPage={(p) => set({ page: p > 1 ? String(p) : '' })} />
          </>
        )}
      </Loading>
    </>
  );
}
