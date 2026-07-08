import type { PixKeyType } from "@prisma/client";

/**
 * Validação e normalização de chaves PIX por tipo. O backend é a fonte da
 * verdade: o frontend usa as mesmas regras apenas para feedback imediato.
 */

/** Validação de CPF com dígitos verificadores (mesmo algoritmo do /api/me/profile). */
export function validarCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calc = (mod: number) => {
    let sum = 0;
    for (let i = 0; i < mod - 1; i++) {
      sum += Number(digits[i]) * (mod - i);
    }
    const rem = (sum * 10) % 11;
    return rem === 10 || rem === 11 ? 0 : rem;
  };

  return calc(10) === Number(digits[9]) && calc(11) === Number(digits[10]);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// EVP (chave aleatória) é um UUID emitido pelo banco central.
const EVP_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PixKeyNormalizada =
  | { ok: true; key: string }
  | { ok: false; error: string };

/**
 * Normaliza a chave para o formato usado no BR Code:
 * CPF → 11 dígitos; CELULAR → +55DDDNÚMERO; EMAIL → minúsculas; ALEATORIA → UUID.
 */
export function normalizarChavePix(
  tipo: PixKeyType,
  chaveRaw: string,
): PixKeyNormalizada {
  const chave = chaveRaw.trim();
  if (!chave) return { ok: false, error: "Informe a chave PIX." };

  switch (tipo) {
    case "CPF": {
      const digits = chave.replace(/\D/g, "");
      if (!validarCPF(digits)) return { ok: false, error: "CPF inválido." };
      return { ok: true, key: digits };
    }
    case "CELULAR": {
      // Aceita com ou sem +55; normaliza para E.164 (+55DDDNÚMERO),
      // formato de chave celular do arranjo PIX.
      let digits = chave.replace(/\D/g, "");
      if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
      if (digits.length < 10 || digits.length > 11) {
        return { ok: false, error: "Celular inválido. Use DDD + número." };
      }
      return { ok: true, key: `+55${digits}` };
    }
    case "EMAIL": {
      const email = chave.toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 77) {
        return { ok: false, error: "Email inválido." };
      }
      return { ok: true, key: email };
    }
    case "ALEATORIA": {
      if (!EVP_RE.test(chave)) {
        return {
          ok: false,
          error: "Chave aleatória inválida. Copie a chave exata do seu banco.",
        };
      }
      return { ok: true, key: chave.toLowerCase() };
    }
  }
}
