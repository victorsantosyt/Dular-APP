# Contas de demonstração para a revisão das lojas

## Por que existem

A App Store (diretriz 2.1) e o Google Play exigem que o revisor consiga
avaliar o app por inteiro. Dois portões impedem isso:

1. **KYC com aprovação humana.** O perfil de diarista só aparece na busca
   depois que um administrador aprova o documento. O revisor enviaria o
   documento e ficaria esperando — provavelmente reprovando por
   "não foi possível avaliar".
2. **Operação em uma cidade só.** Criar serviço exige bairro cadastrado. Um
   revisor em qualquer outro lugar bate em "Bairro não cadastrado".

Uma conta com KYC pré-aprovado não resolve sozinha: o revisor vai **criar**
fluxos, não só olhar telas. Por isso a flag abre os dois.

## Isto é permanente

Não é andaime de lançamento. **Toda atualização passa por revisão de novo**,
então estas contas precisam continuar funcionando a cada release. Se uma delas
quebrar — conta suspensa no provedor, perfil incompleto, papel trocado — a
próxima submissão é reprovada.

Antes de cada envio, refaça a conferência da seção "Verificar".

## Como o revisor entra

**Pelo fluxo normal do app: Continuar com Google ou Continuar com Apple.**

Não existe tela escondida, gesto secreto nem login por senha. Isso é decisão,
não limitação: um caminho de autenticação paralelo criado para a revisão
continuaria vivo em produção depois dela, para todo mundo.

Por isso as contas de demonstração são **contas reais**, criadas no Google e
na Apple, que entram uma vez pelo app e depois são marcadas no banco.

O script **não define senha do Dular**. A senha que vai para as notas de
revisão é a **da plataforma** (Google/Apple), usada no OAuth.

## As contas

Os e-mails não estão neste repositório — são contas reais e vão na variável
`DEMO_EMAILS` na hora de rodar o script.

| # | provedor | papel | serve a | o que o revisor consegue fazer |
|---|---|---|---|---|
| 1 | Google | Empregador | Play + App Store | buscar, criar serviço em **qualquer** endereço, contratar, conversar, avaliar |
| 2 | Google | Diarista | Play + App Store | aparecer na busca sem KYC, receber e aceitar solicitação |
| 3 | Google | Montador | Play + App Store | aparecer na busca sem KYC, receber e aceitar solicitação |
| 4 | Apple | Empregador | App Store | o mesmo da nº 1, entrando por **Sign in with Apple** |

São três papéis porque o revisor precisa ver os três. Com uma conta só, ele vê
metade do app e reprova por "funcionalidade incompleta".

A quarta existe porque o app oferece Sign in with Apple e o revisor da Apple
tende a exercitar justamente esse caminho. Uma conta Google não prova que o
botão da Apple funciona. Se preferir cobrir os três papéis também pela Apple,
crie 3 e 3 — o script aceita quantos e-mails você passar.

## O procedimento completo

### 1. Criar a conta na plataforma

Crie a conta no Google (ou o Apple ID). Use um endereço que você controle e
que não vá expirar. **Não** use uma conta pessoal sua: a credencial vai para o
console da loja.

### 2. Entrar no app uma vez

Abra o Dular, escolha o papel (Empregador / Diarista / Montador) e entre com
o provedor. **Esta etapa é obrigatória**: o script marca uma conta que já
existe, não cria nenhuma. Sem esta entrada, ele falha dizendo exatamente isso.

Complete o cadastro até o app parar de pedir dados.

### 3. Marcar as contas

De dentro de `web/`:

```bash
DEMO_EMAILS='revisao.empregador@gmail.com,revisao.diarista@gmail.com,revisao.montador@gmail.com' \
  npm run demo:marcar
```

O papel vem do que a conta escolheu no app. Se alguma escolheu errado, force:

```bash
DEMO_EMAILS='revisao.diarista@gmail.com=DIARISTA' npm run demo:marcar
```

Idempotente: rodar de novo atualiza as mesmas contas, não duplica nada.

Depende da migration `20260909045243_conta_demo` estar aplicada.

**O script cria o perfil, não só marca o usuário.** Sem perfil a conta entra e
não aparece em busca nenhuma — a busca consulta `DiaristaProfile` /
`MontadorPerfil`, não `User`.

### 4. Verificar

Antes de enviar às lojas, com o app apontando para o mesmo banco:

- entre com a conta de **empregador** e confirme que a diarista demo **aparece
  na busca**;
- confirme que dá para **criar um serviço em um endereço fora de Água Boa**
  (é o segundo portão);
- entre com a conta de **diarista** e confirme que a solicitação chega.

Se a busca vier vazia, o perfil não ficou completo — rode o script de novo e
leia o que ele imprime.

## O que a flag `contaDemo` abre — e só

| portão | onde |
|---|---|
| filtro de KYC na busca de diaristas | `api/diaristas/buscar/route.ts` |
| validação de bairro na criação de serviço | `api/servicos/route.ts` |

**Não** concede admin. **Não** pula autenticação — a conta entra pelo mesmo
OAuth de todo mundo. **Não** libera plano pago: continua no limite do plano
gratuito. **Não** altera SafeScore, cobrança ou pagamento.

Uma conta demo comprometida vale o mesmo que uma conta comum comprometida,
mais esses dois portões.

Os perfis nascem **sem** avaliação, SafeScore ou histórico de serviço. Dado
fabricado de reputação é proibido no projeto, e nenhum critério de
visibilidade exige — os perfis demo aparecem sem histórico, como qualquer
conta nova. O preço fica como "a combinar", em vez de um valor inventado.

## Por que não é variável de ambiente

Já existe uma: `AUTO_VERIFY_PROFILES` (`lib/autoVerificacao.ts`), feita para
E2E. Ligada por engano em produção, ela aprova o KYC de **todo mundo** — o
raio de dano é a base inteira. Hoje ela derruba o boot se aparecer com
`NODE_ENV=production` (`lib/autoVerificacaoGuard.ts`).

A coluna por usuário limita o dano à conta que a tem. Ligar em massa exigiria
um `UPDATE "User" SET "contaDemo" = true` sem `WHERE` direto no banco de
produção — não há caminho pela API, nem pelo admin, nem pelo app. O único
caminho é este script, rodado à mão.

## Onde as credenciais vão parar

Só no **App Store Connect → App Review Information** e no
**Google Play Console → App access**. Não divulgue em outro lugar: quem tem
essas credenciais consegue criar serviço fora da região atendida.

**A senha nunca fica no repositório.** É a senha da conta Google/Apple,
guardada onde você guarda credenciais — nunca commitada, nunca em `.env`
versionado. Este documento não a contém e não deve conter.

Se precisar rotacionar, troque a senha no provedor e atualize as notas de
revisão. O banco não guarda senha nenhuma dessas contas.
