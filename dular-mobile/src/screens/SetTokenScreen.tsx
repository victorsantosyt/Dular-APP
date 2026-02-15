import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { setAuthToken } from "../lib/api";
import { DButton } from "../components/DButton";
import { DInput } from "../components/DInput";

type Props = { onDone: () => void };

export default function SetTokenScreen({ onDone }: Props) {
  const [token, setToken] = useState("");

  async function applyToken() {
    const trimmed = token.trim().replace(/^Bearer\s+/i, "");
    if (!trimmed || trimmed.length < 10) {
      Alert.alert("Token inválido", "Cole o JWT completo (sem recortar).");
      return;
    }
    await setAuthToken(trimmed);
    Alert.alert("OK", "Token aplicado");
    onDone();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontSize: 22, fontWeight: "600" }}>Set JWT (Dev)</Text>
          <Text style={{ color: "#666" }}>Cole o JWT aqui para testar o app (temporário).</Text>

          <DInput
            placeholder="Bearer token"
            value={token}
            onChangeText={setToken}
            multiline
            blurOnSubmit={false}
            style={{ minHeight: 120 }}
          />

          <DButton title="Aplicar token" onPress={applyToken} />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
