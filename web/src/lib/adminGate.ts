import { NextResponse } from "next/server";
import { requireAuthAtivo } from "@/lib/contaAtiva";
import { requireAdmin } from "@/lib/requireAuth";

/**
 * Porta das rotas administrativas que expõem dado sensível (documentos de
 * verificação, inclusive URLs assinadas) ou decidem sobre ele. Além do token,
 * confere no BANCO que a conta está ativa e que o papel AINDA é ADMIN: quem
 * deixou de ser admin, ou teve a conta bloqueada, perde o acesso na hora — não
 * só quando o token expira.
 */
export async function gateAdmin(req: Request) {
  let auth;
  try {
    auth = await requireAuthAtivo(req);
  } catch {
    return { error: NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 }) } as const;
  }
  try {
    return { auth: await requireAdmin(auth) } as const;
  } catch {
    return { error: NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 }) } as const;
  }
}
