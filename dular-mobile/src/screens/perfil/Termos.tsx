/**
 * Termos — Termos de Uso e Serviços do Dular.
 *
 * Conteúdo redigido com base no que o app oferece: intermediação entre
 * empregadores e profissionais (montadores e profissionais de casa), com
 * verificação, chat, agenda/reagendamento, avaliações e ferramentas de
 * segurança. O tratamento de dados está na Política de Privacidade (LGPD).
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
    titulo: "1. Sobre o Dular",
    paragrafos: [
      "O Dular é uma plataforma que conecta empregadores a profissionais autônomos para serviços residenciais. O Dular atua como intermediador tecnológico: não é empregador dos profissionais e não presta os serviços diretamente. A relação de serviço é estabelecida diretamente entre o empregador e o profissional.",
    ],
  },
  {
    titulo: "2. Serviços oferecidos",
    paragrafos: [
      "Montagem e reparos (montador): montagem de móveis, instalações e pequenos reparos.",
      "Profissional de casa: limpeza/faxina, babá, cozinheira e passar roupa.",
      "A disponibilidade depende dos profissionais cadastrados na sua região.",
    ],
  },
  {
    titulo: "3. Cadastro e conta",
    paragrafos: [
      "Você deve fornecer informações verídicas e mantê-las atualizadas. A conta é pessoal e intransferível, e o uso da plataforma é restrito a maiores de 18 anos.",
    ],
  },
  {
    titulo: "4. Verificação de perfil",
    paragrafos: [
      "Para aumentar a segurança, o app permite enviar documentos (RG/CNH) para verificação. Perfis aprovados recebem o selo de verificado. Os documentos são usados exclusivamente para verificação de identidade.",
    ],
  },
  {
    titulo: "5. Como funciona",
    paragrafos: [
      "O empregador solicita um serviço; o profissional pode aceitar ou recusar. Após o aceite, o chat é liberado para combinar os detalhes. Concluído o serviço, ambas as partes confirmam a finalização e podem se avaliar.",
    ],
  },
  {
    titulo: "6. Pagamentos",
    paragrafos: [
      "No momento, o pagamento é combinado e realizado diretamente entre as partes (ex.: Pix ou dinheiro). O Dular não processa nem retém valores. Pagamento dentro do app poderá ser disponibilizado futuramente, com aviso prévio.",
    ],
  },
  {
    titulo: "7. Reagendamento e cancelamento",
    paragrafos: [
      "O profissional pode propor uma nova data/turno, que precisa ser confirmada pelo empregador. Qualquer parte pode cancelar conforme as regras do app. Cancelamentos e condutas podem impactar o seu SafeScore.",
    ],
  },
  {
    titulo: "8. Conduta e segurança",
    paragrafos: [
      "Espera-se respeito mútuo entre as partes. O app oferece ferramentas de segurança como SafeScore, check-in, botão SOS e registro de incidentes. Condutas graves podem resultar em restrição ou suspensão da conta.",
    ],
  },
  {
    titulo: "9. Avaliações",
    paragrafos: [
      "Após o serviço, as partes podem se avaliar. As avaliações devem ser honestas e respeitosas e compõem a reputação na plataforma.",
    ],
  },
  {
    titulo: "10. Responsabilidades",
    paragrafos: [
      "O profissional é responsável pela execução do serviço; o empregador, por fornecer condições e informações corretas; o Dular, pela disponibilização da plataforma de intermediação. Na máxima extensão permitida pela lei, o Dular não se responsabiliza por danos decorrentes da relação direta entre as partes.",
    ],
  },
  {
    titulo: "11. Privacidade",
    paragrafos: [
      "O tratamento dos seus dados pessoais segue a nossa Política de Privacidade, em conformidade com a LGPD (Lei nº 13.709/2018).",
    ],
  },
  {
    titulo: "12. Alterações e contato",
    paragrafos: [
      "Estes termos podem ser atualizados; mudanças relevantes serão comunicadas no app. Dúvidas? Fale com a gente pelo Suporte (WhatsApp).",
    ],
  },
];

export default function Termos() {
  const nav = useNavigation<any>();
  const role = useAuth((s) => s.role ?? s.user?.role);
  const theme = useProfileTheme(role);
  const voltarPerfil = () => nav.goBack();

  return (
    <Screen
      title="Termos de uso"
      rightAction={<BackCircleButton onPress={voltarPerfil} color={theme.icon} borderColor={theme.border} />}
      contentStyle={{ gap: 12 }}
    >
      <View style={card}>
        <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>Termos de Uso e Serviços</Text>
        <Text style={{ color: colors.sub, fontSize: 12, marginTop: 4 }}>
          Ao usar o Dular você concorda com estes termos. Atualizado em {ATUALIZADO_EM}.
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
