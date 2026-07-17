import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Wallet,
  BarChart3,
  MessageSquareText,
  Radar,
  Siren,
  BadgeCheck,
  ShieldAlert,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Rota ainda não existente — renderiza como "Em breve", sem navegação. */
  soon?: boolean;
};

export type NavSection = {
  /** Título da seção (null = sem cabeçalho visível). */
  label: string | null;
  items: NavItem[];
};

/**
 * Navegação do painel — mapeada SOMENTE para rotas que já existem.
 * Itens `soon` são placeholders visuais para features futuras (ex.: Financeiro),
 * evitando links quebrados durante a migração.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Operações",
    items: [
      { href: "/admin/operacoes/usuarios", label: "Usuários", icon: Users },
      { href: "/admin/operacoes/servicos", label: "Serviços", icon: ClipboardList },
      { href: "/admin/financeiro", label: "Financeiro", icon: Wallet, soon: true },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { href: "/admin/insights", label: "Analytics", icon: BarChart3 },
      { href: "/admin/insights/feedbacks", label: "Feedbacks", icon: MessageSquareText },
    ],
  },
  {
    label: "Segurança",
    items: [
      { href: "/admin/seguranca/riscos", label: "Risk score", icon: Radar },
      { href: "/admin/seguranca/checkins", label: "Check-ins & SOS", icon: Siren },
      { href: "/admin/seguranca/verificacoes", label: "Verificações", icon: BadgeCheck },
      { href: "/admin/seguranca/incidentes", label: "Incidentes", icon: ShieldAlert },
    ],
  },
];

/** Item de configurações — fixo no rodapé da sidebar. */
export const NAV_SETTINGS: NavItem = {
  href: "/admin/configuracoes",
  label: "Configurações",
  icon: Settings,
};

/** Mapa href → título, para breadcrumb/header derivarem o rótulo da rota. */
export const ROUTE_TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/operacoes": "Operações",
  "/admin/operacoes/usuarios": "Usuários",
  "/admin/operacoes/servicos": "Serviços",
  "/admin/operacoes/suporte": "Suporte",
  "/admin/insights": "Analytics",
  "/admin/insights/feedbacks": "Feedbacks e avaliações",
  "/admin/insights/avaliacoes": "Avaliações",
  "/admin/insights/downloads": "Downloads",
  "/admin/seguranca": "Segurança",
  "/admin/seguranca/riscos": "Risk score",
  "/admin/seguranca/checkins": "Check-ins & SOS",
  "/admin/seguranca/verificacoes": "Verificações",
  "/admin/seguranca/incidentes": "Incidentes",
  "/admin/configuracoes": "Configurações",
  "/admin/design-system": "Design System",
};
