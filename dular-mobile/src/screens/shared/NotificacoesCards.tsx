import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppIcon, DEmptyState, DErrorState, DLoadingState } from "@/components/ui";
import { metaDoTipo, tonePalette, type NotificationTone } from "@/constants/notificacoes";
import { obterHistoricoVerificacao, type CardNotificacao, type EstadoAcionavel, type HistoricoVerificacao } from "@/api/notificacoesApi";
import { datasDoCard, tituloDoCard, type EstadoCards } from "@/lib/cardsNotificacoes";
import { epocaSessao } from "@/lib/sessaoAtual";
import type { ProfileTheme } from "@/theme/profileTheme";
import { colors, radius, shadows, spacing, typography } from "@/theme";

/**
 * Cards da tela de Notificações com o estado ATUAL vindo do servidor. O texto
 * e a data do aviso original continuam visíveis (é histórico); o rótulo e o
 * título dizem o que vale agora. Nenhum estado é calculado aqui.
 */

const TOM: Record<EstadoAcionavel, NotificationTone> = {
  ACAO_NECESSARIA: "urgent",
  EM_ANALISE: "info",
  RESOLVIDO: "success",
  SUPERADO: "primary",
  AVISO_ANTERIOR: "primary",
};

const ROTULO_DECISAO: Record<string, string> = { APROVADO: "Aprovado", REPROVADO: "Não aprovado", REENVIO: "Reenvio solicitado" };

