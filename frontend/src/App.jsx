import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import LessonPage from './pages/LessonPage';
import QuizPage from './pages/QuizPage';
import Flashcards from './pages/Flashcards';
import Settings from './pages/Settings';
import Logo from './components/Logo';

function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <div className="topbar">
      <div className="container inner">
        <Link to="/app" className="brand"><Logo size={30} light /></Link>
        <nav>
          <Link to="/app">Dashboard</Link>
          <Link to="/flashcards">Flashcards</Link>
          <Link to="/settings">Settings</Link>
          <span className="pill">🔥 <span className="streak">{user.streakCount}</span></span>
          <span className="pill">⭐ {user.totalXp} XP</span>
          <button className="btn btn-sm btn-ghost" onClick={() => { logout(); navigate('/'); }}>
            Logout
          </button>
        </nav>
      </div>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={user ? <Navigate to="/app" /> : <AuthPage />} />
        <Route path="/app" element={<Protected><Dashboard /></Protected>} />
        <Route path="/lesson/:id" element={<Protected><LessonPage /></Protected>} />
        <Route path="/lesson/:id/quiz" element={<Protected><QuizPage /></Protected>} />
        <Route path="/flashcards" element={<Protected><Flashcards /></Protected>} />
        <Route path="/settings" element={<Protected><Settings /></Protected>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}
