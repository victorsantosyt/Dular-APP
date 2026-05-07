# Levantamento Perfil Cliente (Mobile)

## 1) Pastas Relevantes
- `dular-mobile/src/screens/cliente/`
- `dular-mobile/src/screens/perfil/` (compartilhadas no fluxo cliente)
- `dular-mobile/src/navigation/ClienteTabs.tsx`

## 2) Telas do Perfil Cliente

### Telas próprias (`src/screens/cliente`)
- `dular-mobile/src/screens/cliente/ClienteHome.tsx`
- `dular-mobile/src/screens/cliente/ClienteMinhas.tsx`
- `dular-mobile/src/screens/cliente/ClienteDetalhe.tsx`
- `dular-mobile/src/screens/cliente/ClientePerfil.tsx`

### Telas compartilhadas usadas pelo cliente (`src/screens/perfil`)
- `dular-mobile/src/screens/perfil/VerificacaoDocs.tsx`
- `dular-mobile/src/screens/perfil/ReportIncident.tsx`

## 3) Fluxo de Navegação (Cliente)
- Aba `Home` -> `ClienteHome`
- Aba `Solicitações` -> `ClienteMinhas` -> `ClienteDetalhe`
- Aba `Perfil` -> `ClientePerfil` -> (`VerificacaoDocs`, `ReportIncident`)

## 4) Componentes Reutilizáveis Usados no Perfil Cliente

### Botões e inputs
- `dular-mobile/src/components/DButton.tsx`
- `dular-mobile/src/components/DInput.tsx`

### Cards e blocos visuais
- `dular-mobile/src/ui/CategoryCard.tsx`
- `dular-mobile/src/ui/GlassCard.tsx`

### Layout e base de tela
- `dular-mobile/src/components/Screen.tsx`
- `dular-mobile/src/ui/ScreenBackground.tsx`
- `dular-mobile/src/ui/SectionTitle.tsx`
- `dular-mobile/src/ui/SearchPill.tsx`

## 5) Total do Perfil Cliente
- Telas próprias: `4`
- Telas compartilhadas usadas: `2`
- Total no fluxo cliente: `6`
