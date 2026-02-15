"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AvatarWidget from "@/components/admin/AvatarWidget";

type HeaderUser = {
  id: string;
  nome: string | null;
  avatarUrl: string | null;
  role: string;
};

export default function AvatarMenu({ me }: { me: HeaderUser | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const label = me?.nome || "Usuário";

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full outline-none ring-0 focus:ring-2 focus:ring-emerald-500/25"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <AvatarWidget avatarUrl={me?.avatarUrl} label={label} size={38} />
      </button>

      {open ? (
        <div
          className="absolute right-0 mt-3 w-[220px] rounded-2xl border border-white/25 bg-white/35 shadow-[0_16px_50px_rgba(15,23,42,0.18)] backdrop-blur-xl ring-1 ring-slate-900/5 overflow-hidden"
          role="menu"
        >
          <div className="px-4 py-3">
            <div className="text-sm font-medium text-slate-900 truncate">{label}</div>
            <div className="mt-0.5 text-xs text-slate-600">{me?.role ?? "—"}</div>
          </div>

          <div className="h-px bg-white/30" />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/admin/configuracoes");
            }}
            className="w-full px-4 py-3 text-left text-sm text-slate-800 hover:bg-white/30 active:bg-white/40"
            role="menuitem"
          >
            Configurações
          </button>

          <button
            type="button"
            onClick={logout}
            className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-white/30 active:bg-white/40"
            role="menuitem"
          >
            Sair
          </button>
        </div>
      ) : null}
    </div>
  );
}
