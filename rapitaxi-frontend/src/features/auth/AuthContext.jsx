import { createContext, useContext, useEffect, useState } from 'react';
import { getAuthToken } from '../../lib/apiClient';
import { getStoredUser, login as loginRequest, logout as logoutRequest } from './authService';

const AuthContext = createContext(null);

/**
 * Fuente unica de verdad de la sesion (token + usuario + rol).
 * Cualquier pantalla que necesite saber quien esta logueado o su rol
 * consume este contexto en vez de leer localStorage directamente.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getStoredUser());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!getAuthToken()) setUser(null);
    setIsReady(true);
  }, []);

  const login = async (credentials) => {
    const loggedInUser = await loginRequest(credentials);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = async () => {
    await logoutRequest();
    setUser(null);
  };

  const value = {
    user,
    role: user?.role ?? null,
    isAuthenticated: Boolean(user && getAuthToken()),
    isReady,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de un AuthProvider.');
  return context;
};
