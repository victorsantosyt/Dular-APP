"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

type Notificacao = {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  servicoId: string | null;
  chatRoomId: string | null;
  readAt: string | null;
  createdAt: string;
};

function tempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [itens, setItens] = useState<Notificacao[] | null>(null);
  const [naoLidas, setNaoLidas] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  async function carregar() {
    try {
      const r = await fetch("/api/notificacoes", { headers: { "Cache-Control": "no-cache" } });
      const j = await r.json().catch(() => null);
      if (j?.ok) {
        setItens(j.notifications ?? []);
        setNaoLidas(j.unreadCount ?? 0);
      } else {
        setItens([]);
      }
    } catch {
      setItens([]);
    }
  }

  // Contagem no badge carrega junto com o painel; a lista só quando abre.
  useEffect(() => {
    carregar();
  }, []);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function marcarTodasComoLidas() {
    setNaoLidas(0);
    setItens((prev) =>
      prev ? prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) : prev,
    );
    try {
      await fetch("/api/notificacoes/ler-todas", { method: "PATCH" });
    } catch {
      /* otimista: o badge volta no próximo carregamento se falhar */
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label={naoLidas > 0 ? `Notificações (${naoLidas} não lidas)` : "Notificações"}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) carregar();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-surface-subtle hover:text-fg"
      >
        <Bell size={18} strokeWidth={1.75} />
        {naoLidas > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-surface">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-[340px] overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <span className="text-sm font-semibold text-fg">Notificações</span>
            {naoLidas > 0 ? (
              <button
                type="button"
                onClick={marcarTodasComoLidas}
                className="text-xs font-semibold text-accent-strong hover:underline"
              >
                Marcar todas como lidas
              </button>
            ) : null}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {itens === null ? (
              <div className="px-4 py-6 text-center text-sm text-fg-subtle">Carregando…</div>
            ) : itens.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="text-sm font-medium text-fg-muted">Nenhuma notificação</div>
                <div className="mt-1 text-xs text-fg-subtle">
                  Avisos da operação aparecem aqui.
                </div>
              </div>
            ) : (
              itens.map((n) => {
                const conteudo = (
                  <>
                    <div className="flex items-start gap-2">
                      {!n.readAt ? (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      ) : (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-fg">{n.title ?? n.type}</div>
                        {n.body ? (
                          <div className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-fg-subtle">
                            {n.body}
                          </div>
                        ) : null}
                        <div className="mt-1 text-[11px] text-fg-disabled">
                          {tempoRelativo(n.createdAt)}
                        </div>
                      </div>
                    </div>
                  </>
                );

                const classe =
                  "block border-b border-border-subtle px-4 py-3 last:border-0 transition-colors hover:bg-surface-subtle";

                return n.servicoId ? (
                  <Link
                    key={n.id}
                    href={`/admin/operacoes/servicos/${n.servicoId}`}
                    className={classe}
                    onClick={() => setOpen(false)}
                  >
                    {conteudo}
                  </Link>
                ) : (
                  <div key={n.id} className={classe}>
                    {conteudo}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
