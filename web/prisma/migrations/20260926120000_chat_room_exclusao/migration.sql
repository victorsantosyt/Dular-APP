-- Exclusão de conversa ARQUIVADA por participante.
--
-- Só ACRESCENTA uma tabela: nenhuma coluna, linha ou índice existente muda.
-- Uma linha = "esta pessoa tirou esta conversa dos próprios Arquivados". O
-- outro participante, as mensagens (ChatMessage), a sala (ChatRoom), o serviço
-- e as avaliações ficam como estão; nada é apagado.
--
-- Reversão: o código anterior não lê esta tabela, então basta voltar o código
-- (as conversas excluídas reaparecem, nada se perde). Remover a tabela, se um
-- dia for preciso, é uma migration nova com DROP TABLE "ChatRoomExclusao".

-- CreateTable
CREATE TABLE "ChatRoomExclusao" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRoomExclusao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatRoomExclusao_userId_idx" ON "ChatRoomExclusao"("userId");

-- CreateIndex
-- Uma exclusão por (sala, pessoa): é o que torna o DELETE idempotente.
CREATE UNIQUE INDEX "ChatRoomExclusao_roomId_userId_key" ON "ChatRoomExclusao"("roomId", "userId");

-- AddForeignKey
ALTER TABLE "ChatRoomExclusao" ADD CONSTRAINT "ChatRoomExclusao_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoomExclusao" ADD CONSTRAINT "ChatRoomExclusao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
