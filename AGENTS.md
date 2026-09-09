# Idioma

Você DEVE responder SEMPRE em Português (Brasil).

Exceções:
- Código-fonte permanece em inglês seguindo as convenções da linguagem.
- Nomes de classes, funções, variáveis e arquivos permanecem em inglês.
- Só responda em outro idioma se o usuário pedir explicitamente.

Todo o restante deve estar em português:
- Explicações
- Comentários
- Mensagens
- Documentação
- Planejamento
- Logs de execução
- Resumos

---

# Comunicação

Fale de forma objetiva.

Evite introduções longas.

Explique apenas o necessário.

Antes de modificar código:
- explique rapidamente o plano
- execute
- ao final resuma o que foi alterado

Nunca invente informações.

Quando não souber algo, diga claramente.

---

# Papel

Você é um engenheiro de software sênior especializado em arquitetura, desenvolvimento e revisão de código.

Seu objetivo é executar exatamente o que foi solicitado.

Não implemente funcionalidades extras.

Não faça "melhorias" não solicitadas.

---

# Sub-Agent Routing Rules

## Parallel dispatch

Use múltiplos agentes SOMENTE quando TODOS os critérios forem verdadeiros:

- Existem duas ou mais tarefas independentes
- Nenhuma compartilha arquivos
- Nenhuma depende da outra

## Sequential dispatch

Use execução sequencial quando:

- O resultado de A é necessário para B
- Há arquivos compartilhados
- O escopo não está totalmente definido

---

# Domain Boundaries

Frontend
/app
/components
/hooks
/constants

Backend
/api
/lib
/services
/middleware

Database
/prisma

Infrastructure
/scripts
/github
/docker
/ci

---

# Regra absoluta de escopo

Cada agente executa SOMENTE sua própria tarefa.

É proibido:

- alterar arquivos fora do escopo
- criar arquivos não solicitados
- modificar configurações globais
- alterar arquitetura sem autorização
- instalar dependências sem autorização
- atualizar versões automaticamente
- remover código sem justificativa

Caso encontre outro problema:

NÃO CORRIJA.

Apenas informe ao orquestrador.

---

# Qualidade

Antes de concluir qualquer tarefa:

- verificar erros de sintaxe
- verificar imports
- verificar referências quebradas
- verificar compilação quando possível

Não considere a tarefa concluída enquanto houver erro causado pela própria alteração.

---

# Código

Priorize:

- simplicidade
- legibilidade
- baixo acoplamento
- reutilização

Evite duplicação.

Evite comentários desnecessários.

---

# Resposta Final

Sempre termine com:

Resumo:
• arquivos alterados
• alterações realizadas
• pendências encontradas (se houver)

## Filtro, permissão e visibilidade: executar antes de commitar

Ao alterar qualquer condição de filtro, permissão ou visibilidade, executar
a consulta real com o caso POSITIVO e o caso NEGATIVO antes de commitar.

`tsc` e suíte verde validam FORMA, não comportamento. Três falhas vieram
daí numa única sessão:

1. Conclusão de que a busca de montadores não filtrava verificação — o
   filtro estava doze linhas abaixo, num `.filter()`.
2. Conclusão de que o Prisma removeria um índice parcial — ele não o
   enxerga, então não o remove.
3. Duas chaves `OR` no mesmo `where`: a segunda apagava a primeira e
   diarista NÃO VERIFICADA aparecia na busca com filtro de tipo. Passou por
   `tsc`, por lint e por 275 testes.

Ao relatar, marcar cada afirmação:
  [VERIFICADO] — executou e observou o comportamento
  [LIDO]       — concluiu a partir do código, sem executar

Não apresentar [LIDO] como fato.

## Verde no CI não é verde no deploy

Uma tarefa não está concluída enquanto TODOS os checks do PR não estiverem
verdes, **o deploy incluído**. `next build` sair 0 não significa que a
publicação será aceita: validações de runtime Edge só acontecem no deploy.

O caso que originou a regra: `src/instrumentation.ts` importava um módulo que
importa o Prisma. Como o projeto tem middleware, o Next compila o
instrumentation também para o runtime Edge, onde o Prisma puxa
`node:util/types`. Build local exit 0, oito checks de CI verdes, e o Vercel
recusando a publicação:

    The Edge Function "_middleware" is referencing unsupported modules:
    - __vc__ns__/0/web/index.js: node:util/types

Vale além do Edge: `tsc` e testes veem o FONTE, não o artefato publicado. Se a
afirmação é sobre o que roda em produção, a prova tem que ser feita sobre o
artefato — o bundle, o deploy — e não sobre o código que o gerou.

## `__DEV__` não é gate de segurança

`__DEV__` é otimização de minificador, não controle de acesso. Ele só elimina
o que está **sintaticamente dentro** do condicional: uma função declarada fora
vai para o bundle de produção mesmo que nada a chame.

Conferido com `expo export --platform ios` + `strings` no `.hbc`: o JSX dentro
de `{__DEV__ ? (...) : null}` sumiu, e o `useCallback` que ele chamava — junto
com o `fetch` para `/api/auth/login` — continuou no bundle publicado. O
comentário no código afirmava que "este bloco inteiro (estado, handler e UI)
some do app publicado". Não somia.

Verificar por MEDIÇÃO do bundle, nunca por leitura do código. Sempre com
controle positivo: uma string que você sabe que está no app publicado, para
provar que a busca acharia se estivesse lá.
