import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('swahili_token');
    if (!token) { setLoading(false); return; }
    try {
      const me = await api.me();
      setUser(me);
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
    setUser(resp.user);
  };

  const login = async (email, password) => {
    const resp = await api.login({ email, password });
    handleAuth(resp);
  };

  const register = async (payload) => {
    const resp = await api.register(payload);
    handleAuth(resp);
  };

  const logout = () => {
    localStorage.removeItem('swahili_token');
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
