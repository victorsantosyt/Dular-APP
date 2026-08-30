"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Clock } from "lucide-react";
import AuthBackground from "@/components/auth/AuthBackground";
import GlassCard from "@/components/auth/GlassCard";
import PillInput from "@/components/auth/PillInput";
import PrimaryButton from "@/components/auth/PrimaryButton";
import LogoDular from "@/components/auth/LogoDular";

/** Códigos que a nossa rota /api/auth/login realmente emite. */
const CODIGOS_DA_API = new Set([
  "bad_request",
  "invalid_credentials",
  "blocked_user",
  "rate_limited",
  "internal_error",
]);

/**
 * A API responde `{ ok:false, error:{ code, message } }` — `error` é OBJETO.
 * Fazer `new Error(j.error)` produzia a mensagem "[object Object]" na tela.
 *
 * Cuidado: nem todo 401 vem da nossa rota. Em deploys de preview protegidos,
 * a própria Vercel intercepta a chamada e devolve 401 com um payload de
 * "Protected deployment" — tratar isso como senha errada mandava o usuário
 * caçar um erro de credencial que não existia.
 */
function mensagemDeErro(payload: unknown, status: number): string {
  const corpo = payload as { error?: unknown; protection?: unknown } | null;
  const erro = corpo?.error;

  if (corpo?.protection) {
    return "Este ambiente de pré-visualização exige login da Vercel. Abra o painel pelo endereço de produção.";
  }

  if (typeof erro === "string") return erro;

  if (erro && typeof erro === "object") {
    const { message, code } = erro as { message?: unknown; code?: unknown };

    if (code === "rate_limited") return "Muitas tentativas. Aguarde um instante e tente de novo.";
    if (typeof code === "string" && CODIGOS_DA_API.has(code)) {
      if (typeof message === "string" && message.trim()) return message;
    }
    // Payload de erro que não é da nossa API (proxy, gateway, protecção):
    // não afirmar que a credencial está errada.
    return `Não foi possível entrar (resposta inesperada do servidor, código ${status}).`;
  }

  if (status === 401) return "Credenciais inválidas.";
  if (status === 403) return "Este usuário está bloqueado.";
  if (status >= 500) return "Erro no servidor. Tente novamente em instantes.";
  return "Não foi possível entrar.";
}

export default function AdminLoginPage() {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [expirou, setExpirou] = useState(false);

  // Lido do window (e não de useSearchParams) para não exigir Suspense.
  useEffect(() => {
    setExpirou(new URLSearchParams(window.location.search).get("sessao") === "expirada");
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // A rota aceita `login` (telefone OU email); `telefone` é só compat.
        body: JSON.stringify({ login: login.trim(), senha }),
      });

      const j = await res.json().catch(() => null);

      if (!res.ok) {
        setErro(mensagemDeErro(j, res.status));
        return;
      }

      window.location.href = "/admin";
    } catch {
      // Só cai aqui em falha de rede — a resposta de erro da API é tratada acima.
      setErro("Sem conexão com o servidor. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthBackground>
      <GlassCard>
        <LogoDular />

        <div className="mt-4 text-center">
          <h1 className="text-lg font-semibold tracking-tight text-fg">Entrar no Painel</h1>
        </div>

        {expirou && !erro ? (
          <div
            role="status"
            className="mt-4 flex items-start gap-2 rounded-2xl border border-border bg-surface-subtle p-3 text-sm text-fg-muted"
          >
            <Clock size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
            <span>Sua sessão expirou por inatividade. Entre novamente.</span>
          </div>
        ) : null}

        {erro ? (
          <div
            role="alert"
            aria-live="polite"
            className="mt-4 flex items-start gap-2 rounded-2xl border border-error/30 bg-error-light p-3 text-sm text-error-dark"
          >
            <AlertCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
            <span>{erro}</span>
          </div>
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate={false}>
          <PillInput
            label="Usuário (telefone ou email)"
            id="login"
            // `name` + `autoComplete` juntos: os gerenciadores de senha
            // dependem dos dois para reconhecer o formulário e oferecer
            // salvar/preencher a credencial.
            name="username"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Telefone ou email"
            autoComplete="username"
            autoFocus
            required
          />
          <PillInput
            label="Senha"
            id="senha"
            name="password"
            type="password"
            revelavel
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          <PrimaryButton disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </PrimaryButton>
        </form>
      </GlassCard>
    </AuthBackground>
  );
}
