# Dular — Guia de Sub-Agents (Codex / Claude Code / GPT)

Este documento define como qualquer AI (Codex, Claude Code, GPT) deve
estruturar e dispatchar prompts para os sub-agents do projeto Dular.
Cole este documento no início de qualquer sessão antes de começar uma task.

-----

## Contexto do projeto

**Dular** é um marketplace brasileiro de serviços domésticos.

- **Frontend**: React Native + Expo — pasta `/app`, `/components`, `/hooks`, `/constants`
- **Backend**: Next.js API Routes — pasta `/api`, `/lib`, `/middleware`, `/services`
- **Banco**: Prisma + PostgreSQL — pasta `/prisma`

**Design tokens obrigatórios:**

- Primary: `#0F6B66`
- Background: `#F8F6F2`
- Accent: `#F5A623`

**Restrição de animação (frontend):**
Apenas `React Native Animated` com `useNativeDriver: true`.
Reanimated, Moti e Framer Motion são proibidos.

-----

## Os três agentes

|Agente    |Escopo                                    |Nunca toca em                 |
|----------|------------------------------------------|------------------------------|
|`frontend`|`/app` `/components` `/hooks` `/constants`|`/api` `/lib` `/prisma`       |
|`backend` |`/api` `/lib` `/middleware` `/services`   |`/app` `/components` `/prisma`|
|`database`|`/prisma`                                 |tudo fora de `/prisma`        |

-----

## Regras que todos os agentes seguem

1. Execute **somente** o que foi descrito na task. Nada além.
1. Se encontrar bug ou problema **fora do escopo**: reporte ao orquestrador e pare. Não corrija.
1. Não refatore código que não foi pedido.
1. Não crie arquivos não solicitados.
1. Não altere configurações globais.
1. `database` nunca roda `prisma migrate` automaticamente — gera o arquivo e aguarda confirmação.
1. `backend` nunca altera schema — se precisar de campo novo, reporta ao orquestrador.
1. Ao terminar: liste todos os arquivos modificados e o que foi feito em cada um.
1. Se `tsc` / `prisma validate` retornar exit code != 0: listar os erros e parar. Não tentar corrigir o que está fora do escopo da task.

-----

## Regras de dispatch

**Paralelo** — quando TODOS os critérios forem verdadeiros:

- 2+ tarefas em domínios independentes
- Sem arquivos compartilhados entre elas
- Output de uma não alimenta a outra

**Sequencial** — quando QUALQUER condição for verdadeira:

- Task B depende do resultado da task A
- Arquivos compartilhados (risco de conflito)
- Escopo ainda não está claro

-----

## Template de prompt para cada agente

Todo dispatch deve conter obrigatoriamente:

```
Agente: [frontend | backend | database]

Contexto: [o que está acontecendo e por quê — máximo 3 linhas]

Escopo permitido: [lista de pastas/arquivos que pode tocar]

Tasks:
1. [ação específica e verificável]
2. [ação específica e verificável]
...

Restrições:
- Não tocar em [pastas fora do escopo]
- Não criar [o que não foi pedido]
- Se encontrar erro fora do escopo: reportar e parar

Ao terminar:
- Rodar [tsc | prisma validate — o que se aplicar]
- Listar todos os arquivos modificados e o que foi feito em cada um
- Se exit code != 0: listar erros e parar
```

-----

## Como chamar no Codex

O Codex não usa `@agent-nome`. Você descreve e ele roteia.
Use esta estrutura no prompt:

```
Dispatche em paralelo para os agentes especializados do Dular:

AGENTE FRONTEND — [descrição da task de frontend]
AGENTE BACKEND  — [descrição da task de backend]
AGENTE DATABASE — [descrição da task de banco, se necessário]

Cada agente executa somente sua parte.
Seguir as regras do arquivo AGENTS.md na raiz do projeto.
```

## Como chamar no Claude Code

O Claude Code usa menção direta:

```
@agent-frontend → [task]
@agent-backend  → [task]
@agent-database → [task]
```

-----

## Comportamento do orquestrador

O orquestrador (thread principal) nunca executa tasks de domínio diretamente.
Ele apenas:

1. Lê o prompt
1. Identifica domínios afetados
1. Detecta dependências
1. Dispatcha para os agentes corretos
1. Consolida os resultados
1. Reporta ao usuário
1. Para e pergunta antes de qualquer ação adicional se houver erro

Se um agente reportar erro ou bloqueio, o orquestrador **para tudo** e reporta antes de continuar.

-----

## Exemplo de prompt completo

```
T-13 — Implementar tela de avaliação pós-serviço.

Dispatche em paralelo:

AGENTE FRONTEND
Contexto: Criar tela de avaliação que o empregador vê após serviço concluído.
Escopo: /app/screens/empregador /components
Tasks:
1. Criar AvaliacaoScreen com input de 1-5 estrelas e campo de comentário
2. Adicionar botão Enviar que chama POST /api/avaliacoes
3. Após envio, navegar para AgendamentosScreen
4. Respeitar design tokens: primary #0F6B66, background #F8F6F2
Restrições:
- Não tocar em /api /prisma
- Não criar novos componentes além do necessário para esta tela
Ao terminar: rodar tsc, listar arquivos modificados

AGENTE BACKEND
Contexto: Criar endpoint para receber avaliação do empregador.
Escopo: /api/avaliacoes /lib
Tasks:
1. Criar POST /api/avaliacoes que recebe servicoId, nota (1-5), comentario
2. Validar que o serviço pertence ao empregador autenticado
3. Salvar no banco via Prisma
Restrições:
- Não alterar schema — se precisar de tabela nova, reportar e parar
- Não tocar em /app /components
Ao terminar: rodar tsc, listar arquivos modificados

AGENTE DATABASE (somente se backend reportar necessidade)
Aguardar resultado do backend antes de dispatchar.

Cada agente executa somente sua parte.
```

-----

## Quando continuar uma task no Codex vinda do Claude Code

1. Cole este documento no início da sessão do Codex
1. Descreva o contexto do que foi feito até agora
1. Descreva o que ainda falta
1. Use o template de dispatch acima

O Codex vai ler o `AGENTS.md` do projeto automaticamente,
mas este documento garante que ele entenda o padrão de trabalho.