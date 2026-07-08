"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { AlertCircle, CheckCircle2, Copy, Loader2, QrCode } from "lucide-react";

/**
 * Painel de pagamento PIX do serviço (web).
 *
 * EMPREGADOR: botão "Pagar com PIX" (condicional) → modal com QR Code +
 * Copia e Cola + "Já realizei o pagamento" (com confirmação).
 * PROFISSIONAL: quando o pagamento é informado, confirma ou contesta.
 *
 * O frontend apenas solicita — valor, chave, txid e descrição vêm do backend.
 */

type Papel = "EMPREGADOR" | "PROFISSIONAL";
type PaymentStatus =
  | "WAITING_PAYMENT"
  | "PAYMENT_REPORTED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_DISPUTED";

type PixData = {
  copiaECola: string;
  valorCentavos: number;
  txid: string;
  profissional: { nome: string };
  chaveMascarada: string;
  tipoChave: string;
  banco: string | null;
};

type Props = {
  servicoId: string;
  papel: Papel;
  paymentStatus: PaymentStatus;
  valorCentavos: number;
  profissionalNome: string;
  profissionalTemPix: boolean;
  elegivel: boolean;
};

function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getApiError(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const record = data as { error?: unknown };
  if (typeof record.error === "string") return record.error;
  return null;
}

async function post(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(getApiError(data) ?? "Não foi possível concluir.");
  return data;
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-22 border border-dular-stroke bg-white p-5 text-[14px] font-semibold leading-6 text-dular-ink shadow-card">
      {children}
    </div>
  );
}

