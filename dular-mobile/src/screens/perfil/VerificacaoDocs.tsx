import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "@/components/Screen";
import { AppIcon, BackCircleButton, type AppIconName } from "@/components/ui";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { apiMsg } from "@/utils/apiMsg";
import { api } from "@/lib/api";
import { getMe, type VerificacaoStatus } from "@/api/perfilApi";
import { useAuth } from "@/stores/authStore";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import type { ProfileTheme } from "@/theme/profileTheme";
import { colors, radius, shadow, typography } from "@/theme/tokens";

type FileField = "docFrente" | "docVerso";
type UploadState = "idle" | "selecionando" | "enviando" | "sucesso" | "erro";

type PickedFile = {
  uri: string;
  name: string;
  type: string;
};

const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png"]);

function extFrom(value?: string | null) {
  return value?.split("?")[0]?.split(".").pop()?.toLowerCase();
}

function mimeFrom(mimeType?: string | null, name?: string | null, uri?: string | null, fallbackToJpeg = true) {
  if (mimeType && ALLOWED_IMAGE_MIMES.has(mimeType)) return mimeType;
  if (mimeType === "image/jpg") return "image/jpeg";
  if (mimeType) return mimeType;

  const ext = extFrom(name) ?? extFrom(uri);
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";

  return fallbackToJpeg ? "image/jpeg" : "application/octet-stream";
}

function makeFile(asset: ImagePicker.ImagePickerAsset, fallbackName: string): PickedFile {
  const uri = asset.uri;
  const type = mimeFrom(asset.mimeType, asset.fileName, uri);
  const normalizedExt = type === "image/png" ? "png" : "jpg";
  return {
    uri,
    name: asset.fileName ?? `${fallbackName}.${normalizedExt}`,
    type,
  };
}

function makeDocumentFile(asset: DocumentPicker.DocumentPickerAsset, fallbackName: string): PickedFile {
  const type = mimeFrom(asset.mimeType, asset.name, asset.uri, false);
  const normalizedExt = type === "image/png" ? "png" : "jpg";
  return {
    uri: asset.uri,
    name: asset.name ?? `${fallbackName}.${normalizedExt}`,
    type,
  };
}

