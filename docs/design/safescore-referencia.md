# SafeScore — referência visual aprovada

Imagem: [`safescore-referencia.jpg`](safescore-referencia.jpg) — tela "SafeScore" nos três temas do app:
**01 · Lavanda**, **02 · Feminino**, **03 · Masculino**. O conteúdo é o de um perfil novo (sem serviços,
identidade pendente, sem SOS). A estrutura é a mesma nos três temas; muda só a cor de destaque
(ícones, escudo, links, cartão de verificação, fundo levemente tingido).

## Estrutura, de cima para baixo

1. **Cabeçalho**: botão circular de voltar à esquerda; título **"SafeScore"** centralizado.
2. **Rótulo de seção** em caixa-alta, pequeno e espaçado: **"REPUTAÇÃO E CONFIANÇA"**.
3. **Cartão principal** (branco, cantos arredondados, sombra suave):
   - à esquerda, título em duas linhas **"Sua confiança, em evolução."** e, abaixo, uma pílula de
     status com ponto colorido (na referência: ponto laranja + **"Em observação"** sobre fundo creme);
   - à direita, **escudo com check** na cor do tema.
4. Legenda centralizada abaixo do cartão: **"Seu histórico de confiança na Dular."**
5. Seção **"Seu perfil em detalhes"** — cartão com três linhas, cada uma com ícone quadrado
   arredondado (fundo claro do tema), título, subtítulo cinza e valor à direita, separadas por divisória:
   - **"Nível atual"** / "Sua jornada na plataforma" → medalha + nome do nível (ex.: **Bronze**);
   - **"Serviços concluídos"** / "Histórico de atendimentos" → número (ex.: **0**);
   - **"Identidade"** / "Verificação do perfil" → pílula de status (ex.: **"Pendente"**, fundo creme).
6. **Cartão de ação** com fundo tingido do tema: ícone de documento, **"Verifique sua identidade"**
   (na cor do tema) / "Complete esta etapa do seu perfil", chevron à direita. Só quando a identidade
   não está verificada.
7. Seção **"Acompanhamento de SOS"** com ícone de informação (ⓘ) à direita do título — cartão com
   sino em círculo do tema, **"Nenhum SOS acionado"** e "Se você acionar o SOS, acompanhe o status e o
   protocolo por aqui." (estado vazio, só depois de consulta bem-sucedida).
8. Link no rodapé, sem cartão: ícone ⓘ/?, **"Como funciona o SafeScore"** na cor do tema e chevron.

## O que a referência NÃO decide

- Os valores exibidos vêm do backend (`/api/me/safescore` e `/api/seguranca/eventos`). A referência
  mostra um exemplo; a tela não pode fixar "Em observação", "Bronze", "0" ou "Pendente".
- Estados de erro/carregamento e lista de SOS com registros não aparecem na imagem e seguem o
  comportamento atual.
