import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "@/lib/api";
import { criarRegistroPush, type ResultadoSaida } from "@/lib/registroPush";
import { sessaoAtual } from "@/lib/sessaoAtual";
import { colors } from "@/theme/tokens";

/**
 * Instância ÚNICA do ciclo de vida do token de push (lib/registroPush), usada
 * pelo hook de push (registro, primeiro plano, troca de token) e pelo logout
 * do authStore (desassociação). Um só coordenador: registro e DELETE nunca
 * correm soltos um do outro. Não importa o authStore (sem ciclo de import).
 */

/** `pedirPermissao=false` nas novas tentativas: não repete o diálogo do sistema. */
async function registerForPushNotifications(pedirPermissao = true): Promise<string | null> {
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

  if (!isGranted && pedirPermissao) {
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

let pediuPermissao = false;

export const registroPush = criarRegistroPush({
  usuario: sessaoAtual,
  obterToken: async () => {
    const pedir = !pediuPermissao;
    pediuPermissao = true;
    return registerForPushNotifications(pedir);
  },
  enviar: (pushToken) => api.post("/api/me/push-token", { pushToken }),
});

/**
 * Logout pedido pela pessoa: desassocia o token deste aparelho da conta que
 * está saindo, antes de apagar o JWT (a rota exige a sessão). Com prazo:
 * sem rede, o logout local segue e o próximo login move o token no servidor.
 * O resultado não é mostrado a ninguém; "removido" só significa que o
 * servidor confirmou o DELETE (limites em lib/registroPush).
 */
export function encerrarPushDaSessao(): Promise<ResultadoSaida> {
  return registroPush.desassociar((pushToken) =>
    api.delete("/api/me/push-token", { data: { pushToken } }),
  );
}
