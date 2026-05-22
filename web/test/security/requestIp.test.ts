import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getRequestIp } from "../../src/lib/requestIp";

function makeReq(headers: Record<string, string>): Request {
  return new Request("http://x.test/", { headers });
}

describe("getRequestIp", () => {
  it("extrai o primeiro IPv4 válido de x-forwarded-for", () => {
    const req = makeReq({ "x-forwarded-for": "203.0.113.1, 10.0.0.1, 192.168.1.1" });
    assert.equal(getRequestIp(req), "203.0.113.1");
  });

  it("usa x-real-ip quando x-forwarded-for está ausente", () => {
    const req = makeReq({ "x-real-ip": "198.51.100.42" });
    assert.equal(getRequestIp(req), "198.51.100.42");
  });

  it("retorna 'unknown' quando nenhum header existe", () => {
    const req = makeReq({});
    assert.equal(getRequestIp(req), "unknown");
  });

  it("ignora IPs malformados no x-forwarded-for e pega o próximo válido", () => {
    const req = makeReq({ "x-forwarded-for": "not-an-ip, 999.999.999.999, 8.8.8.8" });
    assert.equal(getRequestIp(req), "8.8.8.8");
  });

  it("rejeita IPv4 com octeto > 255", () => {
    const req = makeReq({ "x-forwarded-for": "256.0.0.1" });
    assert.equal(getRequestIp(req), "unknown");
  });

  it("rejeita string vazia", () => {
    const req = makeReq({ "x-forwarded-for": "" });
    assert.equal(getRequestIp(req), "unknown");
  });

  it("aceita IPv6 compacto válido", () => {
    const req = makeReq({ "x-forwarded-for": "::1" });
    assert.equal(getRequestIp(req), "::1");
  });

  it("aceita IPv6 expandido válido", () => {
    const req = makeReq({ "x-forwarded-for": "2001:db8::1" });
    assert.equal(getRequestIp(req), "2001:db8::1");
  });

  it("rejeita texto arbitrário em x-real-ip", () => {
    const req = makeReq({ "x-real-ip": "DROP TABLE users;" });
    assert.equal(getRequestIp(req), "unknown");
  });

  it("ignora SQL injection-like string no x-forwarded-for", () => {
    const req = makeReq({ "x-forwarded-for": "'; DROP TABLE--, 1.2.3.4" });
    assert.equal(getRequestIp(req), "1.2.3.4");
  });

  it("não estoura tamanho com input gigante", () => {
    const huge = "a".repeat(10_000);
    const req = makeReq({ "x-forwarded-for": huge });
    assert.equal(getRequestIp(req), "unknown");
  });
});
