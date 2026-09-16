import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
import * as Location from "expo-location";

import { acionarSos } from "@/api/segurancaApi";

/** Segundos entre o fim do pedido de permissão e a ligação para o 190. */
export const SOS_190_SEGUNDOS = 5;

/** Tempo máximo esperando o GPS; depois disso vale a última posição conhecida. */
const LIMITE_GPS_MS = 4000;

/** Tempo máximo esperando a resposta do diálogo de permissão. */
const LIMITE_PERMISSAO_MS = 6000;

/** Tempo máximo esperando o app voltar ao primeiro plano antes de contar assim mesmo. */
const ESPERA_FOREGROUND_MS = 15000;

const TIPO = "Emergência 190";
const PRIORIDADE = "CRITICA";
const MENSAGEM = "Botão de emergência: ligação para a Polícia Militar (190) aberta pelo app.";

type Coordenadas = { latitude: number; longitude: number };

/**
 * Botão de emergência com ligação para o 190, compartilhado pelas telas de
 * montador e diarista.
 *
 * `iniciar` primeiro resolve a permissão de localização: na primeira vez o
 * sistema mostra o diálogo; já concedida ou negada em definitivo, resolve em
 * milissegundos (ver `pedirPermissaoDeLocalizacao`). Resolvida a permissão, só
 * abre a contagem com o app em primeiro plano (ver `esperarPrimeiroPlano`), para
 * a pessoa ver o contador e alcançar o cancelar. Só então começa a
 * contagem de SOS_190_SEGUNDOS, que pode ser cancelada, e a busca da
 * localização (se permitida). Se ninguém cancelar, duas coisas começam juntas,
 * sem uma esperar a outra:
 *  - a discagem do 190 via `tel:`. Sem permissão CALL_PHONE: o sistema só abre
 *    o discador com o número, e quem completa a ligação é a pessoa;
 *  - o registro do SOS no backend, best-effort, com a localização se ela veio
 *    (falha só vai para o log).
 *
 * Negar a localização não muda o resto: a ligação sai igual e o SOS vai sem
 * coordenada. Cancelar, sair da tela ou mandar o app para segundo plano
 * durante a contagem limpa o timer: nada é registrado e nada é discado depois.
 */
export function useSosEmergencia() {
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const localizacao = useRef<Promise<Coordenadas | undefined> | null>(null);
  /** Do toque até a contagem abrir: pedido de permissão e espera pelo primeiro plano. */
  const pedindoPermissao = useRef(false);
  const montado = useRef(true);

  const cancelar = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
    localizacao.current = null;
    setSegundosRestantes(null);
  }, []);

  const iniciar = useCallback(
    async (servicoId?: string) => {
      // Toque repetido durante o pedido de permissão ou a contagem não inicia outra.
      if (pedindoPermissao.current || timer.current !== null) return;

      // A permissão é resolvida ANTES de a contagem existir. O diálogo do sistema
      // tira o app de "active", e o listener de AppState abaixo cancelaria uma
      // contagem em andamento; sem contagem, não há o que cancelar.
      pedindoPermissao.current = true;
      let permitido = false;
      try {
        permitido = await pedirPermissaoDeLocalizacao();

        // A tela pode ter sido fechada enquanto o diálogo estava aberto.
        if (!montado.current) return;

        // No iOS o diálogo deixa o app em "inactive" sem parar o JS: sem esta
        // espera, a contagem correria atrás do modal — a pessoa não veria o
        // contador, não alcançaria o cancelar, e a ligação sairia às cegas.
        await esperarPrimeiroPlano();
        if (!montado.current) return;

        // A resposta pode ter chegado depois de LIMITE_PERMISSAO_MS, durante a
        // espera. Reler o estado é barato e não abre diálogo, então uma
        // concessão atrasada ainda vale para ESTE acionamento, e não só para o
        // toque seguinte.
        if (!permitido) permitido = await permissaoConcedidaAgora();
      } finally {
        // Sempre liberado: o pedido desiste sozinho depois de LIMITE_PERMISSAO_MS
        // e a espera tem teto, então nem um diálogo sem resposta nem um app que
        // não volta deixam o botão preso nos toques seguintes.
        pedindoPermissao.current = false;
      }

      if (!montado.current) return;

      // A busca começa junto com a contagem para estar pronta (ou desistida)
      // quando ela terminar; o registro não fica esperando o GPS depois da ligação.
      localizacao.current = permitido ? buscarCoordenadas() : null;

      // A contagem usa o horário de término, não o número de ticks: um tick
      // atrasado não estica a espera.
      const fim = Date.now() + SOS_190_SEGUNDOS * 1000;
      setSegundosRestantes(SOS_190_SEGUNDOS);
      timer.current = setInterval(() => {
        const restante = Math.ceil((fim - Date.now()) / 1000);
        if (restante > 0) {
          setSegundosRestantes(restante);
          return;
        }
        const coordenadas = localizacao.current;
        cancelar();
        dispararEmergencia(servicoId, coordenadas);
      }, 250);
    },
    [cancelar],
  );

  // App para segundo plano durante a contagem: cancela, para não discar o 190
  // de surpresa quando a pessoa voltar.
  useEffect(() => {
    const assinatura = AppState.addEventListener("change", (estado) => {
      if (estado !== "active" && timer.current !== null) cancelar();
    });
    return () => assinatura.remove();
  }, [cancelar]);

  // Tela desmontada: só limpa o timer e impede que um pedido de permissão ainda
  // aberto inicie a contagem depois.
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      if (timer.current !== null) clearInterval(timer.current);
    };
  }, []);

  return {
    ativo: segundosRestantes !== null,
    segundosRestantes,
    iniciar,
    cancelar,
  };
}

