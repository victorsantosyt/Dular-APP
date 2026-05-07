# Levantamento Perfil Diarista (Mobile)

## 1) Pastas Relevantes
- `dular-mobile/src/screens/diarista/`
- `dular-mobile/src/screens/perfil/` (compartilhadas no fluxo diarista)
- `dular-mobile/src/navigation/DiaristaTabs.tsx`
- `dular-mobile/src/navigation/DiaristaPerfilStack.tsx`

## 2) Telas do Perfil Diarista

### Telas próprias (`src/screens/diarista`)
- `dular-mobile/src/screens/diarista/DiaristaSolicitacoes.tsx`
- `dular-mobile/src/screens/diarista/DiaristaDetalhe.tsx`
- `dular-mobile/src/screens/diarista/DiaristaCarteira.tsx`
- `dular-mobile/src/screens/diarista/DiaristaPerfil.tsx`
- `dular-mobile/src/screens/diarista/EditProfile.tsx`
- `dular-mobile/src/screens/diarista/EditNeighborhoods.tsx`
- `dular-mobile/src/screens/diarista/EditAvailability.tsx`
- `dular-mobile/src/screens/diarista/EditPrices.tsx`

### Telas compartilhadas usadas pelo diarista (`src/screens/perfil`)
- `dular-mobile/src/screens/perfil/VerificacaoDocs.tsx`
- `dular-mobile/src/screens/perfil/ReportIncident.tsx`
- `dular-mobile/src/screens/perfil/AlterarSenha.tsx`
- `dular-mobile/src/screens/perfil/Suporte.tsx`
- `dular-mobile/src/screens/perfil/Termos.tsx`
- `dular-mobile/src/screens/perfil/Privacidade.tsx`

## 3) Fluxo de Navegação (Diarista)
- Aba `Home` -> `DiaristaSolicitacoes` -> `DiaristaDetalhe` -> `ReportIncident`
- Aba `Carteira` -> `DiaristaCarteira`
- Aba `Perfil` -> `DiaristaPerfil` -> (`EditDados`, `VerificacaoDocs`, `EditBairros`, `EditDisponibilidade`, `EditPrecos`, `AlterarSenha`, `Suporte`, `Termos`, `Privacidade`, `ReportIncident`)

## 4) Componentes Reutilizáveis Usados no Perfil Diarista

### Botões e inputs
- `dular-mobile/src/components/DButton.tsx`
- `dular-mobile/src/components/DularButton.tsx`

### Cards, badges e blocos
- `dular-mobile/src/components/DularBadge.tsx`

### Layout e base de tela
- `dular-mobile/src/components/Screen.tsx`
- `dular-mobile/src/ui/Layout.tsx` (`CenterWrap`, `useDularContainerWidth`)

## 5) Total do Perfil Diarista
- Telas próprias: `8`
- Telas compartilhadas usadas: `6`
- Total no fluxo diarista: `14`