export default function VerificacaoDocs() {
  const nav = useNavigation<any>();
  const currentUser = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  // Mesma fonte de cor por gênero usada no resto do perfil (role + user.genero).
  const theme = useProfileTheme(currentUser?.role);
  const st = useMemo(() => makeStyles(theme), [theme]);
  // Stack real (#103): volta para a tela de origem (perfil / onde abriu).
  const voltarPerfil = () => nav.goBack();
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
  const selecting = state === "selecionando";

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

  const setPickedFile = useCallback((field: FileField, file: PickedFile) => {
    if (!ALLOWED_IMAGE_MIMES.has(file.type)) {
      setToast("Formato inválido. Anexe uma imagem JPG ou PNG.");
      return;
    }
    if (field === "docFrente") setDocFrente(file);
    if (field === "docVerso") setDocVerso(file);
  }, []);

  const pickFromCamera = useCallback(async (field: FileField) => {
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
        // Sem allowsEditing/aspect: o crop forçado cortava o RG (documento é
        // paisagem). Capturamos a imagem inteira; o usuário enquadra na câmera.
        allowsEditing: false,
        quality: 0.85,
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
      setPickedFile(field, file);
      setState("idle");
    } catch (e: any) {
      setState("erro");
      setToast(apiMsg(e, "Falha ao selecionar imagem."));
    }
  }, [locked, setPickedFile]);

  const pickFromGallery = useCallback(async (field: FileField) => {
    if (locked) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setToast("Permissão negada para acessar a galeria.");
      return;
    }
    try {
      setState("selecionando");
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        // Sem allowsEditing/aspect: evita recorte que cortava o documento.
        allowsEditing: false,
        quality: 0.85,
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
      setPickedFile(field, file);
      setState("idle");
    } catch (e: any) {
      setState("erro");
      setToast(apiMsg(e, "Falha ao anexar imagem da galeria."));
    }
  }, [locked, setPickedFile]);

  const pickFromFiles = useCallback(async (field: FileField) => {
    if (locked) return;
    try {
      setState("selecionando");
      const res = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png"],
        copyToCacheDirectory: true,
        multiple: false,
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
      const file = makeDocumentFile(asset, field);
      setPickedFile(field, file);
      setState("idle");
    } catch (e: any) {
      setState("erro");
      setToast(apiMsg(e, "Falha ao anexar imagem dos arquivos."));
    }
  }, [locked, setPickedFile]);

  const attach = useCallback((field: FileField) => {
    if (locked || saving || selecting) return;
    Alert.alert("Anexar imagem", "Escolha de onde deseja anexar o documento.", [
      { text: "Galeria", onPress: () => void pickFromGallery(field) },
      { text: "Drive/arquivos", onPress: () => void pickFromFiles(field) },
      { text: "Cancelar", style: "cancel" },
    ]);
  }, [locked, pickFromFiles, pickFromGallery, saving, selecting]);

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
        voltarPerfil();
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

  const renderPick = (label: string, file: PickedFile | null, field: FileField) => {
    const disabled = locked || saving || selecting;
    return (
      <View style={[st.pickCard, locked && st.pickCardLocked]}>
        {file ? (
          <View style={{ gap: 8 }}>
            <Image source={{ uri: file.uri }} resizeMode="contain" style={st.pickPreview} />
            <Text numberOfLines={1} style={st.pickFileName}>{file.name}</Text>
          </View>
        ) : (
          <View style={st.pickPlaceholder}>
            <View style={st.pickPlaceholderIcon}>
              <AppIcon name="FileText" size={24} color={theme.primary} strokeWidth={2.1} />
            </View>
            <Text style={st.pickLabel}>{label}</Text>
            <Text style={st.pickHint}>Tire uma foto ou anexe uma imagem JPG/PNG do documento inteiro</Text>
          </View>
        )}
        <View style={st.pickActions}>
          <Pressable
            onPress={() => pickFromCamera(field)}
            disabled={disabled}
            style={[st.pickBtnPrimary, disabled && st.dimmed]}
          >
            <AppIcon name="Camera" size={18} color={colors.white} strokeWidth={2.2} />
            <Text numberOfLines={1} style={st.pickBtnPrimaryText}>Tirar foto</Text>
          </Pressable>
          <Pressable
            onPress={() => attach(field)}
            disabled={disabled}
            style={[st.pickBtnSecondary, disabled && st.dimmed]}
          >
            <AppIcon name="Image" size={18} color={theme.primary} strokeWidth={2.2} />
            <Text numberOfLines={1} style={st.pickBtnSecondaryText}>{file ? "Trocar imagem" : "Anexar imagem"}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <Screen
      title="Verificação"
      rightAction={<BackCircleButton onPress={voltarPerfil} color={theme.icon} borderColor={theme.border} />}
      contentStyle={{ gap: 12 }}
    >
        {toast ? (
          <View style={st.toast}>
            <Text style={st.toastText}>{toast}</Text>
          </View>
        ) : null}

        {verificacao === "APROVADO" ? (
          // Estado APROVADO: tela de status com escudo + selo de verificado.
          <View style={st.statusBlock}>
            <View style={st.statusCircle}>
              <AppIcon name="ShieldCheck" size={64} color={theme.primary} strokeWidth={2} />
            </View>
            <Text style={st.statusTitle}>Verificação aprovada</Text>
            <Text style={st.statusText}>
              Seu perfil está verificado. O selo de verificado aparece no seu perfil e você já pode usar a plataforma normalmente.
            </Text>
            <View style={st.statusPill}>
              <AppIcon name="CheckCircle" size={16} color={theme.primary} strokeWidth={2.3} />
              <Text style={st.statusPillText}>Perfil verificado</Text>
            </View>
          </View>
        ) : locked ? (
          // Estado AGUARDANDO: documentos enviados, em análise.
          <View style={st.statusBlock}>
            <View style={st.statusCircle}>
              <AppIcon name="Clock" size={60} color={theme.primary} strokeWidth={2} />
            </View>
            <Text style={st.statusTitle}>Documentação enviada</Text>
            <Text style={st.statusText}>
              Recebemos seus documentos e eles estão em análise. Avisaremos assim que a verificação for concluída.
            </Text>
            <View style={st.statusPill}>
              <AppIcon name="Hourglass" size={15} color={theme.primary} strokeWidth={2.3} />
              <Text style={st.statusPillText}>Aguardando aprovação</Text>
            </View>
          </View>
        ) : (
          // Estado INICIAL: envio dos documentos.
          <>
            <Text style={st.introTitle}>Envie seus documentos</Text>
            <Text style={st.introText}>
              {currentUser?.role === "EMPREGADOR"
                ? "RG/CNH frente e verso. Necessário para solicitar serviços e manter a plataforma segura."
                : currentUser?.role === "MONTADOR"
                  ? "RG/CNH frente e verso. Necessário para receber serviços e manter a plataforma segura."
                  : "RG/CNH frente e verso. Usamos isso para manter a comunidade segura."}
            </Text>

            {renderPick("Documento (frente)", docFrente, "docFrente")}
            {renderPick("Documento (verso)", docVerso, "docVerso")}

            <Pressable onPress={enviar} disabled={saving || selecting} style={[st.submitBtn, (saving || selecting) && st.dimmed]}>
              {saving || selecting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={st.submitBtnText}>Enviar documentos</Text>
              )}
            </Pressable>
          </>
        )}
    </Screen>
  );
}

