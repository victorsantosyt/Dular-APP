"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import AuthBackground from "@/components/auth/AuthBackground";
import GlassCard from "@/components/auth/GlassCard";
import PillInput from "@/components/auth/PillInput";
import PrimaryButton from "@/components/auth/PrimaryButton";
import LogoDular from "@/components/auth/LogoDular";

/**
 * A API responde `{ ok:false, error:{ code, message } }` — `error` é OBJETO.
 * Fazer `new Error(j.error)` produzia a mensagem "[object Object]" na tela.
 */
function mensagemDeErro(payload: unknown, status: number): string {
  const erro = (payload as { error?: unknown } | null)?.error;

  if (typeof erro === "string") return erro;
  if (erro && typeof erro === "object") {
    const { message, code } = erro as { message?: unknown; code?: unknown };
    if (typeof message === "string" && message.trim()) return message;
    if (code === "rate_limited") return "Muitas tentativas. Aguarde um instante.";
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
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Telefone ou email"
            autoComplete="username"
            autoFocus
            required
          />
          <PillInput
            label="Senha"
            type="password"
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