function dataCurta(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Cartao({ card, theme, onAbrir, onHistorico }: { card: CardNotificacao; theme: ProfileTheme; onAbrir: () => void; onHistorico: () => void }) {
  const meta = metaDoTipo(card.principal.type);
  const tom = card.apresentacao ? TOM[card.apresentacao.estado] : meta.tone;
  const palette = tonePalette(tom, theme);
  const datas = datasDoCard(card);
  const principalNaoLido = !card.principal.readAt;
  const ocultosNaoLidos = card.naoLidos - (principalNaoLido ? 1 : 0);
  const texto = card.apresentacao?.estado === "ACAO_NECESSARIA" && card.apresentacao.motivo ? `Motivo: ${card.apresentacao.motivo}` : card.principal.body;

  return (
    <View style={styles.card}>
      <Pressable onPress={onAbrir} accessibilityRole="button" accessibilityLabel={tituloDoCard(card)} style={({ pressed }) => [styles.cardLinha, pressed && styles.pressed]}>
        <View style={styles.unreadColumn}>{principalNaoLido ? <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} /> : null}</View>
        <View style={[styles.iconBubble, { backgroundColor: palette.soft }]}>
          <AppIcon name={meta.icon} size={20} color={palette.accent} strokeWidth={2.2} />
        </View>
        <View style={styles.cardContent}>
          {card.apresentacao ? (
            <View style={[styles.badge, { backgroundColor: palette.soft }]}>
              <Text style={[styles.badgeText, { color: palette.accent }]} numberOfLines={1}>{card.apresentacao.rotulo}</Text>
            </View>
          ) : null}
          <Text style={styles.cardTitle}>{card.apresentacao ? card.apresentacao.titulo : card.principal.title}</Text>
          <Text style={styles.cardText} numberOfLines={3}>{texto}</Text>
          {card.apresentacao ? <Text style={styles.original} numberOfLines={1}>Aviso: {card.principal.title}</Text> : null}
          <Text style={styles.time}>
            Aviso de {dataCurta(datas.evento)}
            {datas.estadoAtualizadoEm ? ` · situação atualizada em ${dataCurta(datas.estadoAtualizadoEm)}` : ""}
          </Text>
          {ocultosNaoLidos > 0 ? (
            <Text style={[styles.time, { color: theme.primary }]}>
              {ocultosNaoLidos === 1 ? "1 atualização não lida no histórico" : `${ocultosNaoLidos} atualizações não lidas no histórico`}
            </Text>
          ) : null}
        </View>
        <AppIcon name="ChevronRight" size={18} color={theme.primary} strokeWidth={2.3} />
      </Pressable>
      {card.tipo === "VERIFICACAO" ? (
        <Pressable onPress={onHistorico} accessibilityRole="button" style={({ pressed }) => [styles.historicoBotao, pressed && styles.pressed]}>
          <AppIcon name="Clock" size={14} color={theme.primary} strokeWidth={2.3} />
          <Text style={[styles.historicoTexto, { color: theme.primary }]}>Ver histórico</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Histórico da verificação: todos os envios e decisões. Marca como lidos só os avisos mostrados. */
function Historico({ aberto, theme, onFechar, onMostrados }: { aberto: boolean; theme: ProfileTheme; onFechar: () => void; onMostrados: (ids: string[]) => void }) {
  const [dados, setDados] = useState<HistoricoVerificacao | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!aberto) return;
    setDados(null);
    setErro(false);
    const epoca = epocaSessao();
    const controle = new AbortController();
    obterHistoricoVerificacao(controle.signal)
      .then((h) => {
        if (controle.signal.aborted || epocaSessao() !== epoca) return;
        setDados(h);
        const naoLidos = [...h.envios.flatMap((e) => e.decisoes.flatMap((d) => d.avisos)), ...h.semVinculo].filter((a) => !a.readAt).map((a) => a.id);
        if (naoLidos.length) onMostrados(naoLidos);
      })
      .catch(() => {
        if (!controle.signal.aborted && epocaSessao() === epoca) setErro(true);
      });
    return () => controle.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, tentativa]);

  return (
    <Modal visible={aberto} transparent animationType="fade" onRequestClose={onFechar}>
      <View style={styles.modalFundo}>
        <View style={styles.modalCartao}>
          <Text style={styles.modalTitulo}>Histórico da verificação</Text>
          <Text style={styles.modalSub}>Decisões e avisos como aconteceram. A situação vigente é a do envio atual.</Text>
          {erro ? (
            <DErrorState message="Não foi possível carregar o histórico." onRetry={() => setTentativa((n) => n + 1)} />
          ) : !dados ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: spacing.sm }}>
              {dados.envios.map((e) => (
                <View key={e.id} style={styles.envio}>
                  <Text style={styles.envioTitulo}>{e.atual ? "Envio atual" : "Envio anterior"} · {dataCurta(e.enviadoEm)}</Text>
                  {e.decisoes.length === 0 ? <Text style={styles.cardText}>Em análise, sem decisão ainda.</Text> : null}
                  {e.decisoes.map((d) => (
                    <View key={d.id} style={styles.decisao}>
                      <Text style={styles.decisaoTitulo}>{ROTULO_DECISAO[d.decisao] ?? d.decisao} · {dataCurta(d.em)}</Text>
                      {d.avisos.map((a) => (
                        <Text key={a.id} style={styles.cardText}>Aviso: {a.title}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              ))}
              {dados.semVinculo.length ? (
                <View style={styles.envio}>
                  <Text style={styles.envioTitulo}>Avisos anteriores sem vínculo a um envio</Text>
                  {dados.semVinculo.map((a) => (
                    <Text key={a.id} style={styles.cardText}>{dataCurta(a.createdAt)} · {a.title}</Text>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          )}
          <Pressable onPress={onFechar} accessibilityRole="button" style={({ pressed }) => [styles.fecharBotao, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
            <Text style={styles.fecharTexto}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function NotificacoesCards({
  estado,
  theme,
  onAbrir,
  onRecarregar,
  onCarregarMais,
  onMostradosNoHistorico,
}: {
  estado: EstadoCards;
  theme: ProfileTheme;
  onAbrir: (card: CardNotificacao) => void;
  onRecarregar: () => void;
  onCarregarMais: () => void;
  onMostradosNoHistorico: (cardId: string, ids: string[]) => void;
}) {
  const [historicoDe, setHistoricoDe] = useState<string | null>(null);

  if (estado.carregando && estado.cards.length === 0) return <DLoadingState text="Carregando notificações" color={theme.primary} />;
  // Sem dado confirmado não se mostra estado nenhum (nada de "resolvido" por falha).
  if (estado.erro && estado.cards.length === 0) return <DErrorState message={estado.erro} onRetry={onRecarregar} />;

  return (
    <View style={{ gap: 8 }}>
      {estado.contadores && estado.contadores.acoesNecessarias > 0 ? (
        <View style={[styles.acoes, { borderColor: colors.danger }]}>
          <AppIcon name="AlertTriangle" size={15} color={colors.danger} strokeWidth={2.3} />
          <Text style={[styles.acoesTexto, { color: colors.danger }]}>
            {estado.contadores.acoesNecessarias === 1 ? "1 ação necessária" : `${estado.contadores.acoesNecessarias} ações necessárias`}
          </Text>
        </View>
      ) : null}
      {estado.erro ? (
        <Pressable onPress={onRecarregar} style={styles.avisoErro} accessibilityRole="button">
          <Text style={styles.avisoErroTexto}>Não foi possível atualizar. A situação mostrada pode estar desatualizada. Tocar para tentar de novo.</Text>
        </Pressable>
      ) : null}
      {estado.cards.length === 0 ? (
        <DEmptyState icon="Bell" title="Sem notificações" subtitle="Quando houver novidades, solicitações ou avisos, eles aparecerão aqui." accentColor={theme.primary} softBg={theme.primarySoft} />
      ) : (
        estado.cards.map((c) => (
          <Cartao key={c.id} card={c} theme={theme} onAbrir={() => onAbrir(c)} onHistorico={() => setHistoricoDe(c.id)} />
        ))
      )}
      {estado.proximoCursor ? (
        <Pressable onPress={onCarregarMais} disabled={estado.carregando} style={styles.mais} accessibilityRole="button">
          <Text style={[styles.historicoTexto, { color: theme.primary }]}>{estado.carregando ? "Carregando…" : "Carregar mais"}</Text>
        </Pressable>
      ) : null}
      <Historico
        aberto={historicoDe != null}
        theme={theme}
        onFechar={() => setHistoricoDe(null)}
        onMostrados={(ids) => historicoDe && onMostradosNoHistorico(historicoDe, ids)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadows.soft },
  cardLinha: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 10, paddingLeft: 8, paddingRight: 10 },
  pressed: { opacity: 0.8 },
  unreadColumn: { width: 8, alignItems: "center" },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  iconBubble: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  cardContent: { flex: 1, minWidth: 0, gap: 3 },
  badge: { alignSelf: "flex-start", borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { ...typography.caption, fontWeight: "700" },
  cardTitle: { color: colors.textPrimary, ...typography.bodySm, fontWeight: "700" },
  cardText: { color: colors.textSecondary, ...typography.caption },
  original: { color: colors.textMuted, ...typography.caption },
  time: { color: colors.textMuted, ...typography.caption },
  historicoBotao: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingBottom: 10, paddingTop: 2, minHeight: 36 },
  historicoTexto: { ...typography.caption, fontWeight: "700" },
  acoes: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" },
  acoesTexto: { ...typography.caption, fontWeight: "700" },
  avisoErro: { backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: 10 },
  avisoErroTexto: { color: colors.textPrimary, ...typography.caption },
  mais: { alignItems: "center", paddingVertical: 12, minHeight: 44 },
  modalFundo: { flex: 1, backgroundColor: "rgba(17,24,39,0.45)", justifyContent: "center", padding: spacing.lg },
  modalCartao: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, ...shadows.floating },
  modalTitulo: { ...typography.title, color: colors.textPrimary },
  modalSub: { ...typography.caption, color: colors.textSecondary },
  envio: { gap: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  envioTitulo: { ...typography.bodySm, fontWeight: "700", color: colors.textPrimary },
  decisao: { gap: 2, paddingLeft: 8 },
  decisaoTitulo: { ...typography.caption, fontWeight: "700", color: colors.textPrimary },
  fecharBotao: { marginTop: spacing.sm, minHeight: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  fecharTexto: { ...typography.button, color: colors.white },
});
