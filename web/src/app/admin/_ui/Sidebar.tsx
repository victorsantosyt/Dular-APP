"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { NAV } from "./nav";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="p-1">
      <div
        className={[
          "flex items-center gap-3 flex-nowrap h-[64px] px-4 py-2",
          "rounded-[28px] border border-white/40 bg-white/65 backdrop-blur-xl",
          "shadow-[0_20px_60px_-32px_rgba(0,0,0,0.35)] overflow-hidden",
        ].join(" ")}
      >
        {/* Logo */}
        <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/80 ring-1 ring-white/55 overflow-hidden flex-shrink-0">
          <Image
            src="/brand/dular-mark.png"
            alt="Dular"
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            priority
          />
        </div>

        {/* Navigation items */}
        <div className="flex items-center gap-3 flex-nowrap overflow-hidden">
          {NAV.flatMap((group) => group.items).map(({ href, label, Icon }) => {
            // Evita que o Dashboard (/admin) fique sempre ativo em qualquer rota dentro de /admin.
            const active =
              href === "/admin"
                ? pathname === "/admin" || pathname === "/admin/"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <div key={href} className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                <Link
                  href={href}
                  aria-label={label}
                  className={[
                    "flex w-11 h-11 items-center justify-center rounded-2xl transition-transform transition-colors duration-150",
                    "hover:bg-white/25 hover:scale-[1.05]",
                    active
                      ? "bg-emerald-200/60 ring-1 ring-white/50 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.35)]"
                      : "bg-white/10",
                  ].join(" ")}
                  style={{ transformOrigin: "50% 50%" }}
                >
                  <Icon size={20} className={active ? "text-emerald-800" : "text-slate-700"} />
                </Link>
              </div>
            );
          })}

          {/* Settings */}
          <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
            <Link
              href="/admin/configuracoes"
              aria-label="Configurações"
              className={[
                "flex w-11 h-11 items-center justify-center rounded-2xl transition-transform transition-colors duration-150",
                "hover:bg-white/25 hover:scale-[1.05]",
                pathname.startsWith("/admin/configuracoes")
                  ? "bg-emerald-200/60 ring-1 ring-white/50 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.35)]"
                  : "bg-white/10",
              ].join(" ")}
              style={{ transformOrigin: "50% 50%" }}
            >
              <Settings size={20} className={pathname.startsWith("/admin/configuracoes") ? "text-emerald-800" : "text-slate-700"} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
