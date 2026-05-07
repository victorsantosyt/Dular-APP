# Dular-APP
Dular app e um app de prestacao de servico, onde conectara clientes a prestadores de servicos domestico com diferentes categorias de trabalho.

## Variáveis de ambiente

### Mobile (`dular-mobile/.env`)

- `EXPO_PUBLIC_API_URL`: URL base do backend consumida pelo app Expo. Em produção, aponte para a API pública.
- `EXPO_PUBLIC_API_BASE_URL`: alias temporário aceito para compatibilidade; prefira `EXPO_PUBLIC_API_URL`.
- `EXPO_PUBLIC_PILOT_MODE`: quando `true`, mantém o app operando com região piloto configurada. Em produção, use `false`.
- `EXPO_PUBLIC_PILOT_CITY`: cidade padrão usada na busca e criação de serviços enquanto não houver seleção dinâmica de cidade.
- `EXPO_PUBLIC_PILOT_UF`: UF padrão da cidade configurada.
- `EXPO_PUBLIC_PILOT_LAT`: latitude de referência da cidade/região configurada.
- `EXPO_PUBLIC_PILOT_LNG`: longitude de referência da cidade/região configurada.
- `EXPO_PUBLIC_PILOT_BAIRROS`: lista de bairros padrão separada por vírgula.

Use `dular-mobile/.env.example` como base.

### Web (`web/.env`)

- `JWT_SECRET`: segredo obrigatório para assinar e validar JWTs. Não há fallback seguro no código.

Use `web/.env.example` como base.
