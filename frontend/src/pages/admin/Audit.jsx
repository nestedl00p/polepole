import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { Loading, PageHead, Pager, fmtDateTime, fmtNum, useLoad } from './ui';

export default function Audit() {
  const [page, setPage] = useState(1);
  const state = useLoad(() => api.admin.audit(page), [page]);

  return (
    <>
      <PageHead title="Audit log">
        Every change made from the backoffice: who, what, to whom, and when. Entries cannot be edited or removed here.
      </PageHead>

      <Loading state={state}>
        {(d) => d.items.length === 0 ? (
          <div className="bo-card bo-empty">Nothing has been changed from the backoffice yet.</div>
        ) : (
          <>
            <p className="bo-count">{fmtNum(d.total)} entr{d.total === 1 ? 'y' : 'ies'}</p>
            <div className="bo-card bo-card-flush">
              <div className="bo-scroll">
                <table className="bo-table">
                  <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Account</th><th>Detail</th></tr></thead>
                  <tbody>
                    {d.items.map((a) => (
                      <tr key={a.id}>
                        <td className="bo-nowrap">{fmtDateTime(a.createdAt)}</td>
                        <td>{a.adminEmail}</td>
                        <td><code>{a.action}</code></td>
                        <td>
                          {a.targetEmail
                            ? (a.action === 'user.delete' ? a.targetEmail : <Link to={`/admin/users/${a.targetUserId}`}>{a.targetEmail}</Link>)
                            : '—'}
                        </td>
                        <td className="muted">{a.detail || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Pager page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
          </>
        )}
      </Loading>
    </>
  );
}