function makeStyles(theme: ProfileTheme) {
  return StyleSheet.create({
    dimmed: { opacity: 0.65 },

    toast: { padding: 12, borderRadius: radius.md, backgroundColor: colors.ink },
    toastText: { color: colors.white, ...typography.bodySm, fontWeight: "700" },

    introTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
    introText: { color: colors.sub, ...typography.bodySm, fontWeight: "500" },

    // Cartão de upload (frente/verso)
    pickCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      padding: 12,
      backgroundColor: colors.card,
      gap: 12,
    },
    pickCardLocked: { opacity: 0.6 },
    pickPreview: { width: "100%", height: 200, borderRadius: radius.md, backgroundColor: theme.backgroundSoft },
    pickFileName: { color: colors.sub, fontSize: 12, fontWeight: "700" },
    pickPlaceholder: { alignItems: "center", gap: 6, paddingVertical: 10 },
    pickPlaceholderIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primarySoft,
      marginBottom: 2,
    },
    pickLabel: { color: colors.ink, ...typography.bodySm, fontWeight: "800" },
    pickHint: { color: colors.sub, fontSize: 12, fontWeight: "500", textAlign: "center", paddingHorizontal: 8 },

    pickActions: { flexDirection: "row", gap: 10 },
    pickBtnPrimary: {
      flex: 1,
      minHeight: 46,
      borderRadius: radius.md,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
    },
    pickBtnPrimaryText: { color: colors.white, flexShrink: 1, ...typography.bodySm, fontWeight: "800" },
    pickBtnSecondary: {
      flex: 1,
      minHeight: 46,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
    },
    pickBtnSecondaryText: { color: theme.textAccent, flexShrink: 1, ...typography.bodySm, fontWeight: "800" },

    submitBtn: {
      marginTop: 4,
      backgroundColor: theme.primary,
      borderRadius: radius.lg,
      padding: 14,
      alignItems: "center",
      ...shadow.card,
    },
    submitBtnText: { color: colors.white, ...typography.bodySm, fontWeight: "800" },

    // Estados de status (aprovado / aguardando)
    statusBlock: { alignItems: "center", gap: 14, paddingTop: 28 },
    statusCircle: {
      width: 124,
      height: 124,
      borderRadius: 62,
      backgroundColor: theme.backgroundSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    statusTitle: { fontSize: 20, fontWeight: "800", color: colors.ink, textAlign: "center" },
    statusText: { color: colors.sub, textAlign: "center", paddingHorizontal: 16, ...typography.bodySm, fontWeight: "500" },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.backgroundSoft,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
    },
    statusPillText: { color: theme.textAccent, ...typography.bodySm, fontWeight: "800" },
  });
}
