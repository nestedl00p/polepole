// The backoffice. Loaded lazily from App.jsx, so learners never download it.
//
// Hiding this behind user.isAdmin is a convenience, not the protection: every
// /api/admin endpoint checks the account itself on each request.
import { NavLink, Navigate, Route, Routes, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/Logo';
import Overview from './Overview';
import Users from './Users';
import UserDetail from './UserDetail';
import Content from './Content';
import Habit from './Habit';
import System from './System';
import Audit from './Audit';
import './admin.css';

const SECTIONS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/content', label: 'Content' },
  { to: '/admin/habit', label: 'Habit report' },
  { to: '/admin/system', label: 'System' },
  { to: '/admin/audit', label: 'Audit log' },
];

export default function AdminApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="bo">
      <header className="bo-top">
        <Link to="/admin" className="bo-brand">
          <Logo size={28} light />
          <span className="bo-brand-tag">Backoffice</span>
        </Link>
        <div className="bo-top-meta">
          <span className="bo-who">{user.email}</span>
          <Link to="/app" className="btn btn-sm btn-ghost">Back to app</Link>
          <button className="btn btn-sm btn-ghost" onClick={() => { logout(); navigate('/'); }}>Logout</button>
        </div>
      </header>

      <div className="bo-body">
        <nav className="bo-nav" aria-label="Backoffice">
          {SECTIONS.map((s) => (
            <NavLink key={s.to} to={s.to} end={s.end}>{s.label}</NavLink>
          ))}
        </nav>

        <main className="bo-main">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="users" element={<Users />} />
            <Route path="users/:id" element={<UserDetail />} />
            <Route path="content" element={<Content />} />
            <Route path="habit" element={<Habit />} />
            <Route path="system" element={<System />} />
            <Route path="audit" element={<Audit />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
