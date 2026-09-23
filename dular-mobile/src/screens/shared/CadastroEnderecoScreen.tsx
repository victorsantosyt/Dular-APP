/**
 * CadastroEnderecoScreen — cadastro/edição de endereço, compartilhada pelos 3 papéis.
 *
 * Apresentacional/prop-driven (NÃO depende de useNavigation): funciona tanto
 * renderizada solta no gate de onboarding quanto dentro de um navigator (edição).
 *
 * - Empregador: escolhe tipo (Residencial / Empresarial / Ambos). "Ambos" =
 *   dois formulários em sequência. Tem campo "Ponto de referência".
 * - Diarista/Montador: formulário único, salvo como RESIDENCIAL, sem ponto de ref.
 * - CEP com máscara 00000-000 + auto-preenchimento via ViaCEP (campos editáveis).
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackCircleButton, AppIcon, DInput, type AppIconName } from "@/components/ui";
import { useDularColors } from "@/hooks/useDularColors";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import { radius, shadows, spacing, typography } from "@/theme";
import {
  atualizarEndereco,
  buscarCep,
  fetchBairrosDaCidade,
  normalizarBairro,
  salvarEndereco,
  type Endereco,
  type TipoEndereco,
} from "@/api/enderecoApi";

type Role = "EMPREGADOR" | "DIARISTA" | "MONTADOR";

type Props = {
  role: Role;
  mode?: "onboarding" | "edit";
  /** Edição: endereço a pré-preencher. */
  initial?: Endereco | null;
  /** Chamado quando todos os endereços da fila foram salvos (ou pulado). */
  onDone: () => void;
  /** Edição/standalone: voltar sem salvar. Ausente no onboarding. */
  onCancel?: () => void;
};

type TipoEscolha = "RESIDENCIAL" | "EMPRESARIAL" | "AMBOS";

