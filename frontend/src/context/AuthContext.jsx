import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { setSpeechCourse } from '../lib/speak';
import { setAssessCourse } from '../lib/speechAssess';

const AuthContext = createContext(null);

// The device's IANA zone. Streak days are counted in it server-side, so a
// learner practising at 21:00 in Dar es Salaam is credited for that day
// rather than the next one. Unavailable on very old runtimes, where the
// server keeps its UTC default.
function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

// Correct the stored zone when the device disagrees — someone who moves, or
// an account created before the client sent one. Best-effort: a failure here
// must never block signing in.
async function syncTimeZone(u, setUser) {
  const tz = deviceTimeZone();
  if (!tz || !u || u.timeZoneId === tz) return;
  try {
    const updated = await api.updateTimeZone(tz);
    setUser(updated);
  } catch {
    /* keep whatever the server has */
  }
}

// Keep the speech layer pointed at the language this account is learning.
function applyUser(u, setUser) {
  if (u?.course) {
    setSpeechCourse(u.course);
    setAssessCourse(u.course.id);
  }
  setUser(u);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('swahili_token');
    if (!token) { setLoading(false); return; }
    try {
      const me = await api.me();
      applyUser(me, setUser);
      syncTimeZone(me, (u) => applyUser(u, setUser));
    } catch {
      localStorage.removeItem('swahili_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const handleAuth = (resp) => {
    localStorage.setItem('swahili_token', resp.token);
    applyUser(resp.user, setUser);
    syncTimeZone(resp.user, (u) => applyUser(u, setUser));
  };

  const login = async (email, password) => {
    const resp = await api.login({ email, password });
    handleAuth(resp);
  };

  const register = async (payload) => {
    const resp = await api.register({ ...payload, timeZoneId: deviceTimeZone() });
    handleAuth(resp);
  };

  const logout = () => {
    localStorage.removeItem('swahili_token');
    setUser(null);
  };

  const refreshUser = async () => {
    const me = await api.me();
    applyUser(me, setUser);
    return me;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
