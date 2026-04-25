/**
 * Suporte — Tela de suporte ao usuário
 *
 * Identidade visual 100% aplicada com tokens Dular validados.
 */

import React from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { DButton } from "@/components/DButton";
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

export default function Suporte() {
  const nav = useNavigation<any>();

  const openWhats = async () => {
    const url = `https://wa.me/5565999990000?text=${encodeURIComponent("Olá! Preciso de suporte no app Dular.")}`;
    const ok  = await Linking.canOpenURL(url);
    if (!ok) return Alert.alert("WhatsApp", "Não foi possível abrir o WhatsApp.");
    Linking.openURL(url);
  };

  return (
    <Screen
      title="Suporte"
      rightAction={
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
      }
    >

      {/* Canais */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Canais de atendimento</Text>
        <Text style={s.sub}>Nossa equipe está disponível de seg–sex, 8h–18h.</Text>

        <DButton
          title="WhatsApp"
          onPress={openWhats}
          style={s.whatsBtn}
        />

        <Pressable
          onPress={() => Alert.alert("Email", "Envie para suporte@dular.app")}
          style={s.emailBtn}
        >
          <Ionicons name="mail-outline" size={16} color={colors.green} />
          <Text style={s.emailText}>suporte@dular.app</Text>
        </Pressable>
      </View>

      {/* FAQ */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Perguntas frequentes</Text>
        {FAQ.map((item) => (
          <View key={item.q} style={s.faqItem}>
            <Text style={s.faqQ}>{item.q}</Text>
            <Text style={s.faqA}>{item.a}</Text>
          </View>
        ))}
      </View>

    </Screen>
  );
}

const FAQ = [
  {
    q: "Como cancelo um serviço?",
    a: "Acesse 'Minhas solicitações', toque no serviço e selecione a opção de cancelamento.",
  },
  {
    q: "Como faço o pagamento?",
    a: "Por enquanto o pagamento é combinado diretamente com a diarista (Pix/dinheiro). Pagamento in-app chegará em breve.",
  },
  {
    q: "Como avalio a diarista?",
    a: "Após confirmar o serviço concluído, a opção de avaliação aparece automaticamente.",
  },
];

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 16,
    gap: 12,
    ...shadow.card,
  },
  sectionTitle: { ...typography.h3 },
  sub:          { ...typography.sub },

  whatsBtn: { },

  emailBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: radius.btn,
    borderWidth: 1.5,
    borderColor: colors.green,
  },
  emailText: {
    color: colors.green,
    fontWeight: "700",
    fontSize: 14,
  },

  faqItem: {
    gap: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.stroke,
  },
  faqQ: { fontSize: 13, fontWeight: "700", color: colors.ink },
  faqA: { ...typography.sub, lineHeight: 18 },
});
