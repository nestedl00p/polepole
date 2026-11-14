import { Routes, Route, Navigate, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import DosePage from './pages/DosePage';
import LessonPage from './pages/LessonPage';
import QuizPage from './pages/QuizPage';
import Flashcards from './pages/Flashcards';
import Settings from './pages/Settings';
import TasterPage from './pages/TasterPage';
import { useDoseReminder } from './lib/reminders';
import Logo from './components/Logo';

function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (!user) return null;
  // The taster signs the learner in partway through and then has two more
  // things to ask. A bar full of other places to go would be an exit offered
  // in the middle of that.
  if (pathname === '/try') return null;

  return (
    <header className="topbar">
      <div className="container inner">
        <Link to="/app" className="brand"><Logo size={30} light /></Link>
        {/* One row on a desktop. On a phone the four destinations drop to a
            tab bar along the bottom edge — the same four tabs the phone app
            has — so the header stays a single short row. */}
        <nav className="topbar-links" aria-label="Main">
          {NAV_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/app'}>
              <span className="tab-icon" aria-hidden="true">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-meta">
          <span className="pill">🔥 <span className="streak">{user.streakCount}</span></span>
          <span className="pill">⭐ {user.totalXp} XP</span>
          <button className="btn btn-sm btn-ghost" onClick={() => { logout(); navigate('/'); }}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

const NAV_LINKS = [
  { to: '/app', label: 'Dashboard', icon: '🏠' },
  { to: '/dose', label: 'Dose', icon: '🎯' },
  { to: '/flashcards', label: 'Flashcards', icon: '🃏' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  // The browser's share of the daily reminder; a no-op until the learner has
  // granted notification permission.
  useDoseReminder(user);

  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        {/* The taster comes before any account, so it is not Protected — and it
            keeps the learner through sign-up and the two questions after it. */}
        <Route path="/try" element={<TasterPage />} />
        <Route path="/login" element={user ? <Navigate to="/app" /> : <AuthPage />} />
        <Route path="/app" element={<Protected><Dashboard /></Protected>} />
        <Route path="/dose" element={<Protected><DosePage /></Protected>} />
        <Route path="/lesson/:id" element={<Protected><LessonPage /></Protected>} />
        <Route path="/lesson/:id/quiz" element={<Protected><QuizPage /></Protected>} />
        <Route path="/flashcards" element={<Protected><Flashcards /></Protected>} />
        <Route path="/settings" element={<Protected><Settings /></Protected>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}
