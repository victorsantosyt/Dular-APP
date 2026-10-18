/** Corpo dos pedidos de decisão do painel (JSON ou formulário). */
export type PedidoDecisao = { id: string; motivo: string; tipo: string; revisao: boolean; esperado: string; motivoCategoria: string; conferencia: unknown };

export async function lerPedidoDeDecisao(req: Request): Promise<PedidoDecisao> {
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      id: texto(body.verificationId) || texto(body.id),
      motivo: texto(body.motivo),
      tipo: texto(body.tipo),
      revisao: body.revisao === true,
      esperado: texto(body.esperado),
      motivoCategoria: texto(body.motivoCategoria),
      conferencia: body.conferencia,
    };
  }
  const data = await req.formData().catch(() => null);
  return {
    id: texto(data?.get("verificationId")) || texto(data?.get("id")),
    motivo: texto(data?.get("motivo")),
    tipo: texto(data?.get("tipo")),
    revisao: data?.get("revisao") === "true",
    esperado: texto(data?.get("esperado")),
    motivoCategoria: texto(data?.get("motivoCategoria")),
    conferencia: (() => { try { return JSON.parse(texto(data?.get("conferencia")) || "null"); } catch { return null; } })(),
  };
}
