# Contas de demonstração para a revisão das lojas

## Por que existem

A App Store (diretriz 2.1) e o Google Play exigem que o revisor consiga
avaliar o app por inteiro. Hoje dois portões impedem isso:

1. **KYC com aprovação humana.** O perfil de diarista só aparece na busca
   depois que um administrador aprova o documento. O revisor enviaria o
   documento e ficaria esperando — provavelmente reprovando por
   "não foi possível avaliar".
2. **Operação em uma cidade só.** Criar serviço exige bairro cadastrado. Um
   revisor em qualquer outro lugar bate em "Bairro não cadastrado".

Uma conta com KYC pré-aprovado não resolve sozinha: o revisor vai **criar**
fluxos, não só olhar telas. Por isso a flag abre os dois.

## As contas

| papel | telefone |
|---|---|
| Empregador | `65900009001` |
| Diarista | `65900009002` |
| Montador | `65900009003` |

São três porque o revisor precisa ver os três papéis. Com uma só, ele vê
metade do app.

**A senha não está neste repositório.** Ela é definida na hora de rodar o
seed e vai para as notas de revisão da loja — um canal externo. Commitá-la
aqui a tornaria pública no histórico do git para sempre.

## Como criar / atualizar

```bash
cd web
DEMO_PASSWORD='<senha com 10+ caracteres>' npx tsx prisma/seed-demo.ts
```

Idempotente: rodar de novo atualiza as mesmas três contas.

Depende da migration `20260909045243_conta_demo` estar aplicada.

## O que a flag `contaDemo` abre — e só

| portão | onde |
|---|---|
| filtro de KYC na busca de diaristas | `api/diaristas/buscar/route.ts` |
| validação de bairro na criação de serviço | `api/servicos/route.ts` |

**Não** concede admin. **Não** pula autenticação — a conta loga por senha
como qualquer outra. **Não** libera plano pago: a conta demo continua no
limite do plano gratuito. **Não** altera SafeScore, cobrança ou pagamento.

Uma conta demo comprometida vale o mesmo que uma conta comum comprometida,
mais esses dois portões.

## Por que não é variável de ambiente

Já existe uma: `AUTO_VERIFY_PROFILES` (`lib/autoVerificacao.ts`), feita para
E2E. Ligada por engano em produção, ela aprova o KYC de **todo mundo** — o
raio de dano é a base inteira.

A coluna por usuário limita o dano à conta que a tem. Ligar em massa exigiria
um `UPDATE "User" SET "contaDemo" = true` sem `WHERE` direto no banco de
produção — não há caminho pela API, nem pelo admin, nem pelo app.

## Onde as credenciais vão parar

Só no **App Store Connect → App Review Information** e no
**Google Play Console → App access**. Não divulgue em outro lugar: quem tem
essas credenciais consegue criar serviço fora da região atendida.

Rotacione a senha (rodando o seed de novo) depois de cada ciclo de revisão.
