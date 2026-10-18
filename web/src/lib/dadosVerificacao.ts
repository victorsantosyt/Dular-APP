import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Dados cadastrais usados na conferência documental. Os mesmos campos servem à
 * fotografia gravada em cada envio (`DocumentVerification.dadosEnviados`) e ao
 * "Cadastro atual" do painel — é isso que permite apontar o que mudou depois.
 *
 * Campo ausente fica `null`: o painel mostra "Não informado". Nada é deduzido
 * nem preenchido a partir de outro campo.
 */
export type DadosCadastrais = {
  perfil: string | null;
  nomeExibicao: string | null;
  nomeCompleto: string | null;
  cpf: string | null;
  dataNascimento: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
};

export type DadosEnviados = DadosCadastrais & { versao: 1; capturadoEm: string };

export const CAMPOS_CADASTRAIS: ReadonlyArray<{ chave: keyof DadosCadastrais; rotulo: string }> = [
  { chave: "nomeCompleto", rotulo: "Nome completo" },
  { chave: "nomeExibicao", rotulo: "Nome de exibição" },
  { chave: "cpf", rotulo: "CPF" },
  { chave: "dataNascimento", rotulo: "Data de nascimento" },
  { chave: "email", rotulo: "E-mail" },
  { chave: "telefone", rotulo: "Telefone" },
  { chave: "endereco", rotulo: "Endereço informado" },
  { chave: "perfil", rotulo: "Perfil" },
];

type Db = PrismaClient | Prisma.TransactionClient;

const texto = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

function enderecoEmTexto(e: {
  rua: string; numero: string; complemento: string | null; bairro: string; cidade: string; uf: string; cep: string;
}) {
  const linha1 = [texto(e.rua), texto(e.numero)].filter(Boolean).join(", ");
  const comp = texto(e.complemento);
  return [comp ? `${linha1} - ${comp}` : linha1, texto(e.bairro), `${texto(e.cidade) ?? ""}/${texto(e.uf) ?? ""}`, texto(e.cep) ? `CEP ${texto(e.cep)}` : null]
    .filter((p) => p && p !== "/")
    .join(" · ");
}

function local(bairro: string | null | undefined, cidade: string | null | undefined, uf: string | null | undefined) {
  const partes = [texto(bairro), [texto(cidade), texto(uf)].filter(Boolean).join("/") || null].filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}

/** Cadastro de agora, direto do banco. */
export async function dadosCadastraisAtuais(db: Db, userId: string): Promise<DadosCadastrais | null> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: {
      role: true, nome: true, nomeCompleto: true, cpf: true, dataNascimento: true, email: true, telefone: true,
      enderecos: { orderBy: { updatedAt: "desc" }, take: 1, select: { rua: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true, cep: true } },
      diaristaProfile: { select: { cidade: true, estado: true, bairroAtual: true } },
      montadorPerfil: { select: { cidade: true, estado: true, bairroAtual: true } },
      empregadorPerfil: { select: { cidade: true, estado: true, bairroAtual: true } },
    },
  });
  if (!u) return null;
  const perfil = u.diaristaProfile ?? u.montadorPerfil ?? u.empregadorPerfil;
  return {
    perfil: u.role ?? null,
    nomeExibicao: texto(u.nome),
    nomeCompleto: texto(u.nomeCompleto),
    cpf: texto(u.cpf),
    dataNascimento: u.dataNascimento ? u.dataNascimento.toISOString().slice(0, 10) : null,
    email: texto(u.email),
    telefone: texto(u.telefone),
    endereco: u.enderecos[0] ? enderecoEmTexto(u.enderecos[0]) : local(perfil?.bairroAtual, perfil?.cidade, perfil?.estado),
  };
}

/** Fotografia para gravar junto do envio. */
export async function fotografarDadosCadastrais(db: Db, userId: string, agora: Date): Promise<DadosEnviados | null> {
  const atuais = await dadosCadastraisAtuais(db, userId);
  return atuais ? { versao: 1, capturadoEm: agora.toISOString(), ...atuais } : null;
}

/** Lê a fotografia gravada; `null` quando o envio é anterior ao campo (não se reconstrói). */
export function lerDadosEnviados(valor: unknown): DadosEnviados | null {
  if (!valor || typeof valor !== "object") return null;
  const v = valor as Record<string, unknown>;
  if (v.versao !== 1 || typeof v.capturadoEm !== "string") return null;
  const campo = (k: keyof DadosCadastrais) => (typeof v[k] === "string" ? (v[k] as string) : null);
  return {
    versao: 1,
    capturadoEm: v.capturadoEm,
    perfil: campo("perfil"),
    nomeExibicao: campo("nomeExibicao"),
    nomeCompleto: campo("nomeCompleto"),
    cpf: campo("cpf"),
    dataNascimento: campo("dataNascimento"),
    email: campo("email"),
    telefone: campo("telefone"),
    endereco: campo("endereco"),
  };
}

/** Campos que mudaram entre o envio e o cadastro de agora. */
export function camposAlterados(enviados: DadosCadastrais | null, atuais: DadosCadastrais | null): Array<keyof DadosCadastrais> {
  if (!enviados || !atuais) return [];
  return CAMPOS_CADASTRAIS.map((c) => c.chave).filter((k) => (enviados[k] ?? null) !== (atuais[k] ?? null));
}
