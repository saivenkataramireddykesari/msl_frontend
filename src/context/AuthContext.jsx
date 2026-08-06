import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { ROLE_PERMISSIONS } from '../utils/permissionConfig';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('msl_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = useCallback((userData) => {
    setUser(userData);
    localStorage.setItem('msl_user', JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('msl_user');
  }, []);

  const hasPermission = useCallback((permission) => {
    if (!user || !user.role) return false;
    const permissions = ROLE_PERMISSIONS[user.role] || [];
    return permissions.includes(permission);
  }, [user]);

  const canCreateRequest = useCallback(() => {
    return hasPermission('CREATE_REQUEST');
  }, [hasPermission]);

  const value = useMemo(() => ({
    user,
    login,
    logout,
    hasPermission,
    canCreateRequest,
    isAuthenticated: !!user,
  }), [user, login, logout, hasPermission, canCreateRequest]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};