import React, { createContext, useEffect, useMemo, useState, useContext, ReactNode } from 'react';

import { api } from '../services/api';
import {
  AuthUser,
  clearSession,
  getAuthToken,
  getAuthUser,
  setAuthToken,
  setAuthUser,
} from '../services/authStorage';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  setSession: (token: string, user: AuthUser) => Promise<void>;
  loginWithEmailPassword: (email: string, password: string) => Promise<void>;
  registerWithEmailPassword: (username: string, email: string, password: string) => Promise<void>;
  updateProfile: (payload: { username?: string; email?: string; avatar?: string; bio?: string }) => Promise<AuthUser>;
  requestPasswordReset: (email: string) => Promise<{ resetToken?: string; message: string }>;
  confirmPasswordReset: (token: string, newPassword: string) => Promise<{ message: string }>;
  requestEmailVerification: (email: string) => Promise<{ verificationToken?: string; message: string }>;
  confirmEmailVerification: (token: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [storedUser, storedToken] = await Promise.all([getAuthUser(), getAuthToken()]);
        if (!isMounted) return;
        setUser(storedUser);
        setToken(storedToken);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const setSession = async (newToken: string, newUser: AuthUser) => {
    await Promise.all([setAuthToken(newToken), setAuthUser(newUser)]);
    setToken(newToken);
    setUser(newUser);
  };

  const loginWithEmailPassword = async (email: string, password: string) => {
    const res = await api.post('/users/login', { email, password });
    const { token: newToken, user: newUser } = res.data as { token: string; user: AuthUser };
    await setSession(newToken, newUser);
  };

  const registerWithEmailPassword = async (username: string, email: string, password: string) => {
    const res = await api.post('/users/register', { username, email, password });
    const { token: newToken, user: newUser } = res.data as { token: string; user: AuthUser };
    await setSession(newToken, newUser);
  };

  const updateProfile = async (payload: { username?: string; email?: string; avatar?: string; bio?: string }) => {
    const res = await api.put('/users/me', payload);
    const { user: updatedUser } = res.data as { user: AuthUser };
    await setAuthUser(updatedUser);
    setUser(updatedUser);
    return updatedUser;
  };

  const requestPasswordReset = async (email: string) => {
    const res = await api.post('/users/password-reset/request', { email });
    return res.data as { resetToken?: string; message: string };
  };

  const confirmPasswordReset = async (tokenValue: string, newPassword: string) => {
    const res = await api.post('/users/password-reset/confirm', { token: tokenValue, newPassword });
    return res.data as { message: string };
  };

  const requestEmailVerification = async (email: string) => {
    const res = await api.post('/users/verify-email/request', { email });
    return res.data as { verificationToken?: string; message: string };
  };

  const confirmEmailVerification = async (tokenValue: string) => {
    const res = await api.post('/users/verify-email/confirm', { token: tokenValue });
    const { user: verifiedUser } = res.data as { user: AuthUser };
    await setAuthUser(verifiedUser);
    setUser(verifiedUser);
    return verifiedUser;
  };

  const logout = async () => {
    await clearSession();
    setUser(null);
    setToken(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      setSession,
      loginWithEmailPassword,
      registerWithEmailPassword,
      updateProfile,
      requestPasswordReset,
      confirmPasswordReset,
      requestEmailVerification,
      confirmEmailVerification,
      logout,
    }),
    [user, token, isLoading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
