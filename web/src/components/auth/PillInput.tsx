"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Adiciona o botão de mostrar/ocultar (só faz sentido em type="password"). */
  revelavel?: boolean;
};

export default function PillInput({ label, id, revelavel, type, ...props }: Props) {
  const gerado = useId();
  const inputId = id ?? gerado;
  const [visivel, setVisivel] = useState(false);

  const mostrarBotao = revelavel && type === "password";
  const tipoEfetivo = mostrarBotao && visivel ? "text" : type;

  return (
    <div className="space-y-1.5">
      {/* htmlFor/id: sem isso, clicar no rótulo não focava o campo. */}
      <label htmlFor={inputId} className="block text-xs font-medium text-fg-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={tipoEfetivo}
          {...props}
          className={[
            "w-full rounded-2xl border border-border bg-surface py-3 pl-4 text-sm text-fg",
            "outline-none placeholder:text-fg-disabled",
            "focus:border-accent focus:ring-2 focus:ring-accent/25",
            mostrarBotao ? "pr-12" : "pr-4",
          ].join(" ")}
        />
        {mostrarBotao ? (
          <button
            type="button"
            onClick={() => setVisivel((v) => !v)}
            aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={visivel}
            // tabIndex -1: o Tab deve ir do campo direto para o botão Entrar,
            // sem parar no olhinho.
            tabIndex={-1}
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-surface-subtle hover:text-fg"
          >
            {visivel ? <EyeOff size={17} strokeWidth={1.75} /> : <Eye size={17} strokeWidth={1.75} />}
          </button>
        ) : null}
      </div>
    </div>
  );
}
