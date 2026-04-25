"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { InputField } from "@/components/ui/InputField";
import { LogoBrand } from "@/components/ui/LogoBrand";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { StatusBarMock } from "@/components/ui/StatusBarMock";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setEntered(true), 40);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#EAF5EF_0%,#D6EDE3_55%,#C8E5D8_100%)] px-4 pb-10">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col">
        <StatusBarMock />

        <section className="flex flex-1 flex-col items-center px-5 pb-6 pt-8">
          <div className="mb-6 flex w-full flex-col items-center pt-7 animate-dular-up">
            <LogoBrand variant="full" priority className="w-[184px]" />
            <h1 className="mt-4 text-[18px] font-extrabold text-dular-ink">Bem-vindo de volta!</h1>
          </div>

          <div
            className={[
              "w-full space-y-2.5 transition duration-500",
              entered ? "translate-y-0 opacity-100" : "translate-y-7 opacity-0",
            ]
              .join(" ")
              .trim()}
          >
            <InputField
              icon={<Mail size={16} strokeWidth={2} />}
              placeholder="Seu email"
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <InputField
              icon={<LockKeyhole size={16} strokeWidth={2} />}
              placeholder="Sua senha"
              autoComplete="current-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="inline-flex items-center justify-center"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
          </div>

          <div
            className={[
              "mt-3 w-full origin-center transition duration-500",
              entered ? "scale-100 opacity-100" : "scale-95 opacity-0",
            ]
              .join(" ")
              .trim()}
          >
            <PrimaryButton type="button">Entrar</PrimaryButton>
          </div>

          <div className="mt-4 flex flex-col items-center gap-1 text-center animate-dular-up [animation-delay:160ms]">
            <Link href="#" className="text-[12px] font-medium text-dular-sub transition hover:text-dular-ink">
              Esqueceu sua senha?
            </Link>
            <p className="mt-1 text-[12px] font-medium text-dular-sub">Não tem conta?</p>
            <Link href="#" className="text-[12px] font-bold text-dular-green-dark transition hover:opacity-80">
              Cadastre-se
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
