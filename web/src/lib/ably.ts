import * as Ably from "ably";

// Inicialização LAZY do client REST do Ably — criado no PRIMEIRO uso (runtime),
// nunca no import. Mesmo padrão de prisma/stripe/s3 (getter singleton, SEM
// Proxy). REST (stateless, HTTP) é o correto para funções serverless da Vercel:
// os próximos WARs publicam eventos por requisição HTTP, sem manter conexão
// persistente aberta e sem afetar o build. A ABLY_API_KEY (root) vive apenas no
// backend e nunca é logada.

let restSingleton: Ably.Rest | null = null;

export function getAblyRest(): Ably.Rest {
  if (!restSingleton) {
    const apiKey = process.env.ABLY_API_KEY;
    if (!apiKey) {
      throw new Error("ABLY_API_KEY is not set");
    }
    restSingleton = new Ably.Rest({ key: apiKey });
  }
  return restSingleton;
}

const CHAT_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora — token curto, nunca permanente.

/**
 * Emite um TokenRequest do Ably para o cliente autenticar SEM a root key.
 * Capability MÍNIMA: apenas os canais `chat:{servicoId}` das salas informadas,
 * com `subscribe` + `presence` (nunca publish, nunca wildcard, nunca global).
 * `clientId = userId` fixa a identidade (impede impersonação na presence).
 * Sem salas → capability vazia (nenhum acesso).
 */
export async function createChatTokenRequest(userId: string, servicoIds: string[]) {
  const capability: Record<string, string[]> = Object.fromEntries(
    servicoIds.map((id) => [`chat:${id}`, ["subscribe", "presence"]]),
  );
  return getAblyRest().auth.createTokenRequest({
    clientId: userId,
    capability: JSON.stringify(capability),
    ttl: CHAT_TOKEN_TTL_MS,
  });
}

/**
 * Publica um evento LEVE no canal `chat:{servicoId}` só para acordar os clientes
 * — o banco continua sendo a única fonte da verdade. O payload NÃO transporta
 * conteúdo (sem texto/imagem/localização/usuário): apenas { id, roomId, type }.
 *
 * BEST-EFFORT: qualquer falha do Ably (inclusive ABLY_API_KEY ausente) é apenas
 * logada e engolida. Nunca lança, nunca faz rollback e nunca impede o 201 da
 * mensagem já persistida.
 */
export async function publishChatEvent(
  servicoId: string,
  payload: { id: string; roomId: string; type: string },
): Promise<void> {
  try {
    await getAblyRest().channels.get(`chat:${servicoId}`).publish("new_message", payload);
  } catch (err) {
    console.error("[ably] publishChatEvent falhou (ignorado):", err);
  }
}

// Timeout curto do gate de presença: garante que a checagem NUNCA atrase a
// resposta HTTP nem o realtime. Ao expirar, resolve `false` (fail-open → push
// é enviado). Presence normal responde em dezenas de ms.
const PRESENCE_CHECK_TIMEOUT_MS = 1500;

/**
 * Retorna `true` se `userId` está presente no canal `chat:{servicoId}` (com a
 * sala aberta em tempo real). Usa o client REST já existente e consulta APENAS
 * esse canal; NÃO lê o banco.
 *
 * FAIL-OPEN e não-bloqueante: qualquer erro (inclusive ABLY_API_KEY ausente),
 * rejeição do Ably ou expiração do timeout resolve `false` — ou seja, na dúvida
 * o push é enviado. NUNCA lança.
 */
export async function isUserPresentInRoom(servicoId: string, userId: string): Promise<boolean> {
  try {
    const check = getAblyRest()
      .channels.get(`chat:${servicoId}`)
      .presence.get({ clientId: userId, limit: 100 })
      .then((page) => page.items.some((m) => m.clientId === userId))
      .catch(() => false);
    const timeout = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), PRESENCE_CHECK_TIMEOUT_MS),
    );
    return await Promise.race([check, timeout]);
  } catch {
    return false;
  }
}
