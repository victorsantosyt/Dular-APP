import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { prisma } from "@/lib/prisma";
import {
  ErroDeLoja,
  loja,
  pacoteGooglePlay,
  planoDaSituacao,
  reconhecerCompraGoogle,
  situacaoCompleta,
  tokenDaConta,
  type LojaProvedor,
} from "@/lib/lojas";
import { registrarCompraDaLoja } from "@/lib/trocaDePlano";

/**
 * Google Play (issue #359): reconhecimento das compras, notificações em tempo
 * real (RTDN via Pub/Sub) e o token da conta. A integração só age com
 * `loja.implementada.GOOGLE` ligada; até a homologação, fica desligada.
 */

/**
 * Token da conta gravado ANTES da compra: o app o manda ao Google
 * (`obfuscatedAccountId`), e é por ele que uma notificação de compra que o app
 * não apresentou (o app fechou no meio) chega à conta certa.
 */
export async function garantirTokenDaConta(userId: string): Promise<string> {
  const token = tokenDaConta(userId);
  await prisma.user.updateMany({ where: { id: userId, tokenLoja: null }, data: { tokenLoja: token } });
  return token;
}

/**
 * Reconhece na loja uma compra já concedida e ainda não reconhecida. Sem isso
 * em 3 dias o Google reembolsa e revoga. Falha aqui não desfaz a concessão: o
 * cron tenta de novo dentro do prazo.
 */
export async function reconhecerCompra(provider: LojaProvedor, externalId: string): Promise<boolean> {
  if (provider !== "GOOGLE") return false;
  const compra = await prisma.assinaturaLoja.findUnique({ where: { provider_externalId: { provider, externalId } } });
  if (!compra || compra.reconhecidaEm || !compra.vigente || compra.encerradaEm) return false;
  await reconhecerCompraGoogle(compra.storeProductId, compra.externalId);
  await prisma.assinaturaLoja.updateMany({ where: { id: compra.id, reconhecidaEm: null }, data: { reconhecidaEm: new Date() } });
  return true;
}

/** Cron: compras concedidas ainda sem reconhecimento. Relê a loja antes (pode já estar reconhecida ou ter terminado). */
export async function reconhecerPendentesGoogle(limite = 50): Promise<{ reconhecidas: number; falhas: number }> {
  const resultado = { reconhecidas: 0, falhas: 0 };
  if (!loja.implementada.GOOGLE) return resultado;
  const pendentes = await prisma.assinaturaLoja.findMany({
    where: { provider: "GOOGLE", reconhecidaEm: null, vigente: true, encerradaEm: null },
    orderBy: { createdAt: "asc" },
    take: limite,
    select: { externalId: true },
  });
  for (const { externalId } of pendentes) {
    try {
      // Grava o estado atual e, se a compra segue concedida, reconhece.
      await sincronizarCompraGoogle(externalId);
      const compra = await prisma.assinaturaLoja.findUnique({ where: { provider_externalId: { provider: "GOOGLE", externalId } }, select: { reconhecidaEm: true } });
      if (compra?.reconhecidaEm) resultado.reconhecidas += 1;
    } catch (err) {
      resultado.falhas += 1;
      console.error("[google-play] reconhecimento pendente segue para a próxima rodada:", externalId, (err as Error)?.message);
    }
  }
  return resultado;
}

export type ResultadoSincronizacao =
  | "registrada"
  | "vencida"
  | "de_outra_conta"
  | "pendente"
  | "fora_do_catalogo"
  | "sem_dono"
  | "dono_divergente"
  | "perfil_divergente";

/**
 * Relê a compra no Google e grava o estado ATUAL — nunca o conteúdo da
 * notificação, que pode chegar repetida ou fora de ordem. A conta vem, nesta
 * ordem: da compra já registrada; do token da conta gravado no usuário; da
 * compra vencida que a reassinatura fora do app substitui; da compra anterior
 * ligada (`linkedPurchaseToken`). Sem conta provada, nada é concedido nem
 * reconhecido. Compra não muda de dono.
 */
export async function sincronizarCompraGoogle(purchaseToken: string): Promise<ResultadoSincronizacao> {
  let s;
  try {
    s = await loja.consultar("GOOGLE", purchaseToken);
  } catch (err) {
    if (err instanceof ErroDeLoja && err.codigo === "COMPRA_PENDENTE") return "pendente";
    throw err;
  }
  if (!situacaoCompleta(s) || s.externalId !== purchaseToken) throw new ErroDeLoja("LOJA_INDISPONIVEL", "Resposta incompleta do Google.");
  const plano = planoDaSituacao("GOOGLE", s);
  if (!plano) return "fora_do_catalogo";

  const buscar = (externalId: string) =>
    prisma.assinaturaLoja.findUnique({ where: { provider_externalId: { provider: "GOOGLE", externalId } }, select: { userId: true } });
  let userId = (await buscar(purchaseToken))?.userId ?? null;
  if (!userId && s.dono) userId = (await prisma.user.findUnique({ where: { tokenLoja: s.dono }, select: { id: true } }))?.id ?? null;
  if (!userId && s.compraAnteriorVencida) {
    const anterior = await buscar(s.compraAnteriorVencida);
    if (anterior && (!s.donoAnterior || s.donoAnterior === tokenDaConta(anterior.userId))) userId = anterior.userId;
  }
  if (!userId && s.substitui) userId = (await buscar(s.substitui))?.userId ?? null;
  if (!userId) return "sem_dono";
  // A compra que diz de quem é tem que ser desta conta.
  if (s.dono && s.dono !== tokenDaConta(userId)) return "dono_divergente";

  const usuario = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (usuario?.role !== plano.role) return "perfil_divergente";

  const r = await registrarCompraDaLoja(userId, "GOOGLE", s, plano);
  if (r === "registrada") {
    try {
      await reconhecerCompra("GOOGLE", purchaseToken);
    } catch (err) {
      console.error("[google-play] reconhecimento fica para o cron:", (err as Error)?.message);
    }
  }
  return r;
}

