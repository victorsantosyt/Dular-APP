import { prisma } from "@/lib/prisma";
import { StatusPill } from "../_components/StatusPill";
import { signGetUrl } from "@/lib/s3Objects";
import { recomputeRiskForUser } from "@/lib/risk";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const NEXT_STATUS = ["EM_ANALISE", "CONFIRMADO", "ENCERRADO"];

async function updateStatus(id: string, status: string) {
  "use server";

  const allowed = ["ABERTO", "EM_ANALISE", "CONFIRMADO", "ENCERRADO"];
  if (!allowed.includes(status)) return;

  const incident = await prisma.incidentReport.update({
    where: { id },
    data: { status: status as any },
  });

  if (status === "CONFIRMADO") {
    await recomputeRiskForUser(incident.reportedUserId);
  }

  revalidatePath(`/admin/incidentes/${id}`);
  revalidatePath(`/admin/incidentes`);
}

export default async function AdminIncidenteDetalhePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  const incident = await prisma.incidentReport.findUnique({
    where: { id },
    include: {
      reportedUser: { select: { id: true, nome: true, telefone: true } },
      reportedBy: { select: { id: true, nome: true, telefone: true } },
      attachments: true,
    },
  });

  if (!incident) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <a href="/admin/incidentes" className="text-sm underline text-gray-700">
          ← Voltar
        </a>
        <div className="mt-4 rounded-2xl border bg-white p-4 text-sm text-red-700">Não encontrado.</div>
      </main>
    );
  }

  const attachments = await Promise.all(
    incident.attachments.map(async (a) => ({
      ...a,
      signedUrl: await signGetUrl(a.key, 120),
    }))
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <a href="/admin/incidentes" className="text-sm underline text-gray-700">
        ← Voltar
      </a>

      <header className="mt-4 rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-extrabold text-gray-900">
                {incident.type} • {incident.severity}
              </h1>
              <StatusPill status={incident.status} />
            </div>

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
              <span>ID: {incident.id}</span>
              <span>Criado: {new Date(incident.createdAt).toLocaleString("pt-BR")}</span>
              {incident.serviceId ? <span>Serviço: {incident.serviceId}</span> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {NEXT_STATUS.map((s) => (
              <form key={s} action={updateStatus.bind(null, incident.id, s)}>
                <button
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 hover:bg-gray-50"
                  type="submit"
                >
                  Marcar {s}
                </button>
              </form>
            ))}
          </div>
        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700">{incident.description}</p>

        <div className="mt-4 grid gap-2 text-sm">
          <div className="rounded-xl bg-gray-50 p-3">
            <div className="text-xs font-bold text-gray-500">Denunciado</div>
            <div className="font-semibold">
              {incident.reportedUser?.nome ||
                incident.reportedUser?.telefone ||
                incident.reportedUser?.id ||
                "—"}
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 p-3">
            <div className="text-xs font-bold text-gray-500">Quem denunciou</div>
            <div className="font-semibold">
              {incident.reportedBy?.nome || incident.reportedBy?.telefone || incident.reportedBy?.id || "—"}
            </div>
          </div>
        </div>
      </header>

      <section className="mt-4 rounded-2xl border bg-white p-5">
        <h2 className="text-sm font-extrabold text-gray-900">Evidências</h2>

        {attachments.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">Nenhuma evidência anexada.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {attachments.map((a) => (
              <a
                key={a.id}
                href={a.signedUrl}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-2xl border bg-gray-50"
              >
                {a.mime.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.signedUrl}
                    alt="Evidência"
                    className="h-40 w-full object-cover group-hover:opacity-95"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center text-xs text-gray-600">
                    Abrir arquivo
                  </div>
                )}
                <div className="p-2 text-xs text-gray-600">
                  {a.mime} • {(a.size / 1024).toFixed(0)} KB
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
