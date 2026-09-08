import { Pressable, StyleSheet, Text, View } from "react-native";

import { useNotificacaoPopup } from "@/stores/notificacaoPopupStore";
import type { ProfileTheme } from "@/theme/profileTheme";
import { colors, radius, typography } from "@/theme";

/**
 * Barra de teste dos avisos in-app — SÓ em desenvolvimento. No app publicado
 * o `__DEV__` é falso e nada disto é renderizado.
 *
 * Existe porque push não chega ao simulador (o Expo exige aparelho físico:
 * `Device.isDevice`). Sem isto não haveria como ver nem ajustar o visual do
 * popup sem instalar num telefone a cada mudança.
 *
 * Fica em um componente só, e não copiado nas telas, porque cada perfil tem
 * a sua tela de Notificações — duas cópias divergiriam.
 */
const EXEMPLOS: { label: string; tipo: string; titulo: string; corpo: string }[] = [
  {
    label: "Serviço",
    tipo: "SERVICO_SOLICITADO",
    titulo: "Nova solicitação",
    corpo: "Ana Paula quer contratar uma faxina completa para amanhã às 08:00.",
  },
  {
    label: "Mensagem",
    tipo: "CHAT_NOVA_MENSAGEM",
    titulo: "Ana Paula",
    corpo: "Oi! Consegue chegar um pouco mais cedo na quinta?",
  },
  {
    label: "Avaliação",
    tipo: "AVALIACAO_RECEBIDA",
    titulo: "Você recebeu 5 estrelas",
    corpo: "Ana Paula avaliou seu serviço: “Caprichada e pontual, recomendo!”",
  },
];

export function SimuladorDePopup({ theme, servicoId }: { theme: ProfileTheme; servicoId?: string }) {
  const mostrar = useNotificacaoPopup((s) => s.mostrar);
  if (!__DEV__) return null;

  return (
    <View style={s.bloco}>
      <Text style={s.rotulo}>Testar aviso (dev)</Text>
      <View style={s.botoes}>
        {EXEMPLOS.map((ex) => (
          <Pressable
            key={ex.label}
            onPress={() => mostrar({ tipo: ex.tipo, titulo: ex.titulo, corpo: ex.corpo, servicoId })}
            style={({ pressed }) => [
              s.botao,
              { borderColor: theme.border, backgroundColor: theme.primarySoft },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[s.texto, { color: theme.primary }]}>{ex.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default SimuladorDePopup;

const s = StyleSheet.create({
  bloco: { gap: 8, marginBottom: 4 },
  rotulo: { ...typography.caption, color: colors.textMuted },
  botoes: { flexDirection: "row", gap: 8 },
  botao: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: radius.md, borderWidth: 1 },
  texto: { ...typography.caption, fontWeight: "700" },
});
