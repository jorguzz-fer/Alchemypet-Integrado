'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api, clearToken, getToken, setToken } from './api';
import type { Usuario } from './types';

interface AuthState {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => void;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Ao montar, valida o token existente buscando /auth/me.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setCarregando(false);
      return;
    }
    let ativo = true;
    api
      .me()
      .then((u) => {
        if (ativo) setUsuario(u);
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const r = await api.login(email, senha);
    setToken(r.access_token);
    setUsuario(r.usuario);
  }, []);

  const sair = useCallback(() => {
    clearToken();
    setUsuario(null);
    if (typeof window !== 'undefined') window.location.href = '/login';
  }, []);

  return (
    <AuthCtx.Provider value={{ usuario, carregando, entrar, sair }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
