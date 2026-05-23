// Stub robusto do S3Client usado pelo produto.
//
// Estratégia em camadas (todas aplicadas):
//  1. Importamos `s3` direto de `src/lib/s3.ts` — a MESMA instância usada
//     por `s3Objects.putObject`. Garante que o patch atinge o módulo
//     correto, mesmo se um bundler/loader duplicar `@aws-sdk/client-s3`
//     em alguma transformação (cenário possível em Node 20 + tsx + CI).
//  2. Patchamos `s3.send` como own-property (instance level).
//  3. Patchamos `Object.getPrototypeOf(s3).send` também (resolução por
//     prototype chain), cobrindo casos onde o método é resolvido via
//     prototype em vez de instance.
//  4. `restoreS3Send` desfaz tudo no `after()`.

import { s3 } from "../../src/lib/s3";

type SendStub = () => Promise<{ $metadata: Record<string, unknown> }>;

let originalInstanceSend: unknown = null;
let originalPrototypeSend: unknown = null;
let stubbed = false;
let callCount = 0;

export function stubS3Send(impl?: SendStub) {
  const inner = impl ?? (async () => ({ $metadata: {} }));
  const wrapped = async (...args: unknown[]) => {
    callCount += 1;
    return inner(...(args as []));
  };
  const fn = wrapped as unknown;

  if (!stubbed) {
    originalInstanceSend = Object.prototype.hasOwnProperty.call(s3, "send")
      ? (s3 as { send: unknown }).send
      : null;
    const proto = Object.getPrototypeOf(s3) as { send: unknown };
    originalPrototypeSend = proto.send;
    stubbed = true;
  }

  (s3 as { send: unknown }).send = fn;
  const proto = Object.getPrototypeOf(s3) as { send: unknown };
  proto.send = fn;
}

export function restoreS3Send() {
  if (!stubbed) return;
  const proto = Object.getPrototypeOf(s3) as { send: unknown };
  proto.send = originalPrototypeSend;
  if (originalInstanceSend === null) {
    delete (s3 as { send?: unknown }).send;
  } else {
    (s3 as { send: unknown }).send = originalInstanceSend;
  }
  stubbed = false;
  originalInstanceSend = null;
  originalPrototypeSend = null;
}

export function s3CallCount(): number {
  return callCount;
}

export function resetS3CallCount() {
  callCount = 0;
}
