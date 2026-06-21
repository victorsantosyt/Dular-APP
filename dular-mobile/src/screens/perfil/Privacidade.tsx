/**
 * Privacidade — Política de Privacidade do Dular (LGPD).
 *
 * Descreve os dados tratados pelo app e a base legal, conforme a LGPD
 * (Lei nº 13.709/2018). O endurecimento completo de segurança/LGPD do app é
 * uma frente contínua, aplicada de forma transversal a todos os perfis.
 */

import React from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "@/components/Screen";
import { BackCircleButton } from "@/components/ui";
import { useAuth } from "@/stores/authStore";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import { colors } from "@/theme/tokens";

const ATUALIZADO_EM = "16 de junho de 2026";

const SECOES: { titulo: string; paragrafos: string[] }[] = [
  {
    titulo: "1. Dados que coletamos",
    paragrafos: [
      "Cadastro: nome, e-mail, telefone e gênero.",
      "Verificação: documentos (RG/CNH) enviados para conferência de identidade.",
      "Localização: cidade, bairro e área de atendimento.",
      "Imagens: foto de perfil e fotos de portfólio (no caso dos profissionais).",
      "Serviços: histórico, valores combinados e avaliações.",
      "Comunicação: mensagens trocadas no chat.",
      "Segurança: eventos de SafeScore, SOS e check-in.",
    ],
  },
  {
    titulo: "2. Para que usamos seus dados",
    paragrafos: [
      "Operar a plataforma e conectar empregadores e profissionais; verificar identidade e aumentar a segurança; viabilizar comunicação e agendamento; calcular a reputação (SafeScore); enviar notificações do serviço; e cumprir obrigações legais.",
    ],
  },
  {
    titulo: "3. Base legal (LGPD)",
    paragrafos: [
      "Tratamos seus dados com base na execução do contrato de uso da plataforma, no seu consentimento (por exemplo, para localização) e no legítimo interesse para segurança e prevenção a fraudes.",
    ],
  },
  {
    titulo: "4. Compartilhamento",
    paragrafos: [
      "Entre as partes de um serviço, compartilhamos apenas o necessário (como nome, contato e endereço após o aceite). Não vendemos seus dados. Podemos compartilhá-los com autoridades quando exigido por lei.",
    ],
  },
  {
    titulo: "5. Segurança da informação",
    paragrafos: [
      "Adotamos medidas para proteger seus dados contra acesso não autorizado, perda ou uso indevido. Estamos aprimorando continuamente nossas práticas de segurança e de conformidade com a LGPD em toda a plataforma.",
    ],
  },
  {
    titulo: "6. Seus direitos",
    paragrafos: [
      "Conforme a LGPD, você pode acessar, corrigir, excluir e portar seus dados, além de revogar consentimento e se opor a determinados tratamentos. Para exercer esses direitos, fale com o Suporte.",
    ],
  },
  {
    titulo: "7. Retenção",
    paragrafos: [
      "Mantemos seus dados pelo tempo necessário às finalidades descritas e ao cumprimento de obrigações legais. Depois disso, eliminamos ou anonimizamos as informações.",
    ],
  },
  {
    titulo: "8. Encarregado e contato",
    paragrafos: [
      "Solicitações e dúvidas sobre seus dados podem ser feitas pelo Suporte (WhatsApp). Um canal dedicado de proteção de dados será disponibilizado conforme a plataforma evolui.",
    ],
  },
  {
    titulo: "9. Atualizações desta política",
    paragrafos: [
      "Esta política pode ser atualizada. Mudanças relevantes serão comunicadas no app.",
    ],
  },
];

export default function Privacidade() {
  const nav = useNavigation<any>();
  const role = useAuth((s) => s.role ?? s.user?.role);
  const theme = useProfileTheme(role);
  const voltarPerfil = () => nav.goBack();

  return (
    <Screen
      title="Privacidade"
      rightAction={<BackCircleButton onPress={voltarPerfil} color={theme.icon} borderColor={theme.border} />}
      contentStyle={{ gap: 12 }}
    >
      <View style={card}>
        <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>Política de Privacidade</Text>
        <Text style={{ color: colors.sub, fontSize: 12, marginTop: 4 }}>
          Como tratamos seus dados, em conformidade com a LGPD (Lei nº 13.709/2018). Atualizado em {ATUALIZADO_EM}.
        </Text>
      </View>

      {SECOES.map((secao) => (
        <View key={secao.titulo} style={card}>
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>{secao.titulo}</Text>
          {secao.paragrafos.map((p, i) => (
            <Text key={i} style={{ color: colors.sub, fontSize: 13, lineHeight: 19, marginTop: i === 0 ? 6 : 4 }}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const card = {
  backgroundColor: "rgba(255,255,255,0.92)",
  borderRadius: 18,
  borderWidth: 1,
  borderColor: colors.stroke,
  padding: 16,
} as const;
