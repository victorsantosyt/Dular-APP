export const AUTH_ROUTES = {
  ROLE_SELECT: "RoleSelect",
  OAUTH_LOGIN: "OAuthLogin",
} as const;

export const TAB_ROUTES = {
  HOME: "Home",
  SOLICITACOES: "Solicitações",
  CARTEIRA: "Carteira",
  PERFIL: "Perfil",
} as const;

export const EMPREGADOR_STACK_ROUTES = {
  HOME: "EmpregadorHome",
  MINHAS: "EmpregadorMinhas",
  DETALHE: "EmpregadorDetalhe",
  PERFIL: "EmpregadorPerfil",
  CHAT: "ChatAberto",
} as const;

export const DIARISTA_STACK_ROUTES = {
  SOLICITACOES: "DiaristaSolicitacoes",
  DETALHE: "DiaristaDetalhe",
  CHAT: "ChatAberto",
} as const;

export const PERFIL_STACK_ROUTES = {
  PERFIL_HOME: "PerfilHome",
  EDIT_DADOS: "EditDados",
  VERIFICACAO_DOCS: "VerificacaoDocs",
  EDIT_BAIRROS: "EditBairros",
  EDIT_DISPONIBILIDADE: "EditDisponibilidade",
  EDIT_PRECOS: "EditPrecos",
  ALTERAR_SENHA: "AlterarSenha",
  SUPORTE: "Suporte",
  TERMOS: "Termos",
  PRIVACIDADE: "Privacidade",
  REPORT_INCIDENT: "ReportIncident",
  SEGURANCA: "Seguranca",
} as const;

export type TabRouteName = (typeof TAB_ROUTES)[keyof typeof TAB_ROUTES];
