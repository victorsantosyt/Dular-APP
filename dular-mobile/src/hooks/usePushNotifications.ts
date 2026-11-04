import { pedirSincronizacao } from "@/lib/sincronizacaoConta";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { useNotificacaoPopup } from "@/stores/notificacaoPopupStore";
import { atualizarMensagensAgora, invalidarMensagens } from "@/hooks/useMensagens";
import { invalidarNotificacoes } from "@/hooks/useNotificacoes";
import { chatAbertoAtual } from "@/lib/chatAberto";
import { abrirNotificacao } from "@/lib/abrirNotificacaoNoApp";
import { apresentacaoNoPrimeiroPlano, tratarPushRecebido } from "@/lib/pushPrimeiroPlano";
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
  notificationId?: unknown;
};

function tipoDe(data: NotificationData): string {
  const t = data.type ?? data.tipo;
  return typeof t === "string" ? t : "";
}

const texto = (v: unknown) => (typeof v === "string" && v ? v : null);

/**
 * Respostas a toques já tratadas (pelo identificador do push). O app iniciado
 * pelo toque pode entregar a mesma resposta pelo listener e por
 * `getLastNotificationResponseAsync`, e o gate remonta a cada sessão: sem isto
 * o mesmo toque navegaria duas vezes, ou de novo depois de sair e entrar.
 */
const respostasTratadas = new Set<string>();

function tratarToque(response: Notifications.NotificationResponse) {
  const id = response.notification.request.identifier;
  if (respostasTratadas.has(id)) return;
  respostasTratadas.add(id);
  const data = (response.notification.request.content.data ?? {}) as NotificationData;
  // O título do push é neutro ("Nova mensagem"): não serve de cabeçalho da
  // conversa. A tela usa "Conversa" até o GET trazer o nome.
  abrirNotificacao({
    tipo: tipoDe(data),
    titulo: null,
    servicoId: texto(data.servicoId),
    id: texto(data.notificationId),
    destinatarioId: data.destinatarioId,
  });
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
      // Toda notificação recebida é sinal para conferir a conta no backend
      // (aprovação, assinatura, restrição): a fonte continua sendo o servidor.
      pedirSincronizacao();
      void tratarPushRecebido(n.request.content as never, {
        usuario: sessaoAtual,
        chatAberto: chatAbertoAtual,
        mostrarPopup: (p) => useNotificacaoPopup.getState().mostrar(p),
        atualizarSalas: atualizarMensagensAgora,
        invalidarMensagens,
        invalidarNotificacoes,
      });
    });

    // Toque com o app aberto ou em segundo plano.
    responseListener.current = Notifications.addNotificationResponseReceivedListener(tratarToque);
    // App iniciado pelo toque: a resposta pode ter chegado antes do listener.
    void Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (r) tratarToque(r);
      })
      .catch(() => undefined);

    return () => {
      appState.remove();
      tokenListener.remove();
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}
