// Tipos do contrato da API (backend FastAPI) do Painel Convenio.

export type StatusPlanilha = 'pendente' | 'tratativa' | 'concluido';
export type Gestao = 'aberto' | 'andamento' | 'resolvido';

export type Modulo = 'convenio' | 'particular';

// Motivos das pendências (lista fechada; "Observação" exige descrição).
export const MOTIVOS_PENDENCIA = [
  'Confirmar exame',
  'Requisição sem sinalização de exame',
  'Exames não lançados no convênio',
  'Confirmar dados do paciente',
  'Confirmar clínica',
  'Amostra sem requisição',
  'Clínica desativada',
  'Observação',
] as const;
export type MotivoPendencia = (typeof MOTIVOS_PENDENCIA)[number];
export const MOTIVO_OBSERVACAO: MotivoPendencia = 'Observação';

export interface Pendencia {
  id: string;
  modulo: Modulo;
  guia: string;
  paciente: string;
  cod_clinica: string;
  clinica: string;
  motivo: string;
  observacao: string;
  resposta_cliente: string;
  responsavel: string;
  colaborador: string;
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
  // Ausente/vazio = todos os módulos (particular + convênio).
  modulo?: Modulo | '';
  ano?: number | string;
  mes_de?: number | string;
  mes_ate?: number | string;
  status?: StatusPlanilha | '';
  gestao?: Gestao | '';
  clinica?: string;
  responsavel?: string;
  busca?: string;
  // Dia/período pela data do pedido (YYYY-MM-DD).
  data_de?: string;
  data_ate?: string;
  motivo?: string;
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
  por_modulo: TopItem[];
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
  motivo?: MotivoPendencia;
  observacao?: string;
  resposta_cliente?: string;
  responsavel?: string;
  colaborador?: string;
  triagem?: string;
  data_pedido?: string | null;
  data_devolutiva?: string | null;
  gestao?: Gestao;
  status?: StatusPlanilha;
}

// Body para criacao manual (POST /pendencias): motivo obrigatório.
export type NovaPendencia = PendenciaInput & { motivo: MotivoPendencia };

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
  // Período pela data do chamado (YYYY-MM-DD), ambos opcionais.
  data_de?: string;
  data_ate?: string;
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

// ===== Manutenção (admin): limpeza de registros antigos =====

export type AlvoLimpeza = 'chamados' | 'convenio' | 'particular';

export interface LimpezaPrevia {
  data_ate: string;
  incluir_sem_data: boolean;
  chamados: number;
  convenio: number;
  particular: number;
  tratativas: number;
}

export interface LimpezaBody {
  data_ate: string;
  incluir_sem_data: boolean;
  alvos: AlvoLimpeza[];
  confirmacao: string;
}

export interface LimpezaResultado {
  chamados: number;
  convenio: number;
  particular: number;
  tratativas: number;
}


// ===== Relatórios Gerenciais de Qualidade =====

export type TipoRelatorio = 'executivo' | 'completo';

export interface RelatorioQualidade {
  id: string;
  arquivo: string;
  tipo: TipoRelatorio;
  titulo: string;
  periodo: string;
  paginas: number;
  setores: number;
  pontos_atencao: number;
  tamanho_pdf: number;
  enviado_por_nome: string | null;
  created_at: string;
}

export type FiltrosRelatorio = {
  busca?: string;
  tipo?: TipoRelatorio | '';
  ordem?: Ordem;
  page?: number;
  per_page?: number;
};

export interface RelatoriosResponse {
  total: number;
  page: number;
  per_page: number;
  items: RelatorioQualidade[];
}

// ===== CRM (contas, funil e atividades) =====

export type EtapaConta =
  | 'lead'
  | 'distribuicao'
  | 'contratos'
  | 'onboarding'
  | 'cliente_ativo'
  | 'inativo'
  | 'bloqueado';
