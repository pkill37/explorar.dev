'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  getCurrentUser,
  exchangeAuthCode,
  removeAuthToken,
  getAuthToken,
  getGitHubOAuthUrl,
  User,
} from '@/lib/worker-api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: () => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const refreshUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      return;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const user = await getCurrentUser();
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Failed to get user:', error);
      removeAuthToken();
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to authenticate',
      });
    }
  }, []);

  const login = useCallback(() => {
    const url = getGitHubOAuthUrl();
    window.location.href = url;
  }, []);

  const logout = useCallback(() => {
    removeAuthToken();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  }, []);

  // Check for auth callback
  useEffect(() => {
    const handleAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Authentication failed',
        }));
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      if (code) {
        try {
          setState((prev) => ({ ...prev, isLoading: true, error: null }));
          const result = await exchangeAuthCode(code);
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
          // Refresh user data
          if (result.user) {
            setState({
              user: result.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            await refreshUser();
          }
        } catch (err) {
          console.error('Auth callback error:', err);
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Authentication failed',
          }));
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
        }
      } else {
        // No code, just check if we have a token
        await refreshUser();
      }
    };

    handleAuthCallback();
  }, [refreshUser]);

  const contextValue: AuthContextValue = {
    ...state,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
