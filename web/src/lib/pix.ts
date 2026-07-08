/**
 * Geração de PIX Copia e Cola (EMV BR Code estático) — Manual de Padrões para
 * Iniciação do PIX (BCB), formato EMV®-QRCPS-MPM.
 *
 * Funções puras, sem I/O: o backend monta o payload com dados do banco
 * (chave do profissional + precoFinal do Servico) e o frontend apenas exibe
 * o texto e o QR Code correspondente. Nenhum valor vem do cliente.
 */

const PIX_GUI = "br.gov.bcb.pix";

/** Tamanhos máximos definidos pelo padrão BR Code. */
const MAX_NAME = 25;
const MAX_CITY = 15;
const MAX_TXID = 25;
const MAX_DESCRIPTION = 40;
const MAX_MERCHANT_ACCOUNT_TEMPLATE = 99;

/**
 * Remove diacríticos e caracteres fora do conjunto aceito pelos bancos no
 * BR Code (ASCII imprimível), preservando maiúsculas/minúsculas do original.
 */
export function sanitizeEmvText(value: string, maxLength: number): string {
  const ascii = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return ascii.slice(0, maxLength);
}

/** TxId: somente [A-Za-z0-9], 1–25 chars; "***" quando ausente (padrão BCB). */
export function sanitizeTxid(value: string): string {
  const clean = value.replace(/[^A-Za-z0-9]/g, "").slice(0, MAX_TXID);
  return clean.length > 0 ? clean : "***";
}

/** Campo EMV TLV: ID (2 dígitos) + tamanho (2 dígitos) + valor. */
function emvField(id: string, value: string): string {
  if (value.length > 99) {
    throw new Error(`Campo EMV ${id} excede 99 caracteres`);
  }
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/**
 * CRC16/CCITT-FALSE (polinômio 0x1021, init 0xFFFF, sem reflexão), exigido
 * pelo campo 63 do BR Code. Calculado sobre o payload incluindo o prefixo
 * "6304" do próprio campo de CRC.
 */
export function crc16ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type PixPayloadInput = {
  /** Chave PIX do recebedor (CPF, celular +55..., email ou aleatória). */
  pixKey: string;
  /** Nome do titular da chave (máx. 25 chars no payload). */
  holderName: string;
  /** Cidade do recebedor (máx. 15 chars no payload). */
  city: string;
  /** Valor em CENTAVOS — sempre Servico.precoFinal, nunca entrada do cliente. */
  amountCents: number;
  /** Identificador de conciliação (campo 62-05) — o ID do Servico. */
  txid: string;
  /** Descrição opcional exibida ao pagador (campo 26-02). */
  description?: string;
};

/**
 * Monta o payload "PIX Copia e Cola". Lança em entrada inválida — as rotas
 * validam antes e estes erros indicam bug, não input do usuário.
 */
export function buildPixPayload(input: PixPayloadInput): string {
  const pixKey = input.pixKey.trim();
  if (!pixKey) throw new Error("Chave PIX vazia");

  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Valor do PIX deve ser um inteiro positivo de centavos");
  }
  const amount = (input.amountCents / 100).toFixed(2);

  const holderName = sanitizeEmvText(input.holderName, MAX_NAME);
  const city = sanitizeEmvText(input.city, MAX_CITY);
  if (!holderName) throw new Error("Nome do titular vazio");
  if (!city) throw new Error("Cidade vazia");

  // Template 26 — Merchant Account Information (GUI + chave + descrição).
  let merchantAccount =
    emvField("00", PIX_GUI) + emvField("01", pixKey);
  const description = input.description
    ? sanitizeEmvText(input.description, MAX_DESCRIPTION)
    : "";
  if (
    description &&
    merchantAccount.length + description.length + 4 <=
      MAX_MERCHANT_ACCOUNT_TEMPLATE
  ) {
    merchantAccount += emvField("02", description);
  }

  const withoutCrc =
    emvField("00", "01") + // Payload Format Indicator
    emvField("26", merchantAccount) +
    emvField("52", "0000") + // Merchant Category Code (não informado)
    emvField("53", "986") + // Moeda: BRL
    emvField("54", amount) +
    emvField("58", "BR") +
    emvField("59", holderName) +
    emvField("60", city) +
    emvField("62", emvField("05", sanitizeTxid(input.txid))) +
    "6304"; // prefixo do CRC entra no cálculo

  return withoutCrc + crc16ccitt(withoutCrc);
}

/**
 * Mascara a chave PIX para logs e telas de terceiros — nunca registrar a
 * chave completa (requisito de segurança do fluxo de pagamento).
 */
export function maskPixKey(pixKey: string): string {
  const key = pixKey.trim();
  if (key.length <= 4) return "****";
  return `${key.slice(0, 3)}${"*".repeat(Math.max(key.length - 5, 3))}${key.slice(-2)}`;
}