export type Temperatura = 'fria' | 'morna' | 'quente' | '';
export type UsoConta = 'com' | 'sem' | 'sem_info';

export interface Conta {
  id: string;
  nome: string;
  codigo_pocket: string | null;
  origem: string;
  etapa: EtapaConta;
  etapa_derivada: boolean;
  temperatura: Temperatura;
  regiao: string;
  whatsapp: string;
  email: string;
  cidade: string;
  uf: string;
  vendedor: string;
  captacao: string;
  decisor: boolean | null;
  atendimentos_mes: number | null;
  exames_mes: number | null;
  divide_laboratorio: boolean | null;
  nota_laboratorio: string;
  laboratorios: string[];
  atende_convenio: boolean;
  em_uso: boolean | null;
  qtd_os_periodo: number;
  tem_login_pocket: boolean;
  motivo_encerramento: string;
  ultima_atividade_em: string | null;
}

export interface ContaDetalhe extends Conta {
  responsavel: string;
  convenios: string;
  laboratorios_texto: string;
  onboarding_em: string | null;
  created_at: string | null;
}

export interface ContaInput {
  nome: string;
  whatsapp?: string;
  email?: string;
  cidade?: string;
  uf?: string;
  vendedor?: string;
  captacao?: string;
  temperatura?: Temperatura;
  etapa?: EtapaConta;
  regiao?: string;
  observacao?: string;
}

export type ContaPatch = Partial<{
  nome: string;
  etapa: EtapaConta;
  motivo_encerramento: string;
  temperatura: Temperatura;
  vendedor: string;
  whatsapp: string;
  email: string;
  cidade: string;
  uf: string;
  captacao: string;
  regiao: string;
}>;

export type FiltrosContas = {
  busca?: string;
  etapa?: EtapaConta | '';
  uso?: UsoConta | '';
  regiao?: string;
  vendedor?: string;
  temperatura?: Temperatura;
  ordem?: 'nome' | 'os' | 'atividade' | 'recentes';
  page?: number;
  per_page?: number;
};

export interface ContasResponse {
  total: number;
  page: number;
  per_page: number;
  items: Conta[];
}

export interface EtapaContagem {
  etapa: EtapaConta;
  label: string;
  total: number;
}

export interface CrmFunil {
  total: number;
  etapas: EtapaContagem[];
}

export interface Atividade {
  id: string;
  clinica_id: string;
  tipo: string;
  descricao: string;
  data: string;
  hora: string;
  usuario_id: string | null;
  usuario_nome: string;
  created_at: string;
}

export interface AtividadeInput {
  tipo: string;
  descricao?: string;
  data?: string;
  hora?: string;
}

export interface RankingAtividades {
  data_de: string;
  data_ate: string;
  total: number;
  tipos: string[];
  linhas: { usuario: string; total: number; por_tipo: Record<string, number> }[];
}

export interface CrmContagem {
  label: string;
  total: number;
}

export interface CrmResumo {
  contas: number;
  clientes_pocket: number;
  com_uso: number;
  sem_uso: number;
  uso_sem_info: number;
  clientes_com_dados_de_lead: number;
  os_no_periodo: number;
  portadores: number;
  transferencias: number;
  transferencias_aprovadas: number;
  por_regiao: CrmContagem[];
  por_vendedor: CrmContagem[];
  por_captacao: CrmContagem[];
  concorrentes: CrmContagem[];
}

export interface CrmOpcao {
  valor: string;
  label: string;
}

export interface CrmFiltros {
  regioes: string[];
  vendedores: string[];
  etapas: CrmOpcao[];
  temperaturas: CrmOpcao[];
  tipos_atividade: string[];
}

export interface CrmImportArquivo {
  arquivo: string;
  tipo: string;
  rotulo: string;
  linhas: number;
  criados: number;
  atualizados: number;
  ignorados: number;
  avisos: string[];
}

export interface CrmImportResponse {
  arquivos: CrmImportArquivo[];
}
