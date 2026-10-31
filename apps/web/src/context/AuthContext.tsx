import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserRole } from '@brightloop/shared';
import { apiClient } from '../api/client';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyName?: string | null;
  taxId?: string | null;
  billingAddress?: string | null;
  creditBalance: string | number;
  isActive: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    fullName: string;
    companyName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await apiClient.get<{ success: boolean; data: { user: UserProfile } }>('/api/auth/me');
      if (res.data.success && res.data.data.user) {
        setUser(res.data.data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email: string, password: string) => {
    await apiClient.post('/api/auth/login', { email, password });
    await fetchCurrentUser();
  };

  const register = async (payload: {
    email: string;
    password: string;
    fullName: string;
    companyName?: string;
  }) => {
    await apiClient.post('/api/auth/register', payload);
    await fetchCurrentUser();
  };

  const logout = async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refetchUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