// ── Notificações em tempo real (Pub/Sub push) ───────────────────────────────

/** Chaves públicas do Google para o token OIDC do push. Os testes trocam por chaves locais. */
export const notificacoesGoogle: { chaves: JWTVerifyGetKey | null } = { chaves: null };
let chavesRemotas: JWTVerifyGetKey | null = null;

/**
 * O push é do Pub/Sub da nossa assinatura? Token OIDC assinado pelo Google,
 * emissor do Google, audiência e conta de serviço configuradas, e-mail
 * verificado. A documentação manda conferir e-mail e audiência explicitamente.
 */
export async function autenticarPushGoogle(authorization: string | null): Promise<boolean> {
  const audiencia = process.env.GOOGLE_PLAY_PUSH_AUDIENCE?.trim();
  const conta = process.env.GOOGLE_PLAY_PUSH_SERVICE_ACCOUNT?.trim();
  if (!audiencia || !conta || !authorization?.startsWith("Bearer ")) return false;
  const chaves = notificacoesGoogle.chaves ?? (chavesRemotas ??= createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")));
  try {
    const { payload } = await jwtVerify(authorization.slice("Bearer ".length).trim(), chaves, {
      issuer: ["accounts.google.com", "https://accounts.google.com"],
      audience: audiencia,
      algorithms: ["RS256"],
    });
    return payload.email === conta && payload.email_verified === true;
  } catch {
    return false;
  }
}

export type ResultadoNotificacao = "processada" | "repetida" | "teste" | "ignorada";

type MensagemPubSub = { messageId?: unknown; data?: unknown };

/**
 * Uma mensagem do Pub/Sub. Cada `messageId` é processado uma vez (a falha
 * deixa a mensagem sem `processadaEm`, e a reentrega do Pub/Sub tenta de
 * novo). Pacote diferente do configurado: registrada e ignorada.
 */
export async function processarMensagemGoogle(mensagem: MensagemPubSub): Promise<ResultadoNotificacao> {
  const mensagemId = typeof mensagem.messageId === "string" ? mensagem.messageId : "";
  let notificacao: Record<string, any> | null = null;
  try {
    notificacao = JSON.parse(Buffer.from(String(mensagem.data ?? ""), "base64").toString("utf8"));
  } catch {
    notificacao = null;
  }
  if (!mensagemId || !notificacao || typeof notificacao !== "object") throw new ErroDeLoja("COMPRA_INVALIDA", "Mensagem do Pub/Sub malformada.");

  const assinatura = notificacao.subscriptionNotification;
  const anulada = notificacao.voidedPurchaseNotification;
  const token: string | null =
    typeof assinatura?.purchaseToken === "string"
      ? assinatura.purchaseToken
      : anulada?.productType === 1 && typeof anulada?.purchaseToken === "string"
        ? anulada.purchaseToken
        : null;
  const tipo = notificacao.testNotification
    ? "teste"
    : assinatura
      ? `assinatura:${assinatura.notificationType}`
      : anulada
        ? `anulada:${anulada.refundType}`
        : "outra";

  await prisma.notificacaoLoja.createMany({
    data: [{ provider: "GOOGLE", mensagemId, externalId: token, tipo }],
    skipDuplicates: true,
  });
  const registro = await prisma.notificacaoLoja.findUniqueOrThrow({ where: { provider_mensagemId: { provider: "GOOGLE", mensagemId } } });
  if (registro.processadaEm) return "repetida";

  const concluir = (erro: string | null) =>
    prisma.notificacaoLoja.update({ where: { id: registro.id }, data: { processadaEm: new Date(), erro } });

  if (notificacao.packageName !== pacoteGooglePlay()) {
    await concluir("pacote_divergente");
    return "ignorada";
  }
  if (tipo === "teste") {
    await concluir(null);
    return "teste";
  }
  if (!token) {
    await concluir("sem_assinatura");
    return "ignorada";
  }
  try {
    const r = await sincronizarCompraGoogle(token);
    await concluir(r === "registrada" || r === "vencida" ? null : r);
    return "processada";
  } catch (err) {
    await prisma.notificacaoLoja.update({ where: { id: registro.id }, data: { erro: String((err as Error)?.message ?? err).slice(0, 300) } });
    throw err;
  }
}
