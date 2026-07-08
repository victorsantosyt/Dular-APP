import { api } from "@/lib/api";

/**
 * Pagamento PIX P2P (empregador → profissional).
 *
 * O backend é a fonte de todos os dados sensíveis: valor (sempre o
 * precoFinal congelado do serviço), chave, TxId e descrição. O app apenas
 * solicita e exibe.
 */

export type PixKeyType = "CPF" | "CELULAR" | "EMAIL" | "ALEATORIA";

export type PaymentStatus =
  | "WAITING_PAYMENT"
  | "PAYMENT_REPORTED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_DISPUTED";

export type PaymentInfoDto = {
  pixType: PixKeyType;
  pixKey: string;
  bank: string | null;
  holderName: string;
  updatedAt: string;
};

export type PixGerado = {
  copiaECola: string;
  valorCentavos: number;
  txid: string;
  profissional: { nome: string };
  chaveMascarada: string;
  tipoChave: PixKeyType;
  banco: string | null;
};

// ── Recebimentos do profissional ─────────────────────────────────────────────

export async function getPaymentInfo(): Promise<PaymentInfoDto | null> {
  const res = await api.get<{ ok: boolean; paymentInfo: PaymentInfoDto | null }>(
    "/api/me/payment-info",
  );
  return res.data.paymentInfo ?? null;
}

export async function salvarPaymentInfo(payload: {
  pixType: PixKeyType;
  pixKey: string;
  bank?: string | null;
  holderName: string;
}): Promise<PaymentInfoDto> {
  const res = await api.put<{ ok: boolean; paymentInfo: PaymentInfoDto }>(
    "/api/me/payment-info",
    payload,
  );
  return res.data.paymentInfo;
}

// ── Fluxo de pagamento do serviço ────────────────────────────────────────────

export async function gerarPix(servicoId: string): Promise<PixGerado> {
  const res = await api.post<{ ok: boolean; pix: PixGerado }>(
    `/api/servicos/${servicoId}/pix`,
  );
  return res.data.pix;
}

/** Auditoria "PIX copiado" — best-effort, nunca bloqueia a UX. */
export async function registrarPixCopiado(servicoId: string): Promise<void> {
  try {
    await api.post(`/api/servicos/${servicoId}/pix/copiado`);
  } catch {
    // trilha de auditoria não pode quebrar a cópia
  }
}

export async function informarPagamento(servicoId: string): Promise<void> {
  await api.post(`/api/servicos/${servicoId}/pagamento/informar`);
}

export async function confirmarRecebimento(servicoId: string): Promise<void> {
  await api.post(`/api/servicos/${servicoId}/pagamento/confirmar`);
}

export async function contestarRecebimento(
  servicoId: string,
  motivo: string,
): Promise<void> {
  await api.post(`/api/servicos/${servicoId}/pagamento/contestar`, { motivo });
}
