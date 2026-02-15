"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, ReactNode, RefObject, InputHTMLAttributes } from "react";
import { Mail, Phone, Lock, Eye, EyeOff } from "lucide-react";

type LoginInputProps = {
  icon: ReactNode;
  inputRef?: RefObject<HTMLInputElement | null>;
} & InputHTMLAttributes<HTMLInputElement>;

function LoginInput({ icon, inputRef, ...props }: LoginInputProps) {
  return (
    <div className="flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm transition-all focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500">
      {icon}
      <input
        ref={inputRef}
        {...props}
        className="peer h-10 w-full border-0 bg-transparent p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-0"
      />
    </div>
  );
}

export default function LoginForm() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const loginRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!login || !password) {
      setError("Preencha email ou telefone e senha.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, senha: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Falha ao autenticar.");
      }
      router.push("/admin");
    } catch (err: any) {
      setError(err?.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <LoginInput
        icon={<Mail size={18} />}
        placeholder="Email ou telefone"
        type="text"
        value={login}
        onChange={(e) => setLogin(e.target.value)}
        inputRef={loginRef}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "ArrowDown") {
            e.preventDefault();
            passRef.current?.focus();
          }
        }}
      />

      <div className="relative">
        <LoginInput
          icon={<Lock size={18} />}
          placeholder="••••••••"
          type={showPass ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          inputRef={passRef}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit(e);
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              loginRef.current?.focus();
            }
          }}
        />
        <button
          type="button"
          onClick={() => setShowPass((v) => !v)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
        >
          {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 font-semibold text-white shadow-lg transition hover:opacity-95 disabled:opacity-60"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <div className="mt-4 text-center text-sm text-slate-500">
        <button type="button" className="hover:text-emerald-600">
          Esqueceu sua senha?
        </button>
      </div>

      <div className="text-center text-sm text-slate-500">
        Não tem conta?{" "}
        <button type="button" className="font-semibold text-emerald-600 hover:underline">
          Cadastre-se
        </button>
      </div>
    </form>
  );
}
