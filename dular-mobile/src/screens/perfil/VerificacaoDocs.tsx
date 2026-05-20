import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, View, Pressable, Alert, Image, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "@/components/Screen";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { apiMsg } from "@/utils/apiMsg";
import { api } from "@/lib/api";
import { getMe, type VerificacaoStatus } from "@/api/perfilApi";
import { useAuth } from "@/stores/authStore";
import { colors } from "@/theme/tokens";

type FileField = "docFrente" | "docVerso";
type UploadState = "idle" | "selecionando" | "enviando" | "sucesso" | "erro";

type PickedFile = {
  uri: string;
  name: string;
  type: string;
};

function makeFile(asset: ImagePicker.ImagePickerAsset, fallbackName: string): PickedFile {
  const uri = asset.uri;
  const ext = uri.split(".").pop()?.toLowerCase();
  const type = asset.mimeType ?? (ext === "png" ? "image/png" : "image/jpeg");
  const normalizedExt = type === "image/png" ? "png" : "jpg";
  return {
    uri,
    name: asset.fileName ?? `${fallbackName}.${normalizedExt}`,
    type,
  };
}

export default function VerificacaoDocs() {
  const nav = useNavigation<any>();
  const currentUser = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [docFrente, setDocFrente] = useState<PickedFile | null>(null);
  const [docVerso, setDocVerso] = useState<PickedFile | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [verificacao, setVerificacao] = useState<VerificacaoStatus>(
    currentUser?.verificacao?.status ?? "NAO_ENVIADO"
  );
  const [docEnviado, setDocEnviado] = useState(Boolean(currentUser?.docEnviado));
  const [toast, setToast] = useState<string | null>(null);
  const busyRef = useRef(false);
  // T-18.7: garante que goBack/navigate só rode uma vez após sucesso,
  // mesmo se o usuário tocar OK várias vezes durante a animação.
  const closedRef = useRef(false);
  const locked = verificacao === "APROVADO" || (verificacao === "PENDENTE" && docEnviado);
  const saving = state === "enviando";

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let alive = true;

    async function loadStatus() {
      try {
        const me = await getMe();
        if (!alive) return;
        setVerificacao(me.verificacao?.status ?? "NAO_ENVIADO");
        setDocEnviado(Boolean(me.docEnviado));
      } catch {
        // Mantém o estado local atual se não conseguir atualizar agora.
      }
    }

    loadStatus();
    return () => {
      alive = false;
    };
  }, []);

  const pick = useCallback(async (field: FileField) => {
    if (locked) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setToast("Permissão negada para usar a câmera.");
      return;
    }
    try {
      setState("selecionando");
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });
      if (res.canceled) {
        setState("idle");
        return;
      }
      const asset = res.assets?.[0];
      if (!asset?.uri) {
        setState("idle");
        return;
      }
      const file = makeFile(asset, field);
      if (field === "docFrente") setDocFrente(file);
      if (field === "docVerso") setDocVerso(file);
      setState("idle");
    } catch (e: any) {
      setState("erro");
      setToast(apiMsg(e, "Falha ao selecionar imagem."));
    }
  }, [locked]);

  const enviar = async () => {
    if (busyRef.current) return;
    if (locked) {
      Alert.alert("Verificação", verificacao === "APROVADO" ? "Sua verificação já foi aprovada." : "Sua verificação já está pendente.");
      return;
    }
    if (!docFrente || !docVerso) {
      Alert.alert("Envio", "Selecione frente e verso do documento.");
      return;
    }
    busyRef.current = true;
    try {
      setState("enviando");
      setToast(null);
      const form = new FormData();
      form.append("docFrente", docFrente as any);
      form.append("docVerso", docVerso as any);

      const res = await api.post("/api/verificacoes", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // T-18.4: o backend retorna VERIFICADO quando AUTO_VERIFY_PROFILES=true
      // e a completude está OK; caso contrário, PENDENTE. Refletir no estado
      // local em vez de assumir PENDENTE sempre.
      const apiStatus = String(res?.data?.verificacao?.status ?? "PENDENTE").toUpperCase();
      const nextStatus: VerificacaoStatus =
        apiStatus === "VERIFICADO" || apiStatus === "APROVADO" ? "APROVADO" : "PENDENTE";

      setState("sucesso");
      setVerificacao(nextStatus);
      setDocEnviado(true);
      setUser((prev) =>
        prev
          ? {
              ...prev,
              docEnviado: true,
              verificado: nextStatus === "APROVADO",
              verificacao: { status: nextStatus },
            }
          : prev,
      );

      // Refresh completo do /api/me para garantir que os outros campos
      // (verificado, status etc.) fiquem consistentes em toda a árvore.
      try {
        const me = await getMe();
        setUser((prev) =>
          prev
            ? {
                ...prev,
                docEnviado: Boolean(me.docEnviado),
                verificado: Boolean(me.verificado),
                verificacao: me.verificacao ?? prev.verificacao,
              }
            : prev,
        );
      } catch {
        // Mantém o estado otimista se /api/me falhar.
      }

      // T-18.6: standardiza o estado pós-upload usando o Guardian quando
      // disponível na resposta. Em produção, sem AUTO_VERIFY_PROFILES, o
      // status é sempre PENDENTE — a UI nunca pode anunciar "verificado"
      // sem retorno APPROVED real (vindo de admin).
      const guardianRoleOk =
        res?.data?.guardian?.canCreateServico ||
        res?.data?.guardian?.canAppearInSearch;

      // T-18.7: após sucesso, fechar a tela. Só dispara no caminho 200.
      // Em erro, o catch abaixo mostra o toast e a tela permanece.
      // closeOnce evita navegações duplicadas se o usuário tocar várias
      // vezes em OK enquanto a animação ocorre.
      const goBackToPerfil = () => {
        if (closedRef.current) return;
        closedRef.current = true;
        if (nav.canGoBack()) {
          nav.goBack();
          return;
        }
        const fallback =
          currentUser?.role === "MONTADOR" ? "MontadorPerfil" : "Perfil";
        nav.navigate(fallback as never);
      };

      let alertTitle: string;
      let alertBody: string;
      if (nextStatus === "APROVADO" && guardianRoleOk) {
        // Caminho exclusivo de QA/E2E: AUTO_VERIFY_PROFILES=true promoveu
        // de fato a verificação e o Guardian liberou as permissões.
        if (currentUser?.role === "EMPREGADOR") {
          alertTitle = "Verificação aprovada";
          alertBody = "Documentos aprovados.";
        } else {
          alertTitle = "Perfil visível";
          alertBody = "Documentos aprovados.";
        }
      } else {
        alertTitle = "Documentos enviados para análise";
        alertBody = "Documentos enviados. Análise pendente.";
      }
      Alert.alert(alertTitle, alertBody, [
        { text: "OK", onPress: goBackToPerfil },
      ]);
    } catch (e: any) {
      setState("erro");
      setToast(apiMsg(e, "Falha ao enviar documentos."));
    } finally {
      busyRef.current = false;
    }
  };

  const renderPick = (label: string, file: PickedFile | null, field: FileField) => (
    <Pressable
      onPress={() => pick(field)}
      disabled={locked || saving || state === "selecionando"}
      style={{
        borderWidth: 1,
        borderColor: colors.stroke,
        borderRadius: 14,
        padding: 12,
        backgroundColor: "rgba(255,255,255,0.92)",
        alignItems: "center",
        opacity: locked ? 0.6 : 1,
      }}
    >
      {file ? (
        <Image source={{ uri: file.uri }} style={{ width: "100%", height: 160, borderRadius: 12 }} />
      ) : (
        <View style={{ alignItems: "center", gap: 6 }}>
          <Ionicons name="cloud-upload-outline" size={26} color={colors.teal} />
          <Text style={{ color: colors.ink, fontWeight: "700" }}>{label}</Text>
          <Text style={{ color: colors.sub, fontSize: 12 }}>Toque para escolher</Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <Screen
      title="Verificação"
      rightAction={
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
      }
      contentStyle={{ gap: 12 }}
    >
        {toast ? (
          <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.ink }}>
            <Text style={{ color: colors.white, fontWeight: "700" }}>{toast}</Text>
          </View>
        ) : null}

        {locked ? (
          <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.lightBlue }}>
            <Text style={{ color: colors.infoTextDark, fontWeight: "700" }}>
              {verificacao === "APROVADO" ? "Verificação aprovada." : "Documentos enviados. Análise pendente."}
            </Text>
          </View>
        ) : null}

        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.ink }}>Envie seus documentos</Text>
        <Text style={{ color: colors.sub }}>
          {currentUser?.role === "EMPREGADOR"
            ? "RG/CNH frente e verso. Necessário para solicitar serviços e manter a plataforma segura."
            : currentUser?.role === "MONTADOR"
              ? "RG/CNH frente e verso. Necessário para receber serviços e manter a plataforma segura."
              : "RG/CNH frente e verso. Usamos isso para manter a comunidade segura."}
        </Text>

        {renderPick("Documento (frente)", docFrente, "docFrente")}
        {renderPick("Documento (verso)", docVerso, "docVerso")}

        <Pressable
          onPress={enviar}
          disabled={locked || saving || state === "selecionando"}
          style={{
            marginTop: 4,
            backgroundColor: colors.teal,
            borderRadius: 14,
            padding: 14,
            alignItems: "center",
            opacity: locked || saving || state === "selecionando" ? 0.7 : 1,
          }}
        >
          {saving || state === "selecionando" ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={{ color: colors.white, fontWeight: "700" }}>
              {state === "sucesso" ? "Documentos enviados" : "Enviar documentos"}
            </Text>
          )}
        </Pressable>
    </Screen>
  );
}
