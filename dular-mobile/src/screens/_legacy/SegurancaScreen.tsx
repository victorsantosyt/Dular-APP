import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, shadow, spacing } from "@/theme/tokens";
import { PERFIL_STACK_ROUTES } from "@/navigation/routes";

const RED = "#E56B6F";
const RED_DARK = "#B23B41";
const RED_BG = "#FDECEC";
const BLUE = "#3B82F6";
const BLUE_BG = "#E5EEFF";
const YELLOW = "#F5A623";
const YELLOW_BG = "#FFF4DD";
const ORANGE = "#F08A24";

type Emergencia = {
  label: string;
  numero: string;
  bg: string;
  fg: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

const EMERGENCIAS: Emergencia[] = [
  { label: "SAMU",       numero: "192", bg: RED_BG,    fg: RED,    icon: "medkit" },
  { label: "Polícia",    numero: "190", bg: BLUE_BG,   fg: BLUE,   icon: "shield" },
  { label: "Bombeiros",  numero: "193", bg: YELLOW_BG, fg: YELLOW, icon: "flame" },
];

type Dica = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  fg: string;
  bg: string;
  title: string;
  text: string;
};

const DICAS: Dica[] = [
  {
    icon: "checkmark-circle",
    fg: colors.primary,
    bg: colors.secondary,
    title: "Confirme a identidade",
    text: "Cheque o nome e a foto da diarista antes de abrir a porta.",
  },
  {
    icon: "lock-closed",
    fg: BLUE,
    bg: BLUE_BG,
    title: "Guarde objetos de valor",
    text: "Mantenha joias e documentos em local seguro durante o serviço.",
  },
  {
    icon: "chatbubble-ellipses",
    fg: YELLOW,
    bg: YELLOW_BG,
    title: "Comunique pelo app",
    text: "Use o chat oficial para registrar combinados e evitar mal-entendidos.",
  },
  {
    icon: "alert-circle",
    fg: RED,
    bg: RED_BG,
    title: "Em caso de risco",
    text: "Acione o SOS imediatamente e ligue para a emergência apropriada.",
  },
];

function ligar(numero: string) {
  Linking.openURL(`tel:${numero}`).catch(() =>
    Alert.alert("Não foi possível abrir o telefone")
  );
}

