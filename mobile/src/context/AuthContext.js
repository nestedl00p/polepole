import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, clearToken, getToken } from '../api/client';
import { setSpeechCourse } from '../lib/speak';
import { registerForReminders, unregisterReminders } from '../lib/reminders';

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
  if (u?.course) setSpeechCourse(u.course);
  setUser(u);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // True between creating an account from the taster and answering (or
  // skipping) the two questions that follow it. Kept here because the
  // navigator swaps its whole stack the moment `user` is set, and the taster
  // screen that started the flow is gone by then.
  const [onboarding, setOnboarding] = useState(false);

  const loadUser = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.me();
      applyUser(me, setUser);
      syncTimeZone(me, (u) => applyUser(u, setUser));
      // Keep the server's copy of this phone's push token fresh. Never
      // prompts: it only registers if permission was already given.
      registerForReminders();
    } catch {
      await clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleAuth = async (resp) => {
    await setToken(resp.token);
    applyUser(resp.user, setUser);
    syncTimeZone(resp.user, (u) => applyUser(u, setUser));
  };

  const login = async (email, password) => {
    const resp = await api.login({ email, password });
    await handleAuth(resp);
    registerForReminders();
  };

  // `onboard` sends the new learner through the reminder and why questions
  // before the dashboard. Set before the user is, so the navigator never
  // shows the dashboard for a frame in between.
  const register = async (payload, { onboard = false } = {}) => {
    const resp = await api.register({ ...payload, timeZoneId: deviceTimeZone() });
    if (onboard) setOnboarding(true);
    await handleAuth(resp);
  };

  const finishOnboarding = () => setOnboarding(false);

  const logout = async () => {
    // While the token is still valid: this phone stops being where the
    // account's reminders go.
    await unregisterReminders();
    await clearToken();
    setOnboarding(false);
    setUser(null);
  };

  const refreshUser = async () => {
    const me = await api.me();
    setUser(me);
    return me;
  };

  return (
    <AuthContext.Provider value={{ user, loading, onboarding, finishOnboarding, login, register, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
