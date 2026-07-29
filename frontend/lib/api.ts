// Wrapper de fetch para a API REST do Painel Convenio.
// Base sempre em process.env.NEXT_PUBLIC_API_URL.

import type {
  ClinicasResponse,
  DashboardResponse,
  FiltrosPendencias,
  HealthResponse,
  ImportarResponse,
  LoginResponse,
  NovaPendencia,
  NovaTratativa,
  NovoUsuario,
  PatchPendencia,
  Pendencia,
  PendenciasResponse,
  Tratativa,
  Usuario,
  UsuarioUpdate,
} from './types';

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'https://api-alchemypet.tudomudou.com.br';

const TOKEN_KEY = 'pc_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;

// Monta querystring ignorando valores vazios/nulos.
function buildQuery(params?: QueryParams): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    sp.append(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

interface RequestOptions {
  method?: string;
  query?: QueryParams;
  body?: unknown;
  // Corpo alternativo para uploads (multipart). Quando presente, body e ignorado.
  formData?: FormData;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, formData, signal } = options;
  const url = `${API_BASE}${path}${buildQuery(query)}`;

  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;

  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: payload, signal });
  } catch (err) {
    // Falha de rede (API fora do ar, DNS, CORS, etc.).
    throw new ApiError(
      'Não foi possível conectar à API. Verifique se o serviço está disponível.',
      0,
    );
  }

  if (res.status === 401 && path !== '/auth/login') {
    // Sessão expirada/inválida: limpa e redireciona ao login.
    clearToken();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new ApiError('Sessão expirada. Faça login novamente.', 401);
  }

  if (!res.ok) {
    let detail = `Erro ${res.status} ao chamar ${path}.`;
    try {
      const data = await res.json();
      if (data && typeof data === 'object') {
        const d = data as { detail?: unknown; message?: unknown };
        if (typeof d.detail === 'string') detail = d.detail;
        else if (typeof d.message === 'string') detail = d.message;
      }
    } catch {
      // corpo nao-JSON; mantem mensagem padrao
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

// ===== Endpoints =====

export const api = {
  health(signal?: AbortSignal): Promise<HealthResponse> {
    return request<HealthResponse>('/health', { signal });
  },

  listPendencias(
    filtros: FiltrosPendencias = {},
    signal?: AbortSignal,
  ): Promise<PendenciasResponse> {
    return request<PendenciasResponse>('/pendencias', {
      query: filtros,
      signal,
    });
  },

  createPendencia(body: NovaPendencia): Promise<Pendencia> {
    return request<Pendencia>('/pendencias', { method: 'POST', body });
  },

  patchPendencia(id: string, body: PatchPendencia): Promise<Pendencia> {
    return request<Pendencia>(`/pendencias/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body,
    });
  },

  deletePendencia(id: string): Promise<void> {
    return request<void>(`/pendencias/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  listTratativas(id: string, signal?: AbortSignal): Promise<Tratativa[]> {
    return request<Tratativa[]>(
      `/pendencias/${encodeURIComponent(id)}/tratativas`,
      { signal },
    );
  },

  createTratativa(id: string, body: NovaTratativa): Promise<Tratativa> {
    return request<Tratativa>(
      `/pendencias/${encodeURIComponent(id)}/tratativas`,
      { method: 'POST', body },
    );
  },

  dashboard(
    filtros: FiltrosPendencias = {},
    signal?: AbortSignal,
  ): Promise<DashboardResponse> {
    // page/per_page nao se aplicam ao dashboard.
    const { page: _page, per_page: _perPage, ...rest } = filtros;
    void _page;
    void _perPage;
    return request<DashboardResponse>('/dashboard', {
      query: rest,
      signal,
    });
  },

  clinicas(modulo: string, signal?: AbortSignal): Promise<ClinicasResponse> {
    return request<ClinicasResponse>('/clinicas', {
      query: { modulo },
      signal,
    });
  },

  // ===== Auth =====
  login(email: string, senha: string): Promise<LoginResponse> {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, senha },
    });
  },

  me(signal?: AbortSignal): Promise<Usuario> {
    return request<Usuario>('/auth/me', { signal });
  },

  // ===== Usuários (admin) =====
  usuarios(signal?: AbortSignal): Promise<Usuario[]> {
    return request<Usuario[]>('/usuarios', { signal });
  },

  createUsuario(body: NovoUsuario): Promise<Usuario> {
    return request<Usuario>('/usuarios', { method: 'POST', body });
  },

  updateUsuario(id: string, body: UsuarioUpdate): Promise<Usuario> {
    return request<Usuario>(`/usuarios/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body,
    });
  },

  importar(file: File, modulo: string): Promise<ImportarResponse> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('modulo', modulo);
    return request<ImportarResponse>('/importar', {
      method: 'POST',
      formData: fd,
    });
  },
};
