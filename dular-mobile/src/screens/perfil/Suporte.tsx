/**
 * Suporte — canal de atendimento ao usuário.
 *
 * Por ora o atendimento é só por WhatsApp (volume baixo). Conforme escalar,
 * uma estrutura de suporte mais elaborada será montada.
 */

import React from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { BackCircleButton } from "@/components/ui";
import { DButton } from "@/components/DButton";
import { useAuth } from "@/stores/authStore";
import { colors, radius, shadow, typography } from "@/theme/tokens";

const SUPORTE_WHATSAPP = "5566996293033";

const INSTRUCOES = [
  "Tenha em mãos o número do serviço (aparece no detalhe) para agilizar o atendimento.",
  "Descreva o que aconteceu e, se possível, anexe um print ou foto.",
  "Em situação de risco ou emergência, use o botão SOS na tela de segurança.",
  "Para registrar uma denúncia formal, use 'Reportar incidente' no seu perfil.",
];

const FAQ = [
  {
    q: "Como solicito ou aceito um serviço?",
    a: "O empregador solicita pela busca; o profissional recebe em 'Solicitações' e pode aceitar ou recusar. Após o aceite, o chat é liberado.",
  },
  {
    q: "Como funciona o pagamento?",
    a: "Por enquanto o pagamento é combinado diretamente entre as partes (Pix ou dinheiro). Pagamento dentro do app chegará em breve.",
  },
  {
    q: "Como reagendar um serviço?",
    a: "O profissional propõe uma nova data e turno na Agenda; o empregador confirma ou recusa a proposta.",
  },
  {
    q: "Como funciona a verificação do perfil?",
    a: "Envie frente e verso de um documento (RG/CNH) em 'Documentos'. Após a aprovação, seu perfil fica verificado e visível na busca.",
  },
  {
    q: "O que é o SafeScore?",
    a: "É a sua reputação e nível de confiança na plataforma, calculado a partir dos serviços, da verificação e do histórico de segurança.",
  },
  {
    q: "Como avalio após o serviço?",
    a: "Ao confirmar a finalização do serviço, a opção de avaliação aparece automaticamente.",
  },
];

export default function Suporte() {
  const nav = useNavigation<any>();
  const role = useAuth((s) => s.role ?? s.user?.role);
  const voltarPerfil = () => nav.navigate(role === "MONTADOR" ? "MontadorPerfil" : "Perfil");

  const abrirWhats = async () => {
    const url = `https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent("Olá! Preciso de suporte no app Dular.")}`;
    const ok = await Linking.canOpenURL(url);
    if (!ok) return Alert.alert("WhatsApp", "Não foi possível abrir o WhatsApp. Verifique se ele está instalado.");
    Linking.openURL(url);
  };

  return (
    <Screen title="Suporte" rightAction={<BackCircleButton onPress={voltarPerfil} />}>
      {/* Canal de atendimento */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Fale com a gente</Text>
        <Text style={s.sub}>
          Nosso atendimento é pelo WhatsApp, de segunda a sexta, das 8h às 18h. Respondemos o mais
          rápido possível.
        </Text>
        <DButton title="Abrir WhatsApp" onPress={abrirWhats} style={s.whatsBtn} />
      </View>

      {/* Como pedir ajuda */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Como pedir ajuda</Text>
        {INSTRUCOES.map((t) => (
          <View key={t} style={s.bulletRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.green} style={{ marginTop: 1 }} />
            <Text style={s.bulletText}>{t}</Text>
          </View>
        ))}
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
  sub: { ...typography.sub },
  whatsBtn: {},
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bulletText: { flex: 1, ...typography.sub, color: colors.ink },
  faqItem: {
    gap: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.stroke,
  },
  faqQ: { fontSize: 13, fontWeight: "700", color: colors.ink },
  faqA: { ...typography.sub, lineHeight: 18 },
});