export function PixPagamentoPanel({
  servicoId,
  papel,
  paymentStatus,
  valorCentavos,
  profissionalNome,
  profissionalTemPix,
  elegivel,
}: Props) {
  const router = useRouter();
  const [modalAberto, setModalAberto] = useState(false);
  const [pix, setPix] = useState<PixData | null>(null);
  const [carregandoPix, setCarregandoPix] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [contestando, setContestando] = useState(false);
  const [motivo, setMotivo] = useState("");

  async function abrirModal() {
    setModalAberto(true);
    setErro(null);
    setCopiado(false);
    setConfirmando(false);
    setCarregandoPix(true);
    try {
      const data = await post(`/api/servicos/${servicoId}/pix`);
      setPix(data.pix as PixData);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Erro ao gerar o PIX.");
    } finally {
      setCarregandoPix(false);
    }
  }

  async function copiarCodigo() {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.copiaECola);
      setCopiado(true);
      // Auditoria "PIX copiado" — best-effort, não bloqueia a UX.
      void fetch(`/api/servicos/${servicoId}/pix/copiado`, { method: "POST" }).catch(
        () => {},
      );
    } catch {
      setErro("Não foi possível copiar. Selecione o código manualmente.");
    }
  }

  async function informarPagamento() {
    setEnviando(true);
    setErro(null);
    try {
      await post(`/api/servicos/${servicoId}/pagamento/informar`);
      setModalAberto(false);
      router.refresh();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Erro ao informar o pagamento.");
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarRecebimento() {
    setEnviando(true);
    setErro(null);
    try {
      await post(`/api/servicos/${servicoId}/pagamento/confirmar`);
      router.refresh();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Erro ao confirmar.");
    } finally {
      setEnviando(false);
    }
  }

  async function contestarRecebimento() {
    if (motivo.trim().length < 3) {
      setErro("Descreva o motivo (ex.: valor não caiu na conta).");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await post(`/api/servicos/${servicoId}/pagamento/contestar`, {
        motivo: motivo.trim(),
      });
      router.refresh();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Erro ao contestar.");
    } finally {
      setEnviando(false);
    }
  }

  const erroBanner = erro ? (
    <div className="mt-3 flex items-start gap-2 rounded-16 border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{erro}</span>
    </div>
  ) : null;

  // ── Visão do PROFISSIONAL ──────────────────────────────────────────────────
  if (papel === "PROFISSIONAL") {
    if (paymentStatus === "PAYMENT_CONFIRMED") {
      return (
        <InfoCard>
          <span className="inline-flex items-center gap-2 text-dular-green-deep">
            <CheckCircle2 size={18} /> Recebimento confirmado.
          </span>
        </InfoCard>
      );
    }
    if (paymentStatus === "PAYMENT_DISPUTED") {
      return (
        <InfoCard>
          Você informou que ainda não recebeu. Combine com o empregador pelo chat —
          ele pode gerar o PIX novamente.
        </InfoCard>
      );
    }
    if (paymentStatus === "PAYMENT_REPORTED") {
      return (
        <InfoCard>
          <p>O empregador informou que realizou o pagamento.</p>
          <p className="mt-1 text-[13px] font-medium text-dular-sub">
            Valor do serviço: {formatBRL(valorCentavos)}
          </p>
          {contestando ? (
            <div className="mt-4">
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Conte o que aconteceu (ex.: o valor não caiu na conta)."
                className="w-full rounded-16 border border-dular-stroke bg-dular-bg px-4 py-3 text-[14px] font-medium text-dular-ink outline-none focus:border-dular-green"
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setContestando(false)}
                  disabled={enviando}
                  className="h-[46px] flex-1 rounded-16 border border-dular-stroke bg-white text-[14px] font-bold text-dular-ink"
                >
                  Voltar
                </button>
                <button
                  onClick={contestarRecebimento}
                  disabled={enviando}
                  className="h-[46px] flex-1 rounded-16 bg-red-600 text-[14px] font-black text-white disabled:opacity-60"
                >
                  {enviando ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Enviar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              <button
                onClick={confirmarRecebimento}
                disabled={enviando}
                className="h-[46px] flex-1 rounded-16 bg-dular-green text-[14px] font-black text-white disabled:opacity-60"
              >
                {enviando ? (
                  <Loader2 size={16} className="mx-auto animate-spin" />
                ) : (
                  "Confirmar recebimento"
                )}
              </button>
              <button
                onClick={() => setContestando(true)}
                disabled={enviando}
                className="h-[46px] flex-1 rounded-16 border border-dular-stroke bg-white text-[14px] font-bold text-dular-ink"
              >
                Ainda não recebi
              </button>
            </div>
          )}
          {erroBanner}
        </InfoCard>
      );
    }
    return (
      <InfoCard>
        Aguardando pagamento do empregador.
        {!profissionalTemPix ? (
          <p className="mt-2 text-[13px] font-semibold text-red-700">
            Você ainda não cadastrou sua chave PIX — cadastre em Recebimentos para
            poder receber.
          </p>
        ) : null}
      </InfoCard>
    );
  }

  // ── Visão do EMPREGADOR ────────────────────────────────────────────────────
  if (!elegivel) {
    return <InfoCard>O pagamento fica disponível após a contratação do serviço.</InfoCard>;
  }
  if (paymentStatus === "PAYMENT_CONFIRMED") {
    return (
      <InfoCard>
        <span className="inline-flex items-center gap-2 text-dular-green-deep">
          <CheckCircle2 size={18} /> Pagamento confirmado pelo profissional.
        </span>
      </InfoCard>
    );
  }
  if (paymentStatus === "PAYMENT_REPORTED") {
    return (
      <InfoCard>
        Você informou o pagamento. Aguardando a confirmação de {profissionalNome}.
      </InfoCard>
    );
  }
  if (!profissionalTemPix) {
    return (
      <InfoCard>
        {profissionalNome} ainda não cadastrou uma chave PIX. Combine o pagamento
        pelo chat.
      </InfoCard>
    );
  }

  return (
    <>
      <InfoCard>
        {paymentStatus === "PAYMENT_DISPUTED" ? (
          <p className="mb-3 text-[13px] font-semibold text-red-700">
            O profissional informou que ainda não recebeu. Verifique o pagamento e,
            se necessário, pague novamente.
          </p>
        ) : null}
        <p className="text-[13px] font-medium text-dular-sub">Pagamento</p>
        <p className="mt-1">
          {profissionalNome} · <span className="font-black">{formatBRL(valorCentavos)}</span>
        </p>
        <button
          onClick={abrirModal}
          className="mt-4 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-16 bg-dular-green text-[15px] font-black text-white shadow-card active:scale-[0.99]"
        >
          <QrCode size={18} /> Pagar com PIX
        </button>
        {!modalAberto ? erroBanner : null}
      </InfoCard>

      {modalAberto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur">
          <div className="max-h-[92vh] w-full max-w-[400px] overflow-y-auto rounded-22 bg-white p-5 shadow-float">
            <h2 className="text-[17px] font-black text-dular-ink">Pagamento via PIX</h2>

            {carregandoPix ? (
              <div className="flex items-center justify-center py-14 text-dular-sub">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : pix ? (
              <>
                <div className="mt-3 rounded-16 bg-dular-bg px-4 py-3 text-[13px] font-semibold text-dular-ink">
                  <p>
                    Profissional:{" "}
                    <span className="font-black">{pix.profissional.nome}</span>
                  </p>
                  <p className="mt-1">
                    Valor:{" "}
                    <span className="font-black text-dular-green-deep">
                      {formatBRL(pix.valorCentavos)}
                    </span>
                  </p>
                  {pix.banco ? <p className="mt-1 text-dular-sub">Banco: {pix.banco}</p> : null}
                </div>

                <div className="mx-auto mt-4 w-fit rounded-16 border border-dular-stroke bg-white p-3">
                  <QRCode value={pix.copiaECola} size={196} />
                </div>

                <p className="mt-3 break-all rounded-16 border border-dular-stroke bg-dular-bg px-3 py-2 text-[11px] font-medium leading-4 text-dular-sub">
                  {pix.copiaECola}
                </p>

                <button
                  onClick={copiarCodigo}
                  className="mt-3 inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-16 border border-dular-stroke bg-white text-[14px] font-bold text-dular-ink"
                >
                  <Copy size={16} />
                  {copiado ? "Código copiado!" : "Copiar código"}
                </button>

                {confirmando ? (
                  <div className="mt-3 rounded-16 border border-dular-stroke bg-dular-bg p-4">
                    <p className="text-[14px] font-bold text-dular-ink">
                      Confirma que realizou o pagamento?
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setConfirmando(false)}
                        disabled={enviando}
                        className="h-[44px] flex-1 rounded-16 border border-dular-stroke bg-white text-[14px] font-bold text-dular-ink"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={informarPagamento}
                        disabled={enviando}
                        className="h-[44px] flex-1 rounded-16 bg-dular-green text-[14px] font-black text-white disabled:opacity-60"
                      >
                        {enviando ? (
                          <Loader2 size={16} className="mx-auto animate-spin" />
                        ) : (
                          "Confirmar"
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmando(true)}
                    className="mt-3 inline-flex h-[46px] w-full items-center justify-center rounded-16 bg-dular-green text-[14px] font-black text-white"
                  >
                    Já realizei o pagamento
                  </button>
                )}
              </>
            ) : null}

            {erroBanner}

            <button
              onClick={() => setModalAberto(false)}
              className="mt-3 h-[44px] w-full rounded-16 text-[13px] font-bold text-dular-sub"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
