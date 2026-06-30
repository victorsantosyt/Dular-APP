/**
 * Suporte — canal de atendimento ao usuário.
 *
 * Por ora o atendimento é só por WhatsApp (volume baixo). Conforme escalar,
 * uma estrutura de suporte mais elaborada será montada.
 *
 * Hierarquia tipográfica: título do bloco em fonte forte (ink), corpo/respostas
 * em fonte leve (sub), e cada pergunta do FAQ em um bloco separado — mesmo
 * padrão dos Termos. Botões seguem a identidade de gênero do perfil.
 */

import React from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { BackCircleButton } from "@/components/ui";
import { DButton } from "@/components/DButton";
import { useAuth } from "@/stores/authStore";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import { colors, radius, shadow } from "@/theme/tokens";

const SUPORTE_WHATSAPP = "5566996293033";

const INSTRUCOES = [
  "Toque no número do serviço (no topo do detalhe) para copiá-lo e cole na conversa com o suporte — agiliza muito o atendimento.",
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
    q: "O que é o SafeScore e por que ele importa?",
    a: "O SafeScore é o índice de confiança e segurança da sua conta no Dular — é a principal camada de proteção para empregadores e profissionais. Ele combina a verificação de documentos, o histórico de serviços, as avaliações e os registros de segurança (SOS, check-in e denúncias) para indicar o quanto cada pessoa é confiável. Um SafeScore mais alto aumenta sua visibilidade na busca e a confiança da outra parte; já condutas graves ou denúncias confirmadas podem reduzi-lo e até restringir o uso do app. Por isso, manter seu perfil verificado e um bom histórico é o que mantém todas as interações mais seguras.",
  },
  {
    q: "Como avalio após o serviço?",
    a: "Ao confirmar a finalização do serviço, a opção de avaliação aparece automaticamente.",
  },
];

export default function Suporte() {
  const nav = useNavigation<any>();
  const role = useAuth((s) => s.role ?? s.user?.role);
  const theme = useProfileTheme(role);
  const voltarPerfil = () => nav.goBack();

  const abrirWhats = async () => {
    const url = `https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent("Olá! Preciso de suporte no app Dular.")}`;
    const ok = await Linking.canOpenURL(url);
    if (!ok) return Alert.alert("WhatsApp", "Não foi possível abrir o WhatsApp. Verifique se ele está instalado.");
    Linking.openURL(url);
  };

  return (
    <Screen
      title="Suporte"
      rightAction={<BackCircleButton onPress={voltarPerfil} color={theme.icon} borderColor={theme.border} />}
      contentStyle={{ gap: 12 }}
    >
      {/* Canal de atendimento */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Fale com a gente</Text>
        <Text style={s.body}>
          Nosso atendimento é pelo WhatsApp, de segunda a sexta, das 8h às 18h. Respondemos o mais
          rápido possível.
        </Text>
        <DButton
          title="Abrir WhatsApp"
          onPress={abrirWhats}
          style={{ backgroundColor: theme.primary, borderColor: theme.primary, marginTop: 12 }}
        />
      </View>

      {/* Como pedir ajuda */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Como pedir ajuda</Text>
        <View style={s.bulletList}>
          {INSTRUCOES.map((t) => (
            <View key={t} style={s.bulletRow}>
              <Ionicons name="checkmark-circle" size={16} color={theme.primary} style={{ marginTop: 1 }} />
              <Text style={s.bulletText}>{t}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Perguntas frequentes — cada pergunta em um bloco separado */}
      <Text style={s.groupLabel}>Perguntas frequentes</Text>
      {FAQ.map((item) => (
        <View key={item.q} style={s.card}>
          <Text style={s.faqQ}>{item.q}</Text>
          <Text style={s.faqA}>{item.a}</Text>
        </View>
      ))}
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
    ...shadow.card,
  },
  // Título do bloco — fonte forte
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  // Corpo — fonte leve
  body: {
    color: colors.sub,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  bulletList: {
    gap: 10,
    marginTop: 10,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletText: {
    flex: 1,
    color: colors.sub,
    fontSize: 13,
    lineHeight: 19,
  },
  // Rótulo do grupo (eyebrow) — separa visualmente a seção
  groupLabel: {
    color: colors.sub,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 6,
    marginBottom: -2,
    paddingHorizontal: 2,
  },
  // Pergunta — fonte forte; Resposta — fonte leve
  faqQ: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  faqA: {
    color: colors.sub,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
});
