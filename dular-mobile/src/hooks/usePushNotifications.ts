import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { navRef } from "@/navigation/nav";
import { useAuth } from "@/stores/authStore";
import { useNotificacaoPopup } from "@/stores/notificacaoPopupStore";
import { atualizarMensagensAgora, invalidarMensagens } from "@/hooks/useMensagens";
import { invalidarNotificacoes } from "@/hooks/useNotificacoes";
import { chatAbertoAtual } from "@/lib/chatAberto";
import { CHAT_TYPES, destinoDaNotificacao } from "@/lib/destinoNotificacao";
import { apresentacaoNoPrimeiroPlano, pertenceASessao, tratarPushRecebido } from "@/lib/pushPrimeiroPlano";
import { registroPush as registro } from "@/lib/pushCicloDeVida";
import { sessaoAtual } from "@/lib/sessaoAtual";

Notifications.setNotificationHandler({
  // Aviso de outra conta (token ainda associado a ela) não entra na bandeja,
  // não toca som e não mexe no badge com o app aberto. Ver lib/pushPrimeiroPlano.
  handleNotification: async (n) =>
    apresentacaoNoPrimeiroPlano(n.request.content.data as Record<string, unknown>, sessaoAtual()),
});

type NotificationData = {
  tipo?: unknown;
  destinatarioId?: unknown;
  /** O backend manda `type` em `data`; `tipo` fica por compatibilidade. */
  type?: unknown;
  servicoId?: unknown;
};

function tipoDe(data: NotificationData): string {
  const t = data.type ?? data.tipo;
  return typeof t === "string" ? t : "";
}

function navigateWhenReady(routeName: string, params?: object) {
  const navigate = () => {
    if (!navRef.isReady()) return;
    (navRef.navigate as unknown as (name: string, params?: object) => void)(routeName, params);
  };

  if (navRef.isReady()) {
    navigate();
    return;
  }

  setTimeout(navigate, 500);
}

function handleNotificationResponse(data: NotificationData, titulo: string | null) {
  // Toque num aviso de outra conta não navega (a conversa seria de outra pessoa).
  if (!pertenceASessao(data as Record<string, unknown>, sessaoAtual())) return;
  const { role, user } = useAuth.getState();
  const activeRole = role ?? user?.role;
  const tipo = tipoDe(data);

  // Toque num push de mensagem abre a conversa (antes não fazia nada).
  if (CHAT_TYPES.has(tipo)) {
    const destino = destinoDaNotificacao(
      { tipo, titulo, servicoId: typeof data.servicoId === "string" ? data.servicoId : null },
      activeRole,
    );
    if (destino) navigateWhenReady(destino[0], destino[1]);
    return;
  }

  if (activeRole === "MONTADOR" && tipo === "NOVA_SOLICITACAO") {
    navigateWhenReady("MontadorSolicitacoes");
  }
}

export function usePushNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // O gate monta a cada sessão: registra do zero (o logout pode ter
    // desassociado o token no servidor, mesmo sendo a mesma conta).
    void registro.iniciarSessao();
    return () => registro.esquecer();
  }, []);

  useEffect(() => {
    // Nova tentativa quando o app volta ao primeiro plano (costuma coincidir
    // com a rede de volta) e quando o token do aparelho muda.
    const appState = AppState.addEventListener("change", (estado) => {
      if (estado === "active") void registro.garantir();
    });
    const tokenListener = Notifications.addPushTokenListener(() => {
      void registro.tokenMudou();
    });

    // Chegou com o app aberto: mostra o aviso do próprio app (se for desta
    // sessão) e atualiza lista/contador/sino — lib/pushPrimeiroPlano.
    notificationListener.current = Notifications.addNotificationReceivedListener((n) => {
      void tratarPushRecebido(n.request.content as never, {
        usuario: sessaoAtual,
        chatAberto: chatAbertoAtual,
        mostrarPopup: (p) => useNotificacaoPopup.getState().mostrar(p),
        atualizarSalas: atualizarMensagensAgora,
        invalidarMensagens,
        invalidarNotificacoes,
      });
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const conteudo = response.notification.request.content;
      // O título do push agora é neutro ("Nova mensagem"): não serve de
      // cabeçalho da conversa. A tela usa "Conversa" até o GET trazer o nome.
      handleNotificationResponse((conteudo.data ?? {}) as NotificationData, null);
    });

    return () => {
      appState.remove();
      tokenListener.remove();
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}
