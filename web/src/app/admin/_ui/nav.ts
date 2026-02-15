import {
  LayoutDashboard,
  ClipboardList,
  Users,
  BadgeCheck,
  Radar,
  Siren,
  BarChart3,
  MessageSquareText,
} from "lucide-react";

export const NAV = [
  {
    section: "Menu",
    items: [
      { href: "/admin", label: "Dashboard", Icon: LayoutDashboard },
      { href: "/admin/operacoes/usuarios", label: "Usuários", Icon: Users },
      { href: "/admin/insights", label: "Insights", Icon: BarChart3 },
      { href: "/admin/operacoes/servicos", label: "Serviços", Icon: ClipboardList },
      { href: "/admin/seguranca/riscos", label: "Risk score", Icon: Radar },
      { href: "/admin/seguranca/checkins", label: "Check-ins & SOS", Icon: Siren },
      { href: "/admin/seguranca/verificacoes", label: "Verificações", Icon: BadgeCheck },
      { href: "/admin/insights/feedbacks", label: "Feedbacks e avaliações", Icon: MessageSquareText },
    ],
  },
];
