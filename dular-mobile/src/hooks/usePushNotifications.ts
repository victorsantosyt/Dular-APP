import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "@/lib/api";
import { navRef } from "@/navigation/nav";
import { useAuth } from "@/stores/authStore";
import { useNotificacaoPopup } from "@/stores/notificacaoPopupStore";
import { colors } from "@/theme/tokens";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // Banner do SISTEMA desligado com o app em primeiro plano: nesse caso quem
    // aparece é o popup do próprio app (NotificacaoPopup), que segue o tema do
    // perfil e leva direto para a tela certa. Mostrar os dois empilharia dois
    // avisos da mesma coisa. Com o app fechado ou em segundo plano o sistema
    // continua entregando normalmente — este handler só roda em primeiro plano.
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: colors.pushGreen,
    });
  }

  const { granted: alreadyGranted } = await Notifications.getPermissionsAsync();
  let isGranted = alreadyGranted;

  if (!isGranted) {
    const { granted } = await Notifications.requestPermissionsAsync();
    isGranted = granted;
  }

  if (!isGranted) {
    return null;
  }

  // O TOKEN de push exige aparelho físico — o simulador não tem APNs. Só a
  // partir daqui, então, é que o simulador para.
  //
  // A permissão, acima, é pedida também no simulador de propósito: sem ela o
  // iOS descarta em silêncio qualquer notificação enviada por `simctl push`, e
  // era impossível conferir como os avisos se agrupam na tela de bloqueio sem
  // instalar num telefone. Em aparelho real nada muda: as duas etapas rodam
  // na mesma ordem de sempre.
  if (!Device.isDevice) {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    throw new Error("EAS projectId não configurado.");
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  return tokenData.data;
}

type NotificationData = {
  tipo?: unknown;
  servicoId?: unknown;
};

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

function handleNotificationResponse(data: NotificationData) {
  const { role, user } = useAuth.getState();
  const activeRole = role ?? user?.role;

  if (activeRole === "MONTADOR" && data.tipo === "NOVA_SOLICITACAO") {
    navigateWhenReady("MontadorSolicitacoes");
  }
}

export function usePushNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    registerForPushNotifications().then(async (token) => {
      if (!token) return;
      try {
        await api.post("/api/me/push-token", { pushToken: token });
      } catch (err) {
        console.error("[push] falha ao salvar token:", err);
      }
    });

    // Chegou com o app aberto: mostra o aviso do próprio app. Antes este
    // listener era vazio e a notificação passava despercebida.
    notificationListener.current = Notifications.addNotificationReceivedListener((n) => {
      const conteudo = n.request.content;
      const dados = (conteudo.data ?? {}) as NotificationData & {
        chatRoomId?: unknown;
      };
      useNotificacaoPopup.getState().mostrar({
        tipo: typeof dados.tipo === "string" ? dados.tipo : "SISTEMA",
        titulo: conteudo.title ?? "Dular",
        corpo: conteudo.body ?? "",
        servicoId: typeof dados.servicoId === "string" ? dados.servicoId : null,
        chatRoomId: typeof dados.chatRoomId === "string" ? dados.chatRoomId : null,
      });
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response.notification.request.content.data as NotificationData);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}
