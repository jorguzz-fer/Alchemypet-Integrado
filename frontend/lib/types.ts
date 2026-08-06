// Tipos do contrato da API (backend FastAPI) do Painel Convenio.

export type StatusPlanilha = 'pendente' | 'tratativa' | 'concluido';
export type Gestao = 'aberto' | 'andamento' | 'resolvido';

export type Modulo = 'convenio' | 'triagem';

export interface Pendencia {
  id: string;
  modulo: Modulo;
  guia: string;
  paciente: string;
  cod_clinica: string;
  clinica: string;
  informacao_necessaria: string;
  resposta_cliente: string;
  responsavel: string;
  colaborador: string;
  confirmacao: string;
  triagem: string;
  status: StatusPlanilha;
  gestao: Gestao;
  ano: number | null;
  mes: number | null;
  data_pedido: string | null;
  data_devolutiva: string | null;
  dias_em_aberto: number | null;
  aba: string;
  updated_at: string;
}

export interface Tratativa {
  id: string;
  pendencia_id: string;
  usuario_nome: string | null;
  acao: string;
  gestao: string;
  por_agente: boolean;
  created_at: string;
}

export type Perfil = 'atendente' | 'supervisor' | 'admin';

export interface Usuario {
  id: string;
  nome: string;
  email: string | null;
  perfil: Perfil;
  ativo: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  usuario: Usuario;
}

export interface NovoUsuario {
  nome: string;
  email: string;
  senha: string;
  perfil: Perfil;
}

export interface UsuarioUpdate {
  nome?: string;
  perfil?: Perfil;
  ativo?: boolean;
  senha?: string;
}

export interface HealthResponse {
  status: string;
}

// Filtros compartilhados por /pendencias e /dashboard.
// Definido como type alias (nao interface) para ganhar index signature
// implicita e poder ser passado como querystring (Record<string, ...>).
export type FiltrosPendencias = {
  modulo?: Modulo;
  ano?: number | string;
  mes_de?: number | string;
  mes_ate?: number | string;
  status?: StatusPlanilha | '';
  gestao?: Gestao | '';
  clinica?: string;
  responsavel?: string;
  busca?: string;
  antigas?: boolean;
  abertas?: boolean;
  ordem?: 'prioridade' | 'recentes' | 'antigos';
  page?: number;
  per_page?: number;
};

export type Ordem = 'recentes' | 'antigos';

export interface PendenciasResponse {
  total: number;
  page: number;
  per_page: number;
  items: Pendencia[];
}

export interface PorMes {
  ano: number;
  mes: number;
  pendente: number;
  tratativa: number;
  concluido: number;
}

export interface TopItem {
  nome: string;
  total: number;
}

export interface DashboardResponse {
  total: number;
  pendentes: number;
  tratativa: number;
  concluidas: number;
  taxa_resolucao: number;
  tempo_medio_devolutiva: number | null;
  antigas: number;
  sla_dias: number;
  por_mes: PorMes[];
  top_clinicas: TopItem[];
  top_motivos: TopItem[];
}

export interface ClinicasResponse {
  items: string[];
}

export interface ImportarResponse {
  importados: number;
  abas: number;
  total: number;
}

// Campos editáveis de uma pendência (criação e edição manual).
export interface PendenciaInput {
  modulo?: Modulo;
  guia?: string;
  paciente?: string;
  cod_clinica?: string;
  clinica?: string;
  informacao_necessaria?: string;
  resposta_cliente?: string;
  responsavel?: string;
  colaborador?: string;
  confirmacao?: string;
  triagem?: string;
  data_pedido?: string | null;
  data_devolutiva?: string | null;
  gestao?: Gestao;
  status?: StatusPlanilha;
}

// Body para criacao manual (POST /pendencias): informacao_necessaria obrigatória.
export type NovaPendencia = PendenciaInput & { informacao_necessaria: string };

// Body do PATCH /pendencias/{id}: qualquer subconjunto dos campos.
export type PatchPendencia = PendenciaInput;

// Body do POST /pendencias/{id}/tratativas.
export interface NovaTratativa {
  acao: string;
  gestao?: string;
  usuario_id?: string;
}

// ===== POPs (Controle de POPs) =====

export type TipoPop = 'novo' | 'atualizado';

export interface Pop {
  id: string;
  numero: string;
  nome: string;
  ano: number | null;
  tipo: TipoPop;
  area: string;
  updated_at: string;
}

export interface PopInput {
  numero?: string;
  nome: string;
  ano?: number | null;
  tipo?: TipoPop;
  area?: string;
}

export type FiltrosPop = {
  ano?: number | string;
  tipo?: TipoPop | '';
  area?: string;
  busca?: string;
  ordem?: 'recentes' | 'antigos';
  page?: number;
  per_page?: number;
};

export interface PopsResponse {
  total: number;
  page: number;
  per_page: number;
  items: Pop[];
}

export interface PopAno {
  ano: number | null;
  novos: number;
  atualizados: number;
  total: number;
}

export interface PopDashboardResponse {
  total: number;
  novos: number;
  atualizados: number;
  periodo: string;
  por_ano: PopAno[];
  por_area: TopItem[];
}

export interface PopImportResponse {
  importados: number;
  total: number;
}

// ===== Chamados (recebidos por e-mail) =====

export type Complexidade = 'baixa' | 'media' | 'alta';
export type StatusChamado = 'aberto' | 'resolvido';

export interface Chamado {
  id: string;
  assunto: string;
  remetente: string;
  link_gmail: string;
  texto: string;
  complexidade: string;
  motivo: string;
  status: StatusChamado;
  resposta: string;
  data: string | null;
  updated_at: string;
}

export interface ChamadoInput {
  assunto?: string;
  remetente?: string;
  link_gmail?: string;
  texto?: string;
  complexidade?: string;
  motivo?: string;
  status?: StatusChamado;
  resposta?: string;
  data?: string | null;
}

export type FiltrosChamado = {
  complexidade?: Complexidade | '';
  motivo?: string;
  status?: StatusChamado | '';
  busca?: string;
  ordem?: 'recentes' | 'antigos';
  page?: number;
  per_page?: number;
};

export interface ChamadosResponse {
  total: number;
  page: number;
  per_page: number;
  items: Chamado[];
}

export interface ChamadoDashboardResponse {
  total: number;
  abertos: number;
  resolvidos: number;
  taxa_resolucao: number;
  por_motivo: TopItem[];
  por_complexidade: TopItem[];
}

export interface ChamadoImportResponse {
  importados: number;
  total: number;
}