function dispararEmergencia(servicoId: string | undefined, localizacao: Promise<Coordenadas | undefined> | null) {
  // A ligação sai agora, sem esperar nada.
  Linking.openURL("tel:190").catch((err) => {
    console.error("[SOS 190] falha ao abrir a discagem:", err);
  });

  // O registro começa no mesmo tick e só aguarda o que resta da busca de
  // localização iniciada na contagem; sem localização, vai sem coordenada.
  (localizacao ?? Promise.resolve(undefined))
    .then((coords) =>
      acionarSos({
        servicoId,
        tipo: TIPO,
        prioridade: PRIORIDADE,
        mensagem: MENSAGEM,
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
      }),
    )
    .catch((err) => {
      console.error("[SOS 190] falha ao registrar no backend:", err);
    });
}

/**
 * Estado atual da permissão, sem pedir nada: responde em milissegundos, não abre
 * diálogo e não tira o app de "active". Serve para aproveitar uma concessão que
 * chegou tarde demais para o prazo do pedido. Qualquer falha conta como não
 * permitida.
 */
async function permissaoConcedidaAgora(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Espera o app estar em primeiro plano para a contagem começar. Já em "active",
 * resolve na hora e nada muda.
 *
 * O diálogo de permissão do iOS deixa o app em "inactive" mas não para o JS: uma
 * contagem aberta ali rodaria escondida atrás do modal, sem contador visível e
 * sem cancelar alcançável, e discaria o 190 sozinha. Esperar o "active" devolve
 * à pessoa os dois. Passado ESPERA_FOREGROUND_MS sem voltar, a contagem começa
 * assim mesmo: um SOS que some é pior que um SOS que a pessoa não viu começar.
 *
 * O listener daqui é removido assim que resolve — ele é da fase anterior à
 * contagem e não se cruza com o listener de cancelamento, que só age com a
 * contagem já rodando.
 */
function esperarPrimeiroPlano(): Promise<void> {
  if (AppState.currentState === "active") return Promise.resolve();

  return new Promise((resolve) => {
    let encerrado = false;
    const encerrar = () => {
      if (encerrado) return;
      encerrado = true;
      clearTimeout(teto);
      assinatura.remove();
      resolve();
    };

    const assinatura = AppState.addEventListener("change", (estado) => {
      if (estado === "active") encerrar();
    });
    const teto = setTimeout(encerrar, ESPERA_FOREGROUND_MS);
  });
}

/**
 * Pede a permissão de localização em primeiro plano, a mesma do SOS antigo
 * (`useSeguranca`).
 *
 * A consulta do estado atual vem primeiro porque responde em milissegundos, sem
 * diálogo e sem tirar o app de "active". Ela resolve sozinha os dois casos já
 * decididos — concedida e negada sem poder pedir de novo — e o pedido só é feito
 * quando o sistema ainda vai mostrar o diálogo. Isso importa no Android: pedir
 * de novo uma permissão negada em definitivo abre a tela de permissão invisível
 * e deixa o app alguns segundos fora de "active" só para responder que não.
 *
 * Como o estado é lido a cada toque, liberar a localização nas Configurações e
 * voltar para o app passa a valer no toque seguinte. Qualquer falha conta como
 * não permitida.
 *
 * O pedido em si tem prazo: um diálogo que fica sem resposta — ou que é fechado
 * sem responder, o que deixa a promessa pendurada — não pode prender o botão de
 * emergência. Passado LIMITE_PERMISSAO_MS o toque segue sem localização, e a
 * resposta que vier depois não se perde: o próximo toque relê o estado.
 */
async function pedirPermissaoDeLocalizacao(): Promise<boolean> {
  try {
    const atual = await Location.getForegroundPermissionsAsync();
    if (atual.status === "granted") return true;
    if (!atual.canAskAgain) return false;

    const pedido = Location.requestForegroundPermissionsAsync()
      .then(({ status }) => status === "granted")
      .catch(() => false);
    const limite = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), LIMITE_PERMISSAO_MS));

    return await Promise.race([pedido, limite]);
  } catch {
    return false;
  }
}

/**
 * Coordenada para o registro do SOS, chamada só com a permissão já concedida.
 * Espera o GPS por até LIMITE_GPS_MS e cai para a última posição conhecida. No
 * Android não abre o diálogo para ligar o GPS: ele tiraria o app de "active"
 * com a contagem já rodando, e a contagem seria cancelada.
 */
async function buscarCoordenadas(): Promise<Coordenadas | undefined> {
  try {
    const atual = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: false,
    })
      .then(emCoordenadas)
      .catch(() => undefined);
    const limite = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), LIMITE_GPS_MS));

    const coords = await Promise.race([atual, limite]);
    if (coords) return coords;

    const ultima = await Location.getLastKnownPositionAsync();
    return ultima ? emCoordenadas(ultima) : undefined;
  } catch {
    return undefined;
  }
}

function emCoordenadas(posicao: Location.LocationObject): Coordenadas {
  return { latitude: posicao.coords.latitude, longitude: posicao.coords.longitude };
}
