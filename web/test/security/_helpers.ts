// Helpers de teste. Token JWT é assinado de verdade com o JWT_SECRET dummy
// injetado pelo script `test:security`. Isso exercita o pipeline real do
// requireAuth sem precisar mockar a verificação.

import { signToken } from "../../src/lib/auth";
import type { JwtPayload } from "../../src/lib/auth";

export type Role = JwtPayload["role"];

export function makeAuthHeaders(userId: string, role: Role): Record<string, string> {
  const token = signToken({ userId, role });
  return { authorization: `Bearer ${token}` };
}

export function jsonRequest(
  url: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}
