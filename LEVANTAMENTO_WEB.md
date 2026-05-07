# Levantamento Web (Dular)

## 1) Estrutura de Pastas (Web)
- `web/`
- `web/prisma/`
- `web/public/`
- `web/src/`
- `web/src/app/`
- `web/src/components/`
- `web/src/lib/`
- `web/src/types/`

## 2) Telas Principais (rotas `page.tsx`)
- `/` -> `web/src/app/page.tsx`
- `/admin/(public)/login` -> `web/src/app/admin/(public)/login/page.tsx`
- `/admin/(protected)` -> `web/src/app/admin/(protected)/page.tsx`
- `/admin/configuracoes` -> `web/src/app/admin/configuracoes/page.tsx`
- `/admin/incidentes` -> `web/src/app/admin/incidentes/page.tsx`
- `/admin/incidentes/[id]` -> `web/src/app/admin/incidentes/[id]/page.tsx`
- `/admin/insights` -> `web/src/app/admin/insights/page.tsx`
- `/admin/insights/avaliacoes` -> `web/src/app/admin/insights/avaliacoes/page.tsx`
- `/admin/insights/downloads` -> `web/src/app/admin/insights/downloads/page.tsx`
- `/admin/insights/feedbacks` -> `web/src/app/admin/insights/feedbacks/page.tsx`
- `/admin/operacoes/servicos` -> `web/src/app/admin/operacoes/servicos/page.tsx`
- `/admin/operacoes/servicos/[id]` -> `web/src/app/admin/operacoes/servicos/[id]/page.tsx`
- `/admin/operacoes/suporte` -> `web/src/app/admin/operacoes/suporte/page.tsx`
- `/admin/operacoes/usuarios` -> `web/src/app/admin/operacoes/usuarios/page.tsx`
- `/admin/seguranca/checkins` -> `web/src/app/admin/seguranca/checkins/page.tsx`
- `/admin/seguranca/incidentes` -> `web/src/app/admin/seguranca/incidentes/page.tsx`
- `/admin/seguranca/riscos` -> `web/src/app/admin/seguranca/riscos/page.tsx`
- `/admin/seguranca/verificacoes` -> `web/src/app/admin/seguranca/verificacoes/page.tsx`
- `/dev/smoke` -> `web/src/app/dev/smoke/page.tsx`

## 3) Componentes Reutilizáveis (Web)

### Auth UI
- `web/src/components/auth/AuthBackground.tsx`
- `web/src/components/auth/AuthLayout.tsx`
- `web/src/components/auth/GlassCard.tsx`
- `web/src/components/auth/LoginCard.tsx`
- `web/src/components/auth/LoginForm.tsx`
- `web/src/components/auth/LoginInput.tsx`
- `web/src/components/auth/LogoDular.tsx`
- `web/src/components/auth/PillInput.tsx`
- `web/src/components/auth/PrimaryButton.tsx`

### Admin UI
- `web/src/components/admin-ui/AdminCard.tsx`
- `web/src/components/admin-ui/AdminEmpty.tsx`
- `web/src/components/admin-ui/AdminGrid.tsx`
- `web/src/components/admin-ui/AdminKpi.tsx`
- `web/src/components/admin-ui/AdminPage.tsx`
- `web/src/components/admin-ui/AdminTable.tsx`
- `web/src/components/admin/AvatarMenu.tsx`
- `web/src/components/admin/AvatarWidget.tsx`

### Admin UI interno (`app/admin/_ui`)
- `web/src/app/admin/_ui/AdminShell.tsx`
- `web/src/app/admin/_ui/Card.tsx`
- `web/src/app/admin/_ui/DownloadsArea.tsx`
- `web/src/app/admin/_ui/KpiCard.tsx`
- `web/src/app/admin/_ui/PageHeader.tsx`
- `web/src/app/admin/_ui/Sidebar.tsx`
- `web/src/app/admin/_ui/Topbar.tsx`

## 4) Totais (Web)
- Páginas web (`page.tsx`): `19`
- Componentes em `web/src/components`: `17`
