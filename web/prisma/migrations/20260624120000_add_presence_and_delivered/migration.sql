-- Chat Etapa 2: presença (lastSeenAt) + recibo de entrega (deliveredAt).
-- Migration aditiva, não-destrutiva (colunas nullable, sem default).

-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "deliveredAt" TIMESTAMP(3);
