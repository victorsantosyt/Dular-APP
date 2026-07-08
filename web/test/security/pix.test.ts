import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPixPayload,
  crc16ccitt,
  maskPixKey,
  sanitizeEmvText,
  sanitizeTxid,
} from "../../src/lib/pix";
import { normalizarChavePix, validarCPF } from "../../src/lib/pixKey";

describe("pix — CRC16/CCITT-FALSE", () => {
  it('valor de verificação canônico: crc("123456789") = 29B1', () => {
    assert.equal(crc16ccitt("123456789"), "29B1");
  });
});

describe("pix — EMV BR Code (Copia e Cola)", () => {
  it("reproduz byte a byte o payload de referência (equivalência com pix-utils)", () => {
    // Golden vector: mesma entrada gera exatamente a mesma string que a lib
    // de referência pix-utils (validada contra o parser dela, CRC incluso).
    const esperado =
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-426655440000" +
      "520400005303986540523.505802BR5913FULANO DE TAL6008BRASILIA" +
      "62070503***63049816";
    const obtido = buildPixPayload({
      pixKey: "123e4567-e12b-12d1-a456-426655440000",
      holderName: "FULANO DE TAL",
      city: "BRASILIA",
      amountCents: 2350,
      txid: "",
    });
    assert.equal(obtido, esperado);
  });

  it("CRC final é válido para qualquer payload gerado", () => {
    const payload = buildPixPayload({
      pixKey: "maria@dular.com.br",
      holderName: "Maria José da Silva Santos Oliveira",
      city: "Água Boa",
      amountCents: 15000,
      txid: "cmcs0abc123def456ghi789jk",
      description: "Servico Dular",
    });
    const semCrc = payload.slice(0, -4);
    assert.equal(payload.slice(-4), crc16ccitt(semCrc));
  });

  it("valor vem de centavos inteiros e vira decimal com ponto (campo 54)", () => {
    const payload = buildPixPayload({
      pixKey: "a@b.com",
      holderName: "Nome",
      city: "Cidade",
      amountCents: 15000,
      txid: "t1",
    });
    assert.ok(payload.includes("5406150.00"));
  });

  it("TxId usa o id do serviço (cuid) no campo 62-05", () => {
    const cuid = "cmcs0abc123def456ghi789jk"; // 25 chars, limite do padrão
    const payload = buildPixPayload({
      pixKey: "a@b.com",
      holderName: "Nome",
      city: "Cidade",
      amountCents: 100,
      txid: cuid,
    });
    assert.ok(payload.includes(`62290525${cuid}`));
  });

  it("nome e cidade são sanitizados (sem acento) e truncados (25/15)", () => {
    const payload = buildPixPayload({
      pixKey: "a@b.com",
      holderName: "Maria José da Silva Santos Oliveira",
      city: "São Félix do Araguaia XYZ",
      amountCents: 100,
      txid: "t1",
    });
    assert.ok(payload.includes("5925Maria Jose da Silva Santo"));
    assert.ok(payload.includes("6015Sao Felix do Ar"));
  });

  it("payload é ASCII puro e curto o bastante para QR Code", () => {
    const payload = buildPixPayload({
      pixKey: "+5566999998888",
      holderName: "Ana Çélia Ãöü",
      city: "Água Boa",
      amountCents: 12345,
      txid: "cmcs0abc123def456ghi789jk",
      description: "Serviço açaí",
    });
    assert.match(payload, /^[\x20-\x7e]+$/);
    assert.ok(payload.length < 512);
  });

  it("rejeita valores que não sejam centavos inteiros positivos", () => {
    const base = { pixKey: "a@b.com", holderName: "N", city: "C", txid: "t" };
    assert.throws(() => buildPixPayload({ ...base, amountCents: 0 }));
    assert.throws(() => buildPixPayload({ ...base, amountCents: -100 }));
    assert.throws(() => buildPixPayload({ ...base, amountCents: 150.5 }));
  });

  it("rejeita chave vazia", () => {
    assert.throws(() =>
      buildPixPayload({
        pixKey: "  ",
        holderName: "N",
        city: "C",
        amountCents: 100,
        txid: "t",
      }),
    );
  });
});

describe("pix — sanitizadores", () => {
  it("sanitizeTxid: só alfanumérico, máx 25, vazio vira ***", () => {
    assert.equal(sanitizeTxid("svc-1"), "svc1");
    assert.equal(sanitizeTxid(""), "***");
    assert.equal(sanitizeTxid("a".repeat(40)).length, 25);
  });

  it("sanitizeEmvText remove diacríticos e colapsa espaços", () => {
    assert.equal(sanitizeEmvText("Água  Boa – MT", 15), "Agua Boa MT");
  });

  it("maskPixKey nunca expõe a chave inteira", () => {
    const chave = "maria.jose@gmail.com";
    const mascarada = maskPixKey(chave);
    assert.notEqual(mascarada, chave);
    assert.ok(!mascarada.includes("jose@gmail"));
    assert.ok(mascarada.startsWith("mar"));
    assert.ok(mascarada.endsWith("om"));
  });
});

describe("pixKey — validação e normalização por tipo", () => {
  it("CPF: aceita válido (com máscara) e normaliza para 11 dígitos", () => {
    const r = normalizarChavePix("CPF", "529.982.247-25");
    assert.deepEqual(r, { ok: true, key: "52998224725" });
  });

  it("CPF: rejeita dígito verificador errado e sequência repetida", () => {
    assert.equal(normalizarChavePix("CPF", "529.982.247-24").ok, false);
    assert.equal(normalizarChavePix("CPF", "111.111.111-11").ok, false);
    assert.equal(validarCPF("52998224725"), true);
    assert.equal(validarCPF("52998224724"), false);
  });

  it("CELULAR: normaliza para +55DDDNÚMERO e rejeita curto", () => {
    assert.deepEqual(normalizarChavePix("CELULAR", "(66) 99999-8888"), {
      ok: true,
      key: "+5566999998888",
    });
    assert.deepEqual(normalizarChavePix("CELULAR", "+55 66 99999-8888"), {
      ok: true,
      key: "+5566999998888",
    });
    assert.equal(normalizarChavePix("CELULAR", "9999").ok, false);
  });

  it("EMAIL: normaliza minúsculas e rejeita formato inválido", () => {
    assert.deepEqual(normalizarChavePix("EMAIL", " Maria@Dular.COM.br "), {
      ok: true,
      key: "maria@dular.com.br",
    });
    assert.equal(normalizarChavePix("EMAIL", "sem-arroba").ok, false);
  });

  it("ALEATORIA: exige formato UUID", () => {
    assert.equal(
      normalizarChavePix("ALEATORIA", "123E4567-E12B-12D1-A456-426655440000").ok,
      true,
    );
    assert.equal(normalizarChavePix("ALEATORIA", "nao-e-uuid").ok, false);
  });

  it("chave vazia é rejeitada em todos os tipos", () => {
    for (const tipo of ["CPF", "CELULAR", "EMAIL", "ALEATORIA"] as const) {
      assert.equal(normalizarChavePix(tipo, "   ").ok, false);
    }
  });
});
