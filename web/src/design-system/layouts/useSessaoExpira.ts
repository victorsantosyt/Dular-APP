"use client";

import { useEffect, useRef } from "react";

/** Painel administrativo mostra KYC e dados pessoais — não deve ficar aberto
 *  indefinidamente numa máquina destravada. */
export const MINUTOS_INATIVIDADE = 30;

const EVENTOS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const;

export async function encerrarSessao(motivo?: "expirada") {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* mesmo sem rede, tira o usuário da tela */
  }
  window.location.href = motivo ? `/admin/login?sessao=${motivo}` : "/admin/login";
}

/**
 * Encerra a sessão após inatividade. O cookie continua valendo 7 dias no
 * servidor — este é o corte por ociosidade na máquina, não a expiração do JWT.
 */
export function useSessaoExpira(minutos = MINUTOS_INATIVIDADE) {
  const prazo = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const limite = minutos * 60 * 1000;

    function reiniciar() {
      if (prazo.current) clearTimeout(prazo.current);
      prazo.current = setTimeout(() => encerrarSessao("expirada"), limite);
    }

    // `passive`: são listeners de alta frequência e nenhum chama preventDefault.
    EVENTOS.forEach((ev) => window.addEventListener(ev, reiniciar, { passive: true }));
    reiniciar();

    return () => {
      EVENTOS.forEach((ev) => window.removeEventListener(ev, reiniciar));
      if (prazo.current) clearTimeout(prazo.current);
    };
  }, [minutos]);
}
