import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/ui/AppIcon";
import { CHAT_TYPES, metaDoTipo, tonePalette } from "@/constants/notificacoes";
import { navRef } from "@/navigation/nav";
import { useAuth } from "@/stores/authStore";
import { useNotificacaoPopup, type PopupNotificacao } from "@/stores/notificacaoPopupStore";
import { getProfileTheme } from "@/theme/profileTheme";
import { colors, radius, spacing, typography } from "@/theme/tokens";

/** Quanto tempo o aviso fica na tela antes de sair sozinho. */
const DURACAO_MS = 4600;

/**
 * Para onde o toque leva, conforme o papel de quem está logado.
 *
 * Cada perfil tem o seu próprio navegador, com nomes de rota diferentes para a
 * MESMA tela — o montador usa `MontadorChat`/`MontadorDetalheSolicitacao`,
 * os outros dois usam `ChatAberto`/`<Perfil>Detalhe`. Os parâmetros também
 * têm que bater: a tela de detalhe espera `servicoId` (não `id`) e a de chat
 * espera `roomId` + `nomeUsuario` além do serviço.
 */
function destinoDe(n: PopupNotificacao, papel: string | null | undefined): [string, object?] | null {
  const tipo = String(n.tipo);
  const montador = papel === "MONTADOR";

  // Mensagem abre a conversa; o resto que tiver serviço abre o serviço —
  // os mesmos destinos do toque na lista de Notificações.
  if (CHAT_TYPES.has(tipo)) {
    const servicoId = n.servicoId ?? n.chatRoomId;
    if (!servicoId) return null;
    return [
      montador ? "MontadorChat" : "ChatAberto",
      {
        roomId: n.chatRoomId ?? servicoId,
        servicoId,
        // O título de uma notificação de chat é o nome de quem mandou —
        // melhor cabeçalho do que o "Conversa" genérico.
        nomeUsuario: n.titulo || "Conversa",
      },
    ];
  }

  if (n.servicoId) {
    if (montador) return ["MontadorDetalheSolicitacao", { servicoId: n.servicoId }];
    if (papel === "DIARISTA") return ["DiaristaDetalhe", { servicoId: n.servicoId }];
    return ["EmpregadorDetalhe", { servicoId: n.servicoId }];
  }
  return null;
}

/**
 * Aviso in-app de notificação.
 *
 * Fica montado uma vez, na raiz, e escuta a fila em `notificacaoPopupStore`.
 * Aparece por cima de qualquer tela, some sozinho, e sai na hora com um
 * arrastar para cima — o gesto que se espera de um aviso desse tipo.
 */
export function NotificacaoPopup() {
  const atual = useNotificacaoPopup((s) => s.atual);
  const proxima = useNotificacaoPopup((s) => s.proxima);
  const insets = useSafeAreaInsets();

  const user = useAuth((s) => s.user);
  const papel = useAuth((s) => s.role) ?? user?.role ?? null;
  const tema = getProfileTheme({ role: papel, genero: user?.genero });

  const [reduzirMovimento, setReduzirMovimento] = useState(false);
  const y = useRef(new Animated.Value(-200)).current;
  const opacidade = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => vivo && setReduzirMovimento(v));
    return () => {
      vivo = false;
    };
  }, []);

  const sair = useCallback(
    (aoTerminar?: () => void) => {
      if (timer.current) clearTimeout(timer.current);
      Animated.parallel([
        Animated.timing(y, { toValue: -200, duration: 200, useNativeDriver: true }),
        Animated.timing(opacidade, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => {
        aoTerminar?.();
        proxima();
      });
    },
    [y, opacidade, proxima],
  );

  // Entrada + saída automática. Refeito a cada item da fila.
  useEffect(() => {
    if (!atual) return;
    y.setValue(reduzirMovimento ? 0 : -200);
    opacidade.setValue(reduzirMovimento ? 1 : 0);

    if (!reduzirMovimento) {
      Animated.parallel([
        Animated.spring(y, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 6 }),
        Animated.timing(opacidade, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    }

    timer.current = setTimeout(() => sair(), DURACAO_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [atual, reduzirMovimento, y, opacidade, sair]);

  // Arrastar para cima descarta. Só reage a movimento vertical para cima, para
  // não roubar o toque de quem só quis tocar no aviso.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy < -6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        if (g.dy < 0) y.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -40) sair();
        else Animated.spring(y, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
      },
    }),
  ).current;

  if (!atual) return null;

  const meta = metaDoTipo(String(atual.tipo));
  const { accent: cor, soft: fundo } = tonePalette(meta.tone, tema);
  const destino = destinoDe(atual, papel);

  const abrir = () => {
    if (!destino) return sair();
    sair(() => {
      if (!navRef.isReady()) return;
      const [rota, params] = destino;
      (navRef.navigate as unknown as (n: string, p?: object) => void)(rota, params);
    });
  };

  return (
    <Animated.View
      // `pointerEvents="box-none"` no contêiner: ele cobre a largura toda, e
      // sem isto bloquearia o toque do topo da tela mesmo sem aviso visível.
      pointerEvents="box-none"
      style={[
        s.container,
        { top: insets.top + spacing.xs, opacity: opacidade, transform: [{ translateY: y }] },
      ]}
      {...pan.panHandlers}
    >
      <Pressable
        onPress={abrir}
        accessibilityRole="button"
        accessibilityLabel={`${atual.titulo}. ${atual.corpo}`}
        style={({ pressed }) => [s.cartao, { borderColor: cor + "33" }, pressed && s.pressionado]}
      >
        <View style={[s.icone, { backgroundColor: fundo }]}>
          <AppIcon name={meta.icon} size={20} color={cor} strokeWidth={2.2} />
        </View>

        <View style={s.texto}>
          <Text style={s.titulo} numberOfLines={1}>
            {atual.titulo}
          </Text>
          <Text style={s.corpo} numberOfLines={2}>
            {atual.corpo}
          </Text>
        </View>

        {destino ? (
          <AppIcon name="ChevronRight" size={18} color={colors.textMuted} strokeWidth={2.4} />
        ) : null}
        {/* Puxador DENTRO do cartão: solto embaixo dele virava um risco
            cinza no meio da tela, que lia como falha de render. */}
        <View style={s.puxador} />
      </Pressable>
    </Animated.View>
  );
}

export default NotificacaoPopup;

const s = StyleSheet.create({
  container: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
    elevation: 24,
  },
  cartao: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    // `relative` para o puxador se posicionar pela base do cartão.
    position: "relative",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    // Sombra difusa e escura: o aviso flutua sobre conteúdo de qualquer cor e
    // precisa se destacar sem depender do fundo da tela atrás.
    shadowColor: "#1B1235",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  pressionado: { opacity: 0.92, transform: [{ scale: 0.995 }] },
  icone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  texto: { flex: 1, minWidth: 0, gap: 2 },
  titulo: { ...typography.bodySmMedium, color: colors.textPrimary, fontWeight: "700" },
  corpo: { ...typography.caption, color: colors.textSecondary },
  puxador: {
    position: "absolute",
    bottom: 5,
    left: "50%",
    marginLeft: -16,
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
});
