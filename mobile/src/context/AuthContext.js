import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, clearToken, getToken } from '../api/client';
import { setSpeechCourse } from '../lib/speak';

const AuthContext = createContext(null);

// Keep the speech layer pointed at the language this account is learning.
function applyUser(u, setUser) {
  if (u?.course) setSpeechCourse(u.course);
  setUser(u);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.me();
      applyUser(me, setUser);
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
  };

  const login = async (email, password) => {
    const resp = await api.login({ email, password });
    await handleAuth(resp);
  };

  const register = async (payload) => {
    const resp = await api.register(payload);
    await handleAuth(resp);
  };

  const logout = async () => {
    await clearToken();
    setUser(null);
  };

  const refreshUser = async () => {
    const me = await api.me();
    setUser(me);
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
