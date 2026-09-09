import { useEffect } from "react";
import * as Notifications from "expo-notifications";

import { useNotificacoes } from "@/hooks/useNotificacoes";
import { useMensagens, totalNaoLidas } from "@/hooks/useMensagens";

/**
 * Mantém o número no ícone do app igual ao que a pessoa realmente tem por ver.
 *
 * O backend manda o `badge` junto do push, para o número subir mesmo com o app
 * fechado. Mas só isso não basta: quem lê tudo dentro do app ficaria com o
 * número velho grudado no ícone até chegar o próximo push. Este hook fecha o
 * ciclo — sempre que a contagem muda (inclusive ao marcar como lido), reescreve
 * o badge.
 *
 * A conta é a MESMA dos dois lados: avisos não lidos (o sino, que já exclui as
 * notificações de chat) mais mensagens não lidas. Se as duas definições
 * divergissem, o ícone brigaria com os contadores das abas.
 */
export function useSincronizarBadge(): void {
  const { unreadCount } = useNotificacoes();
  const { rooms } = useMensagens();

  const total = unreadCount + totalNaoLidas(rooms);

  useEffect(() => {
    // Falha aqui não pode derrubar nada: em Expo Go, ou sem permissão, o
    // sistema simplesmente recusa.
    Notifications.setBadgeCountAsync(total).catch(() => {});
  }, [total]);
}

export default useSincronizarBadge;
