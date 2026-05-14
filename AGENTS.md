## Sub-Agent Routing Rules

**Parallel dispatch** (todos os critérios obrigatórios):
- 2+ tarefas em domínios independentes
- Sem arquivos compartilhados entre elas

**Sequential dispatch** (qualquer condição):
- Output de A alimenta B
- Arquivos compartilhados (risco de conflito)
- Escopo indefinido

## Domain Boundaries
- frontend → /app /components /hooks /constants
- backend  → /api /lib /middleware /services
- database → /prisma

## Regra absoluta de escopo
Cada agente executa SOMENTE o que foi descrito na sua task.
Nenhum agente deve:
- Refatorar código fora do escopo da task
- Criar arquivos não solicitados
- Modificar configurações globais
- Sugerir ou implementar melhorias além do pedido
Se identificar algo a corrigir fora do escopo, REPORTE ao orquestrador. Não aja.
