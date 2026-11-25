// Fala com a API do Alchemypet Integrado (o LaborLIS não deixa a página
// chamar outro site; a extensão chama por aqui).
importScripts('config.js');

const API = self.ALCHEMYPET_API;

async function ler(chaves, area = 'local') {
  return chrome.storage[area].get(chaves);
}

async function chamar(caminho, opcoes = {}) {
  const { token } = await ler(['token']);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let r;
  try {
    r = await fetch(API + caminho, { ...opcoes, headers });
  } catch (e) {
    return { erro: `Sem conexão com o Alchemypet Integrado (${API}).` };
  }
  if (r.status === 401) {
    await chrome.storage.local.remove(['token', 'usuario']);
    return { erro: 'Sua sessão expirou. Entre de novo.', deslogado: true };
  }
  let corpo = null;
  try {
    corpo = await r.json();
  } catch (e) {
    corpo = null;
  }
  if (!r.ok) {
    const det = corpo && corpo.detail;
    return { erro: typeof det === 'string' ? det : `Erro ${r.status} no Alchemypet Integrado.` };
  }
  return { ok: true, dados: corpo };
}

const acoes = {
  async estado() {
    const { token, usuario } = await ler(['token', 'usuario']);
    const { pedido } = await ler(['pedido'], 'session');
    return { logado: !!token, usuario: usuario || '', pedido: pedido || null, api: API };
  },
  async login({ email, senha }) {
    await chrome.storage.local.remove(['token', 'usuario']);
    const r = await chamar('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
    if (!r.ok) return r;
    await chrome.storage.local.set({ token: r.dados.access_token, usuario: r.dados.usuario.nome });
    return { ok: true };
  },
  async sair() {
    await chrome.storage.local.remove(['token', 'usuario']);
    await chrome.storage.session.remove(['pedido']);
    return { ok: true };
  },
  async buscar({ numero }) {
    const n = parseInt(String(numero).replace(/\D/g, ''), 10);
    if (!n) return { erro: 'Digite o número do pedido.' };
    const r = await chamar(`/encaminhamentos/numero/${n}/lis`);
    if (r.ok) await chrome.storage.session.set({ pedido: r.dados });
    return r;
  },
  async limpar() {
    await chrome.storage.session.remove(['pedido']);
    return { ok: true };
  },
  async marcar({ lancado }) {
    const { pedido } = await ler(['pedido'], 'session');
    if (!pedido) return { erro: 'Nenhum pedido aberto.' };
    const r = await chamar(`/encaminhamentos/${pedido.id}/lis`, {
      method: 'POST',
      body: JSON.stringify({ lancado }),
    });
    if (!r.ok) return r;
    const d = r.dados.dados || {};
    pedido.lis = { lancado_em: d.lis_lancado_em || '', lancado_por: d.lis_lancado_por || '' };
    await chrome.storage.session.set({ pedido });
    return { ok: true, dados: pedido };
  },
};

chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
  const acao = acoes[msg && msg.acao];
  if (!acao) return false;
  acao(msg).then(responder, (e) => responder({ erro: String(e && e.message ? e.message : e) }));
  return true; // resposta assíncrona
});
