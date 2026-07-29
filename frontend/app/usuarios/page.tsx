'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Perfil, Usuario } from '@/lib/types';

const PERFIS: Perfil[] = ['atendente', 'supervisor', 'admin'];

export default function UsuariosPage() {
  const { usuario: atual } = useAuth();
  const [lista, setLista] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [perfil, setPerfil] = useState<Perfil>('atendente');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setLista(await api.usuarios());
    } catch (e) {
      setErro(
        e instanceof ApiError ? e.message : 'Não foi possível carregar os usuários.',
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    setSalvando(true);
    try {
      await api.createUsuario({
        nome: nome.trim(),
        email: email.trim(),
        senha,
        perfil,
      });
      setAviso(`Usuário "${nome.trim()}" criado.`);
      setNome('');
      setEmail('');
      setSenha('');
      setPerfil('atendente');
      await carregar();
    } catch (err) {
      setAviso(
        err instanceof ApiError ? err.message : 'Não foi possível criar o usuário.',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(u: Usuario) {
    try {
      await api.updateUsuario(u.id, { ativo: !u.ativo });
      await carregar();
    } catch (err) {
      setAviso(
        err instanceof ApiError ? err.message : 'Não foi possível atualizar.',
      );
    }
  }

  async function alterarPerfil(u: Usuario, novo: Perfil) {
    try {
      await api.updateUsuario(u.id, { perfil: novo });
      await carregar();
    } catch (err) {
      setAviso(
        err instanceof ApiError ? err.message : 'Não foi possível atualizar.',
      );
    }
  }

  if (atual && atual.perfil !== 'admin') {
    return (
      <div className="page">
        <div className="card" style={{ marginTop: 20 }}>
          Acesso restrito a administradores.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Usuários</h1>
          <div className="lead">Gerencie quem acessa o painel.</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 12 }}>Novo usuário</h4>
        <form onSubmit={criar}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="u-nome">Nome</label>
              <input
                id="u-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="u-email">E-mail</label>
              <input
                id="u-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="u-senha">Senha (mín. 6)</label>
              <input
                id="u-senha"
                type="text"
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="u-perfil">Perfil</label>
              <select
                id="u-perfil"
                value={perfil}
                onChange={(e) => setPerfil(e.target.value as Perfil)}
              >
                {PERFIS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button type="submit" className="btn primary" disabled={salvando}>
              {salvando ? 'Criando…' : 'Criar usuário'}
            </button>
          </div>
        </form>
      </div>

      {aviso ? (
        <div className="card" style={{ marginBottom: 14, fontSize: '.85rem' }}>
          {aviso}
        </div>
      ) : null}

      <div className="tablewrap">
        <div className="tabletools">
          <div className="t-left">
            Usuários <span className="count">{lista.length}</span>
          </div>
        </div>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td className="empty-row" colSpan={5}>
                    <div className="spinner" />
                    Carregando…
                  </td>
                </tr>
              ) : erro ? (
                <tr>
                  <td
                    className="empty-row"
                    colSpan={5}
                    style={{ color: 'var(--erro)' }}
                  >
                    {erro}
                  </td>
                </tr>
              ) : (
                lista.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nome}</td>
                    <td className="nowrap">{u.email || '—'}</td>
                    <td>
                      <select
                        className="gsel"
                        value={u.perfil}
                        disabled={u.id === atual?.id}
                        onChange={(e) =>
                          alterarPerfil(u, e.target.value as Perfil)
                        }
                      >
                        {PERFIS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        className={`badge ${u.ativo ? 'b-ok' : 'b-pend'}`}
                      >
                        <span className="d" />
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="nowrap">
                      <button
                        className="notebtn"
                        disabled={u.id === atual?.id}
                        onClick={() => alternarAtivo(u)}
                      >
                        {u.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
