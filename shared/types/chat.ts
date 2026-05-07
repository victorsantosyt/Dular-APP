import type { DateString } from "./common";
import type { Usuario } from "./usuario";

export type MessageType = "TEXT" | "IMAGE" | "LOCATION" | "SYSTEM";

// Sincronizar com schema.prisma se o modelo mudar
export type ChatMessage = {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  type: MessageType;
  readAt: DateString | null;
  createdAt: DateString;
  sender?: Pick<Usuario, "id" | "nome" | "avatarUrl"> | null;
};

// Sincronizar com schema.prisma se o modelo mudar
export type ChatRoom = {
  id: string;
  servicoId: string;
  createdAt: DateString;
  messages?: ChatMessage[];
};
