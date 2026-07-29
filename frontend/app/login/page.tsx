'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import CampoSenha from '@/components/CampoSenha';

export default function LoginPage() {
  const { entrar, usuario, carregando } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Já autenticado → vai para a home.
  useEffect(() => {
    if (!carregando && usuario) router.replace('/');
  }, [carregando, usuario, router]);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
      router.replace('/');
    } catch (err) {
      setErro(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível entrar. Verifique a conexão.',
      );
      setEnviando(false);
    }
  }

  return (
    <div className="login-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="login-logo"
        src="/logo-horiz.png"
        alt="Alchemypet"
        width={200}
        height={39}
      />
      <h1>Painel Convênio</h1>
      <p className="login-sub">Entre para gerenciar as pendências de convênio.</p>

      <form onSubmit={submeter}>
        <div className="field">
          <label htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="login-senha">Senha</label>
          <CampoSenha
            id="login-senha"
            autoComplete="current-password"
            value={senha}
            onChange={setSenha}
            required
          />
        </div>

        {erro ? <div className="login-erro">{erro}</div> : null}

        <button
          type="submit"
          className="btn primary"
          style={{ width: '100%', marginTop: 6 }}
          disabled={enviando}
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
