export type AuthBootstrapStatus = "bootstrapping" | "authenticated" | "unauthenticated" | "error";

export type BootstrapFailureKind = "invalid-session" | "transient";

type HttpErrorLike = {
  response?: {
    status?: number;
  };
};

export type BootstrapGateUser = {
  genero?: string | null;
  cpf?: string | null;
  dataNascimento?: string | null;
  servicosOferecidos?: readonly unknown[] | null;
  especialidades?: readonly unknown[] | null;
};

export type AuthenticatedGate = "genero" | "dados-pessoais" | "nichos" | "especialidades" | "home";

/**
 * Apenas 401 e 403 provam que a sessão não pode continuar. Falha sem resposta,
 * timeout e 5xx preservam as credenciais para que o bootstrap possa tentar de
 * novo, sem transformar indisponibilidade de rede em cadastro incompleto.
 */
export function classifyBootstrapFailure(error: unknown): BootstrapFailureKind {
  const status = (error as HttpErrorLike | undefined)?.response?.status;
  return status === 401 || status === 403 ? "invalid-session" : "transient";
}

/**
 * Esta decisão só recebe o usuário canônico de /api/me. O snapshot local nunca
 * é evidência suficiente para mandar uma conta ao fluxo de completar cadastro.
 */
export function getAuthenticatedGate(role: string | null, user: BootstrapGateUser): AuthenticatedGate {
  if (user.genero == null) return "genero";
  if (!user.cpf || !user.dataNascimento) return "dados-pessoais";

  const normalizedRole = role?.toLowerCase();
  if (normalizedRole === "diarista" && (user.servicosOferecidos?.length ?? 0) === 0) {
    return "nichos";
  }
  if (normalizedRole === "montador" && (user.especialidades?.length ?? 0) === 0) {
    return "especialidades";
  }
  return "home";
}
