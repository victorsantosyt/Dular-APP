import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isServiceParticipant } from "../../src/lib/requireAuth";

const SERVICE = {
  clientId: "user-client-1",
  diaristaId: "user-diarista-1",
  montadorId: "user-montador-1",
};

describe("isServiceParticipant", () => {
  it("retorna true para o EMPREGADOR (clientId)", () => {
    assert.equal(isServiceParticipant("user-client-1", SERVICE), true);
  });

  it("retorna true para a DIARISTA (diaristaId)", () => {
    assert.equal(isServiceParticipant("user-diarista-1", SERVICE), true);
  });

  it("retorna true para o MONTADOR (montadorId)", () => {
    assert.equal(isServiceParticipant("user-montador-1", SERVICE), true);
  });

  it("retorna false para usuário aleatório (proteção IDOR)", () => {
    assert.equal(isServiceParticipant("outsider-999", SERVICE), false);
  });

  it("retorna false quando service é null", () => {
    assert.equal(isServiceParticipant("user-client-1", null), false);
  });

  it("retorna false quando service é undefined", () => {
    assert.equal(isServiceParticipant("user-client-1", undefined), false);
  });

  it("clientId válido e demais nulos: empregador continua acessando", () => {
    const svc = { clientId: "c1", diaristaId: null, montadorId: null };
    assert.equal(isServiceParticipant("c1", svc), true);
    assert.equal(isServiceParticipant("outsider", svc), false);
  });

  it("userId null nunca libera acesso, mesmo se ids do serviço forem null", () => {
    const svc = { clientId: "c1", diaristaId: null, montadorId: null };
    assert.equal(isServiceParticipant(null as unknown as string, svc), false);
  });

  it("userId undefined nunca libera acesso", () => {
    const svc = { clientId: "c1", diaristaId: null, montadorId: null };
    assert.equal(isServiceParticipant(undefined as unknown as string, svc), false);
  });

  it("userId string vazia nunca libera acesso", () => {
    const svc = { clientId: "c1", diaristaId: "d1", montadorId: "m1" };
    assert.equal(isServiceParticipant("", svc), false);
  });

  it("userId não-string (number, bool, object) nunca libera acesso", () => {
    const svc = { clientId: "c1", diaristaId: "d1", montadorId: "m1" };
    assert.equal(isServiceParticipant(0 as unknown as string, svc), false);
    assert.equal(isServiceParticipant(123 as unknown as string, svc), false);
    assert.equal(isServiceParticipant(false as unknown as string, svc), false);
    assert.equal(isServiceParticipant({} as unknown as string, svc), false);
  });

  it("service.clientId null não libera acesso para outsider", () => {
    const svc = { clientId: null as unknown as string, diaristaId: "d1", montadorId: "m1" };
    assert.equal(isServiceParticipant("outsider", svc), false);
    assert.equal(isServiceParticipant("d1", svc), true);
  });

  it("service.diaristaId null não libera acesso para outsider", () => {
    const svc = { clientId: "c1", diaristaId: null, montadorId: "m1" };
    assert.equal(isServiceParticipant("outsider", svc), false);
    assert.equal(isServiceParticipant("c1", svc), true);
  });

  it("service.montadorId null não libera acesso para outsider", () => {
    const svc = { clientId: "c1", diaristaId: "d1", montadorId: null };
    assert.equal(isServiceParticipant("outsider", svc), false);
    assert.equal(isServiceParticipant("c1", svc), true);
  });

  it("service.diaristaId string vazia não casa com userId string vazia", () => {
    const svc = { clientId: "", diaristaId: "", montadorId: "" };
    assert.equal(isServiceParticipant("", svc), false);
    assert.equal(isServiceParticipant("anyone", svc), false);
  });

  it("usuário desconhecido bloqueado mesmo com diaristaId/montadorId undefined", () => {
    const svc = { clientId: "c1", diaristaId: undefined, montadorId: undefined };
    assert.equal(isServiceParticipant("outsider", svc), false);
    assert.equal(isServiceParticipant("c1", svc), true);
  });

  it("não confunde clientId com diaristaId quando ambos existem", () => {
    const svc = {
      clientId: "shared-id",
      diaristaId: "other",
      montadorId: null,
    };
    assert.equal(isServiceParticipant("shared-id", svc), true);
    assert.equal(isServiceParticipant("other", svc), true);
    assert.equal(isServiceParticipant("third", svc), false);
  });
});
