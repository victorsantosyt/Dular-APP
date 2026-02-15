"use client";

import { useState } from "react";
import AuthBackground from "@/components/auth/AuthBackground";
import GlassCard from "@/components/auth/GlassCard";
import PillInput from "@/components/auth/PillInput";
import PrimaryButton from "@/components/auth/PrimaryButton";
import LogoDular from "@/components/auth/LogoDular";

export default function AdminLoginPage() {
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone, senha }),
      });

      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || "Falha no login");

      window.location.href = "/admin";
    } catch (err: any) {
      setMsg(err?.message || "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthBackground>
      <GlassCard>
        <LogoDular />

        <div className="mt-4 text-center">
          <div className="text-lg font-normal tracking-tight text-slate-900">Entrar no Painel</div>
        </div>

        {msg ? (
          <div className="mt-4 rounded-2xl border border-white/30 bg-white/55 p-3 text-sm text-slate-700 ring-1 ring-slate-900/5">
            {msg}
          </div>
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <PillInput
            label="Usuário (telefone ou email)"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="65999990000"
            autoComplete="username"
          />
          <PillInput
            label="Senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="admin123"
            autoComplete="current-password"
          />
          <PrimaryButton disabled={loading}>{loading ? "Entrando..." : "Entrar"}</PrimaryButton>
        </form>

        <div className="mt-4 text-center text-xs text-slate-600">
          Seed: <b className="text-slate-800">65999990000</b> / <b className="text-slate-800">admin123</b>
        </div>
      </GlassCard>
    </AuthBackground>
  );
}