function maskCep(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function CadastroEnderecoScreen({ role, mode = "onboarding", initial, onDone, onCancel }: Props) {
  const colors = useDularColors();
  // Cor de destaque segue a identidade do usuário logado (gênero/role): roxo
  // p/ empregador, rosa/verde/neutro p/ diarista e montador.
  const theme = useGenderTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const isEmpregador = role === "EMPREGADOR";
  const isEdit = mode === "edit" || !!initial;

  // Fila de tipos a cadastrar. null = empregador ainda escolhendo o tipo.
  // - editando um endereço existente → usa o tipo dele (sem seletor);
  // - diarista/montador → sempre RESIDENCIAL;
  // - empregador adicionando (sem `initial`) → mostra o seletor de tipo.
  const [queue, setQueue] = useState<TipoEndereco[] | null>(() => {
    if (initial) return [initial.tipo];
    if (!isEmpregador) return ["RESIDENCIAL"];
    return null;
  });
  const [ambos, setAmbos] = useState(false);

  const [cep, setCep] = useState(initial?.cep ?? "");
  const [rua, setRua] = useState(initial?.rua ?? "");
  const [numero, setNumero] = useState(initial?.numero ?? "");
  const [complemento, setComplemento] = useState(initial?.complemento ?? "");
  const [bairro, setBairro] = useState(initial?.bairro ?? "");
  const [cidade, setCidade] = useState(initial?.cidade ?? "");
  const [uf, setUf] = useState(initial?.uf ?? "");
  const [ponto, setPonto] = useState(initial?.pontoReferencia ?? "");
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "notfound">("idle");
  // Catálogo de bairros atendidos na cidade. O autofill por CEP traz o bairro
  // dos Correios, que nem sempre existe no catálogo do Dular — o endereço era
  // salvo assim mesmo e TODA solicitação depois falhava com "Bairro não
  // cadastrado.", sem o usuário saber por quê.
  const [bairrosCatalogo, setBairrosCatalogo] = useState<string[] | null>(null);
  /** A consulta ao catálogo falhou (rede). Diferente de "cidade sem bairros". */
  const [catalogoFalhou, setCatalogoFalhou] = useState(false);
  /** Incrementado pelo "tentar novamente" para refazer a consulta. */
  const [tentativaCatalogo, setTentativaCatalogo] = useState(0);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const tipoAtual = queue?.[0];

  const resetForm = () => {
    setCep("");
    setRua("");
    setNumero("");
    setComplemento("");
    setBairro("");
    setCidade("");
    setUf("");
    setPonto("");
    setCepStatus("idle");
    setErro(null);
  };

  useEffect(() => {
    const c = cidade.trim();
    const u = uf.trim();
    if (!c || u.length !== 2) {
      setBairrosCatalogo(null);
      return;
    }
    let alive = true;
    setCatalogoFalhou(false);
    fetchBairrosDaCidade(c, u)
      .then((lista) => {
        if (!alive) return;
        setBairrosCatalogo(lista);
        // Lista vazia = cidade fora da operação. Não é "sem informação": é
        // informação de que não atendemos ali.
      })
      .catch(() => {
        // FALHA FECHADA. Antes isto deixava passar qualquer bairro: sem
        // catálogo, `bairrosCatalogo === null` valia como "reconhecido". O
        // backend segurava depois, então o endereço era salvo e TODA
        // solicitação falhava com "Bairro não cadastrado", sem a pessoa
        // entender por quê. Não saber se atendemos não é o mesmo que atender.
        if (!alive) return;
        setBairrosCatalogo(null);
        setCatalogoFalhou(true);
      });
    return () => {
      alive = false;
    };
  }, [cidade, uf, tentativaCatalogo]);

  const bairroReconhecido =
    // Sem cidade/UF ainda não há o que validar — não é falha, é formulário
    // pela metade.
    bairrosCatalogo === null
      ? !catalogoFalhou
      : !bairro.trim() || bairrosCatalogo.some((n) => normalizarBairro(n) === normalizarBairro(bairro));

  const onCepChange = (raw: string) => {
    const masked = maskCep(raw);
    setCep(masked);
    const digits = masked.replace(/\D/g, "");
    if (digits.length === 8) void autofill(digits);
  };

  const autofill = async (digits: string) => {
    setCepStatus("loading");
    const r = await buscarCep(digits);
    if (!r) {
      setCepStatus("notfound");
      return;
    }
    setCepStatus("idle");
    if (r.rua) setRua(r.rua);
    if (r.bairro) setBairro(r.bairro);
    if (r.cidade) setCidade(r.cidade);
    if (r.uf) setUf(r.uf);
  };

  const salvar = async () => {
    if (!tipoAtual || saving) return;
    if (
      cep.replace(/\D/g, "").length !== 8 ||
      !rua.trim() ||
      !numero.trim() ||
      !bairro.trim() ||
      !cidade.trim() ||
      uf.trim().length !== 2
    ) {
      setErro("Preencha CEP, rua, número, bairro, cidade e UF (2 letras).");
      return;
    }
    if (catalogoFalhou) {
      setErro(
        "Não foi possível conferir os bairros atendidos agora. Verifique sua conexão e toque em tentar novamente.",
      );
      return;
    }
    if (!bairroReconhecido) {
      setErro(
        `Ainda não atendemos "${bairro.trim()}" em ${cidade.trim()}. Escolha um dos bairros disponíveis.`,
      );
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      const payload = {
        tipo: tipoAtual,
        cep: cep.trim(),
        rua: rua.trim(),
        numero: numero.trim(),
        complemento: complemento.trim() || null,
        bairro: bairro.trim(),
        cidade: cidade.trim(),
        uf: uf.trim().toUpperCase(),
        pontoReferencia: isEmpregador ? ponto.trim() || null : null,
      };
      if (isEdit && initial) {
        await atualizarEndereco(initial.id, payload);
      } else {
        await salvarEndereco(payload);
      }
      const rest = (queue ?? []).slice(1);
      if (rest.length > 0) {
        setQueue(rest);
        resetForm();
      } else {
        onDone();
      }
    } catch {
      setErro("Não foi possível salvar o endereço. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  // ── Empregador onboarding: seletor de tipo ──────────────────────────────────
  if (queue === null) {
    const opcoes: { key: TipoEscolha; label: string; sub: string; icon: AppIconName }[] = [
      { key: "RESIDENCIAL", label: "Residencial", sub: "Sua casa", icon: "Home" },
      { key: "EMPRESARIAL", label: "Empresarial", sub: "Seu trabalho/empresa", icon: "BriefcaseBusiness" },
      { key: "AMBOS", label: "Ambos", sub: "Casa e empresa", icon: "MapPin" },
    ];
    const escolher = (k: TipoEscolha) => {
      if (k === "AMBOS") {
        setAmbos(true);
        setQueue(["RESIDENCIAL", "EMPRESARIAL"]);
      } else {
        setAmbos(false);
        setQueue([k]);
      }
    };
    return (
      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        {onCancel ? (
          <View style={s.header}>
            <BackCircleButton onPress={onCancel} color={theme.primary} borderColor={theme.border} />
            <Text style={[s.headerTitle, { color: theme.textAccent }]} numberOfLines={1}>
              Endereço
            </Text>
            <View style={s.backBtn} />
          </View>
        ) : null}
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[s.title, { color: theme.textAccent }]}>Qual endereço você quer cadastrar?</Text>
          <Text style={s.subtitle}>Você precisa de um endereço para solicitar serviços.</Text>
          <View style={s.optionList}>
            {opcoes.map((o) => (
              <Pressable
                key={o.key}
                onPress={() => escolher(o.key)}
                style={({ pressed }) => [s.optionCard, pressed && s.pressed]}
              >
                <View style={[s.optionIcon, { backgroundColor: theme.primarySoft }]}>
                  <AppIcon name={o.icon} size={22} color={theme.primary} strokeWidth={2.3} />
                </View>
                <View style={s.optionText}>
                  <Text style={s.optionLabel}>{o.label}</Text>
                  <Text style={s.optionSub}>{o.sub}</Text>
                </View>
                <AppIcon name="ChevronRight" size={18} color={colors.textMuted} strokeWidth={2.2} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Formulário ──────────────────────────────────────────────────────────────
  const tipoLabel = tipoAtual === "EMPRESARIAL" ? "empresarial" : "residencial";
  const stepLabel = ambos ? (tipoAtual === "RESIDENCIAL" ? " (1 de 2)" : " (2 de 2)") : "";

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.header}>
          {onCancel ? (
            <BackCircleButton onPress={onCancel} color={theme.primary} borderColor={theme.border} />
          ) : (
            <View style={s.backBtn} />
          )}
          <Text style={[s.headerTitle, { color: theme.textAccent }]} numberOfLines={1}>
            {initial ? "Atualizar endereço" : "Endereço"}
          </Text>
          <View style={s.backBtn} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={s.formTitle}>Endereço {tipoLabel}{stepLabel}</Text>

          <Text style={s.fieldLabel}>CEP</Text>
          <DInput
            placeholder="00000-000"
            value={cep}
            onChangeText={onCepChange}
            keyboardType="number-pad"
            maxLength={9}
          />
          {cepStatus === "loading" ? (
            <Text style={s.hint}>Buscando endereço…</Text>
          ) : cepStatus === "notfound" ? (
            <Text style={s.hintError}>CEP não encontrado. Preencha os campos manualmente.</Text>
          ) : null}

          <Text style={s.fieldLabel}>Rua</Text>
          <DInput placeholder="Rua / Avenida" value={rua} onChangeText={setRua} />

          <View style={s.row}>
            <View style={s.flex}>
              <Text style={s.fieldLabel}>Número</Text>
              <DInput placeholder="Nº" value={numero} onChangeText={setNumero} keyboardType="number-pad" />
            </View>
            <View style={s.flex}>
              <Text style={s.fieldLabel}>Complemento</Text>
              <DInput placeholder="Apto, bloco…" value={complemento} onChangeText={setComplemento} />
            </View>
          </View>

          <Text style={s.fieldLabel}>Bairro</Text>
          <DInput placeholder="Bairro" value={bairro} onChangeText={setBairro} />
          {catalogoFalhou ? (
            /* Falha ao carregar o catálogo BLOQUEIA em vez de deixar passar.
               Antes seguia em silêncio e o endereço era salvo num bairro que o
               backend recusa depois — a pessoa só descobria ao tentar
               solicitar, sem pista do motivo. */
            <View style={s.catalogoAviso}>
              <Text style={s.hintError}>
                Não foi possível conferir os bairros atendidos. Verifique sua conexão.
              </Text>
              <Pressable
                onPress={() => setTentativaCatalogo((n) => n + 1)}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={[s.hintError, s.tentarNovamente]}>Tentar novamente</Text>
              </Pressable>
            </View>
          ) : null}
          {!bairroReconhecido && bairrosCatalogo ? (
            <View style={s.bairroAviso}>
              <Text style={s.bairroAvisoTexto}>
                Ainda não atendemos esse bairro em {cidade.trim()}. Toque em um dos disponíveis:
              </Text>
              <View style={s.bairroChips}>
                {bairrosCatalogo.map((nome) => (
                  <Pressable key={nome} onPress={() => setBairro(nome)} style={s.bairroChip}>
                    <Text style={s.bairroChipTexto}>{nome}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={s.row}>
            <View style={s.flexCidade}>
              <Text style={s.fieldLabel}>Cidade</Text>
              <DInput placeholder="Cidade" value={cidade} onChangeText={setCidade} />
            </View>
            <View style={s.ufBox}>
              <Text style={s.fieldLabel}>UF</Text>
              <DInput
                placeholder="UF"
                value={uf}
                onChangeText={(t) => setUf(t.toUpperCase().slice(0, 2))}
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>
          </View>

          {isEmpregador ? (
            <>
              <Text style={s.fieldLabel}>Ponto de referência (opcional)</Text>
              <DInput placeholder="Ex.: próximo à praça" value={ponto} onChangeText={setPonto} />
            </>
          ) : null}

          {erro ? <Text style={s.hintError}>{erro}</Text> : null}

          <Pressable
            onPress={salvar}
            disabled={saving}
            style={({ pressed }) => [
              s.saveBtn,
              { backgroundColor: theme.primary },
              saving && s.saveBtnDisabled,
              pressed && !saving && s.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={s.saveBtnText}>Salvar Endereço</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default CadastroEnderecoScreen;

function makeStyles(colors: ReturnType<typeof useDularColors>) {
  return StyleSheet.create({
    bairroAviso: { gap: 8, marginTop: -4 },
    bairroAvisoTexto: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
    bairroChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    bairroChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: colors.surface,
    },
    bairroChipTexto: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    pressed: { opacity: 0.8 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    backBtn: {
      // Mesma medida do BackCircleButton, senão o título perde o centro.
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
    // Título de tela secundária: h2 e cor de destaque do perfil.
      ...typography.h2,
      flex: 1, textAlign: "center", fontWeight: "700"
    },
    scroll: { paddingHorizontal: spacing.screenPadding, paddingTop: spacing.sm, paddingBottom: 48, gap: 6 },
    title: { ...typography.h2, color: colors.textPrimary, fontWeight: "800", marginTop: spacing.lg,
      textAlign: "center",
    },
    subtitle: { ...typography.bodySm, color: colors.textSecondary, fontWeight: "500", marginBottom: spacing.lg,
      textAlign: "center",
    },
    formTitle: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: "800", marginBottom: spacing.sm },
    fieldLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "700", marginTop: 10, marginBottom: 4 },
    hint: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
    catalogoAviso: { gap: 4, marginTop: 4 },
    tentarNovamente: { textDecorationLine: "underline", fontWeight: "700" },
    hintError: { ...typography.caption, color: colors.danger, fontWeight: "600", marginTop: 6 },
    row: { flexDirection: "row", gap: spacing.sm },
    flexCidade: { flex: 1 },
    ufBox: { width: 84 },
    optionList: { gap: spacing.md },
    optionCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadows.soft,
    },
    optionIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.lavenderSoft,
    },
    optionText: { flex: 1, gap: 2 },
    optionLabel: { ...typography.bodySmMedium, color: colors.textPrimary, fontWeight: "700" },
    optionSub: { ...typography.caption, color: colors.textSecondary },
    saveBtn: {
      minHeight: 52,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      marginTop: spacing.lg,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { ...typography.bodyMedium, color: colors.white, fontWeight: "800" },
  });
}
