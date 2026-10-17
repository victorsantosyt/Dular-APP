# Assinaturas pela Google Play — ciclo e isolamento por conta

Regras do Dular para assinatura comprada na Google Play (issue #359). O código que as aplica está em
`web/src/lib/lojas.ts`, `web/src/lib/googlePlayCompras.ts`, `web/src/lib/trocaDePlano.ts` (`registrarCompraDaLoja`),
`web/src/lib/assinatura.ts` (`assinaturaEfetiva`) e, no app, `dular-mobile/src/lib/lojaGoogle.ts` e
`dular-mobile/src/lib/compraDePlano.ts`.

## Identidade: a conta Dular, não a conta Google

- Quem tem a assinatura é a **conta Dular** (`User.id`). A identidade dela na loja é o **token da conta**,
  `tokenDaConta(userId)`: um UUID derivado do id, gravado em `User.tokenLoja` e enviado pelo app em toda compra
  como `obfuscatedAccountId`. O Google devolve o mesmo valor em `externalAccountIdentifiers.obfuscatedExternalAccountId`.
- **Não existe correspondência fixa entre conta Google e conta Dular.** Uma conta Google pode ter compras de várias
  contas Dular (Montador e Profissional de Casa, ou duas contas do mesmo perfil); uma conta Dular pode comprar com
  qualquer conta Google do aparelho.
- **Uma compra pertence a uma única conta Dular, para sempre.** O índice único `(provider, externalId)` em
  `AssinaturaLoja` impede a mesma compra (`purchaseToken`) em duas contas. Compra não é transferida nem concedida a
  outra conta, nem por troca de plano (`linkedPurchaseToken`) nem por reassinatura fora do app.
- **Perfil:** o plano vem do produto e do plano base que o **Google** confirmou (nunca do que o app pediu), e o papel
  do plano tem que ser o da conta (`PLAN_ROLE_MISMATCH`, `perfil_divergente`). Produtos de Montador e de
  Profissional de Casa são distintos.

### O que é verificado em cada compra

| Dado | Origem | Regra |
|---|---|---|
| `userId` | sessão do app | a compra é registrada para quem apresentou |
| `role` | banco | igual ao `role` do plano confirmado |
| token da conta | Google (`obfuscatedExternalAccountId`) | igual a `tokenDaConta(userId)`; ausente ou diferente → 403 `COMPRA_SEM_TITULARIDADE` |
| produto e plano base | Google (`lineItems[0].productId`, `offerDetails.basePlanId`) | exatamente um plano do catálogo; senão 409 `PRODUTO_DESCONHECIDO` |
| `purchaseToken` | app | identidade da compra; já registrada em outra conta → 409 `COMPRA_DE_OUTRA_CONTA` |
| registro | `AssinaturaLoja` | uma linha por compra; a `Subscription` segue sendo o vínculo Stripe |

Notificações (RTDN) acham a conta, nesta ordem: compra já registrada; `User.tokenLoja` igual ao token da compra;
compra vencida que a reassinatura substitui (com o mesmo dono); compra anterior ligada. Sem conta provada, nada é
concedido.

### No aparelho

`getAvailablePurchases()` devolve as compras de **toda** a conta Google. O app separa pelo token:

- compra com `obfuscatedAccountIdAndroid` de **outra** conta Dular: ignorada na compra, no upgrade e na restauração.
  Na restauração ela só é contada como recusada; o comprovante não sai do aparelho;
- compra desta conta, ou **sem** token: impede abrir outra assinatura (restaure primeiro) e é apresentada ao servidor,
  que decide.

## Ciclo

O acesso vale enquanto a última resposta do Google diz **período em curso** e o fim informado ainda não passou
(`assinaturaEfetiva`). O estado gravado é sempre o da **consulta atual** ao Google, nunca o conteúdo da notificação.

| Evento | O que acontece |
|---|---|
| **Compra** | O app compra com o token da conta e o plano base do catálogo, e manda o `purchaseToken` a `POST /api/billing/loja`. O servidor consulta o Google, confere titularidade, produto e perfil, registra e reconhece (acknowledge). Só então o app conclui a transação. Pagamento pendente: 202, nada concedido; a notificação conclui quando pagar. |
| **Reabertura do app** | Nada é recomprado. `/api/me/subscription` mostra o plano. Se a renovação estiver atrasada, relê o Google (ver "Indisponibilidade"). |
| **Renovação** | Com app aberto ou fechado: a notificação dispara a releitura e o fim avança. Se a notificação atrasar ou se perder, `/api/me/subscription` (ao abrir o app) e o cron diário relêem o Google para toda compra com renovação ligada e fim já passado. |
| **Restauração** | Reapresenta ao servidor as compras pagas desta conta (ou sem token) que a Play ainda devolve. Repetir é seguro: a compra já registrada para esta conta é atualizada, nunca duplicada. A Play não devolve assinatura vencida; lista vazia é "nenhuma assinatura ativa". |
| **Upgrade** (mensal → anual, básico → pro) | Só pela Google, com substituição (`with-time-proration`) da compra atual desta conta, depois de o servidor revalidá-la. A nova compra traz `linkedPurchaseToken`; a anterior é marcada substituída e deixa de dar acesso. Compra de outra conta nunca é substituída. |
| **Cancelamento** | A renovação desliga; o acesso continua até o fim do período pago (`SUBSCRIPTION_STATE_CANCELED`). Passado o fim, acaba sem releitura. |
| **Expiração** | `SUBSCRIPTION_STATE_EXPIRED`: acesso removido; a compra é encerrada de vez e não é mais consultada. |
| **Suspensão / pausa** | `ON_HOLD` / `PAUSED`: sem acesso; volta quando o Google recuperar o pagamento. É estado confirmado, não "pendente". |
| **Reembolso / revogação** | Notificação de revogação ou de compra anulada: relê o Google (EXPIRED) e remove o acesso na hora. |
| **Indisponibilidade** | Ver abaixo. |

### Indisponibilidade não é expiração

Quando a compra diz que renova e o fim gravado já passou, `/api/me/subscription` relê o Google antes de responder:

- Google renovou → o plano volta, sem precisar de notificação;
- Google diz expirada, suspensa ou cancelada → esse é o estado;
- Google não respondeu, ou responde ativa com o fim já passado (renovação ainda em processamento) →
  `verificacaoLoja: "pendente"`.

Com `"pendente"`, **nenhum acesso é concedido** (o plano efetivo é FREE para limites e permissões), mas o app não
apresenta isso como gratuito confirmado: o perfil mostra "Confirmando assinatura", a barra de limite não oferece
planos, o paywall avisa "Aguardando confirmação" e bloqueia nova compra, e o fluxo de compra recusa abrir outra
assinatura.

A releitura de uma mesma compra acontece no máximo uma vez a cada 30 s, com sucesso ou falha. A tentativa é reservada
no banco (`UPDATE` condicional em `AssinaturaLoja.updatedAt`) antes da chamada ao Google, então consultas simultâneas
e outras instâncias do backend não repetem a chamada dentro do intervalo.

## Catálogo

O app só oferece plano que a Play devolve **agora** (`fetchProducts`) com o produto e o plano base do catálogo, sem
oferta promocional — no catálogo inicial e na troca de plano. Plano do servidor sem produto publicado não aparece.

Conferência do Play Console em 16/10/2026, pela integração do staging (`monetization.subscriptions.list`; a rota
temporária usada foi retirada): existe **um** produto de assinatura, `br.com.dular.montador.pro.mensal`, plano base
`mensal` (ACTIVE, P1M, Brasil, R$ 39,90, carência de 7 dias, reassinatura ativa, sem ofertas). Os outros cinco
planos do catálogo ainda não existem no Console e, por isso, não aparecem no app.

## Assinatura de teste (testador de licença)

No teste, o período é de 5 minutos e o Google renova no máximo **6 vezes**: 35 minutos depois da compra a assinatura
é cancelada e expira sozinha. Isso é expiração legítima, não falha de sincronização. Medido no staging em 15–16/10/2026:
seis compras seguiram exatamente esse ciclo; uma foi revogada com reembolso 7 minutos depois.