export default function SegurancaScreen() {
  const nav = useNavigation<any>();
  const [rastreamento, setRastreamento] = useState(true);
  const [alertas, setAlertas] = useState(true);

  const handleSOS = () => {
    Alert.alert(
      "Acionar SOS",
      "Vamos notificar seus contatos de emergência e mostrar opções de socorro.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Ligar SAMU 192", style: "destructive", onPress: () => ligar("192") },
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>
        <View style={s.headerIcon}>
          <Ionicons name="shield-checkmark" size={20} color={RED} />
        </View>
        <Text style={s.headerTitle}>Segurança</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ─── Botão de Emergência ─── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Botão de Emergência</Text>
          <Text style={s.cardText}>
            Use em caso de risco imediato. Ao acionar, suas coordenadas e contatos de
            confiança serão alertados instantaneamente.
          </Text>

          <Pressable
            onPress={handleSOS}
            style={({ pressed }) => [s.sosBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="warning" size={32} color="#FFFFFF" />
            <Text style={s.sosText}>SOS</Text>
          </Pressable>

          <Pressable hitSlop={6} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={s.linkText}>Configurar contatos de emergência</Text>
          </Pressable>
        </View>

        {/* ─── Localização em tempo real ─── */}
        <View style={s.card}>
          <View style={s.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Localização em tempo real</Text>
              <Text style={s.cardText}>
                Compartilhe sua localização com pessoas de confiança enquanto a diarista
                estiver em sua casa.
              </Text>
            </View>
            <Switch
              value={rastreamento}
              onValueChange={setRastreamento}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={colors.border}
            />
          </View>

          {rastreamento ? (
            <View style={s.activeBadge}>
              <View style={s.activeDot} />
              <Text style={s.activeBadgeText}>Rastreamento ativo agora</Text>
            </View>
          ) : null}
        </View>

        {/* ─── Emergências ─── */}
        <Text style={s.sectionLabel}>EMERGÊNCIAS</Text>
        <View style={s.emergRow}>
          {EMERGENCIAS.map((e) => (
            <View key={e.numero} style={[s.emergCard, { backgroundColor: e.bg }]}>
              <Ionicons name={e.icon} size={22} color={e.fg} />
              <Text style={[s.emergLabel, { color: e.fg }]}>{e.label}</Text>
              <Text style={[s.emergNumber, { color: e.fg }]}>{e.numero}</Text>
              <Pressable
                onPress={() => ligar(e.numero)}
                style={({ pressed }) => [
                  s.emergBtn,
                  { backgroundColor: e.fg },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="call" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </View>

        {/* ─── Alertas automáticos ─── */}
        <View style={s.card}>
          <View style={s.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Alertas automáticos</Text>
              <Text style={s.cardText}>
                Notificamos seus contatos se o serviço passar de 15 minutos do horário
                previsto sem confirmação.
              </Text>
            </View>
            <Switch
              value={alertas}
              onValueChange={setAlertas}
              trackColor={{ false: colors.border, true: ORANGE }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={colors.border}
            />
          </View>
        </View>

        {/* ─── Dicas de Segurança ─── */}
        <Text style={s.sectionLabel}>DICAS DE SEGURANÇA</Text>
        <View style={[s.card, { gap: 14 }]}>
          {DICAS.map((d, i) => (
            <View key={d.title} style={[s.dicaRow, i < DICAS.length - 1 && s.dicaDivider]}>
              <View style={[s.dicaIcon, { backgroundColor: d.bg }]}>
                <Ionicons name={d.icon} size={18} color={d.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.dicaTitle}>{d.title}</Text>
                <Text style={s.dicaText}>{d.text}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ─── Relatar incidente ─── */}
        <Pressable
          onPress={() => nav.navigate(PERFIL_STACK_ROUTES.REPORT_INCIDENT)}
          style={({ pressed }) => [s.reportCard, pressed && { opacity: 0.9 }]}
        >
          <View style={[s.dicaIcon, { backgroundColor: RED_BG }]}>
            <Ionicons name="document-text" size={18} color={RED} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Relatar um incidente</Text>
            <Text style={s.cardText}>
              Conte para nós o que aconteceu. Nossa equipe analisa em até 24h.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.mutedForeground} />
        </Pressable>

        {/* ─── Suporte Dular 24h ─── */}
        <View style={s.supportBanner}>
          <View style={s.supportIcon}>
            <Ionicons name="headset" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.supportTitle}>Suporte Dular 24h</Text>
            <Text style={s.supportText}>
              Nossa equipe está disponível a qualquer hora para ajudar.
            </Text>
          </View>
          <Pressable
            onPress={() => Linking.openURL("https://dular.app/contato").catch(() => {})}
            style={({ pressed }) => [s.supportBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={s.supportBtnText}>Contato</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: RED_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: colors.foreground,
    letterSpacing: -0.3,
  },

  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
    gap: 14,
  },

  // Cards genéricos
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
    ...shadow.card,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.foreground,
  },
  cardText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.mutedForeground,
    lineHeight: 17,
  },

  // SOS
  sosBtn: {
    alignSelf: "center",
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 14,
    shadowColor: RED,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  sosText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 4,
  },
  linkText: {
    alignSelf: "center",
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },

  // Toggle ativo badge
  activeBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 6,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },

  // Seções
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.mutedForeground,
    letterSpacing: 1.4,
    marginTop: 8,
    marginBottom: -4,
  },

  // Emergências
  emergRow: { flexDirection: "row", gap: 10 },
  emergCard: {
    flex: 1,
    borderRadius: radius.lg,
    padding: 14,
    alignItems: "flex-start",
    gap: 4,
    minHeight: 130,
  },
  emergLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  emergNumber: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  emergBtn: {
    marginTop: "auto",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },

  // Dicas
  dicaRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingBottom: 14 },
  dicaDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  dicaIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dicaTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: 2,
  },
  dicaText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.mutedForeground,
    lineHeight: 17,
  },

  // Relatar incidente
  reportCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...shadow.card,
  },

  // Suporte Banner
  supportBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0A4A3A",
    borderRadius: radius.lg,
    padding: 16,
    marginTop: 6,
  },
  supportIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  supportTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  supportText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
    marginTop: 2,
  },
  supportBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  supportBtnText: {
    color: "#0A4A3A",
    fontSize: 12,
    fontWeight: "700",
  },
});
