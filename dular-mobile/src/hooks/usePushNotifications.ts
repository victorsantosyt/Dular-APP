import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { api } from "@/lib/api";
import { navRef } from "@/navigation/nav";
import { useAuth } from "@/stores/authStore";
import { colors } from "@/theme/tokens";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: colors.pushGreen,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: "com.dular.app",
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

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response.notification.request.content.data as NotificationData);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}
