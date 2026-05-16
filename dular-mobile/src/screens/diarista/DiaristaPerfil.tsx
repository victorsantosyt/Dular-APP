/**
 * DiaristaPerfil — Perfil completo da profissional de casa (Diarista).
 *
 * Reorganizado em seções A–I (status, dados, serviços, área, preços,
 * habilidades, disponibilidade, documentos/segurança, suporte/termos)
 * espelhando o nível de detalhe do MontadorPerfil.
 *
 * Notas importantes:
 *  - Cada seção edita por modal próprio com PATCH/PUT mínimo dos seus
 *    campos. Nunca enviamos o perfil inteiro.
 *  - O loop de GET é protegido por `loadingRef`, `mountedRef` e
 *    `useFocusEffect` com `useCallback` estável (não depende de objetos
 *    ou arrays não memoizados).
 *  - SafeScore e service-flow theme NÃO são alterados.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageSourcePropType,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import * as ImagePicker from "expo-image-picker";

import { api } from "@/lib/api";
import { requestLocationWithAddress } from "@/lib/location";
import {
  getMe,
  uploadAvatarDataUrl,
  type Me,
  type VerificacaoStatus,
} from "@/api/perfilApi";
import { getCatalogoServicos, type CatalogoTipo } from "@/api/catalogoApi";
import {
  calcularCompletudeDiarista,
  decimalToNumber,
  formatCurrencyBRL,
  getDiaristaPerfilMe,
  getHabilidades,
  patchDiaristaPerfil,
  putHabilidades,
  updateAreaAtendimento,
  updateBairros,
  updateDisponibilidade,
  updatePerfilBase,
  updatePrecos,
  updatePrecosCompletos,
  type DiaristaProfileMe,
  type DiaristaCompletude,
  type DisponibilidadeSlot,
  type HabilidadePayload,
} from "@/api/diaristaApi";
import { apiMsg } from "@/utils/apiMsg";
import { useAuth } from "@/stores/authStore";
import { AppIcon, DButton, DCard } from "@/components/ui";
import { PERFIL_STACK_ROUTES } from "@/navigation/routes";
import type { DiaristaTabParamList } from "@/navigation/DiaristaNavigator";
import { radius, shadows, spacing, typography } from "@/theme";
import { useDularColors } from "@/hooks/useDularColors";
import { useThemeStore } from "@/stores/useThemeStore";
import { platformSelect } from "@/utils/platform";
import {
  ProfileHeroCard,
  ProfileRow,
  ProfileSection,
  ProfileSwitchRow,
} from "../empregador/profile/components";
import type { ServicoOferecido } from "@/types/diarista";

type Props = { onLogout: () => void };
type Navigation = BottomTabNavigationProp<DiaristaTabParamList>;

const GEO_KEY = "@dular:diarista_geo_enabled";

// ── Constantes domínio ───────────────────────────────────────────────────────
const SERVICOS_OPTIONS: Array<{
  id: ServicoOferecido;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof AppIcon>["name"];
}> = [
  { id: "DIARISTA", title: "Diarista", subtitle: "Limpeza e organização", icon: "BrushCleaning" },
  { id: "BABA", title: "Babá", subtitle: "Cuidados com crianças", icon: "Baby" },
  { id: "COZINHEIRA", title: "Cozinheira", subtitle: "Preparo de refeições", icon: "ChefHat" },
];

const DIAS_SEMANA: Array<{ idx: number; label: string }> = [
  { idx: 0, label: "Dom" },
  { idx: 1, label: "Seg" },
  { idx: 2, label: "Ter" },
  { idx: 3, label: "Qua" },
  { idx: 4, label: "Qui" },
  { idx: 5, label: "Sex" },
  { idx: 6, label: "Sáb" },
];

const TURNOS: Array<{ key: string; label: string }> = [
  { key: "MANHA", label: "Manhã" },
  { key: "TARDE", label: "Tarde" },
];

type ModalType =
  | null
  | "dados"
  | "servicos"
  | "area"
  | "precos"
  | "habilidades"
  | "disponibilidade";

// ── Helpers de UI ────────────────────────────────────────────────────────────

function firstName(value?: string | null) {
  return (value || "").trim().split(/\s+/)[0] || "Diarista";
}

function formatMemberSince(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

function verificacaoSubtitle(status: VerificacaoStatus) {
  if (status === "APROVADO") return "Profissional verificada";
  if (status === "PENDENTE") return "Verificação pendente";
  if (status === "REPROVADO") return "Verificação reprovada";
  return "Envie seus documentos";
}

function toCents(value: string): number | null {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function centsToInput(cents: number | null | undefined) {
  if (cents == null || !Number.isFinite(cents) || cents <= 0) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Converte input em formato "120,50" para string decimal "120.50" (formato API).
 * Retorna null para entrada vazia ou inválida.
 */
function inputToDecimalString(value: string): string | null {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

/**
 * Decimal (string|number) → input "120,50".
 */
function decimalToInput(value: string | number | null | undefined): string {
  const n = decimalToNumber(value);
  if (n == null) return "";
  return n.toFixed(2).replace(".", ",");
}

function joinBairros(bairros: string[]) {
  return bairros.join(", ");
}

function splitBairros(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length >= 2),
    ),
  );
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function DiaristaPerfil({ onLogout }: Props) {
  const navigation = useNavigation<Navigation>();
  const colors = useDularColors();
  const insets = useSafeAreaInsets();
  const themeMode = useThemeStore((state) => state.mode);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const s = useMemo(() => makeStyles(colors), [colors]);
  const setUser = useAuth((state) => state.setUser);
  const user = useAuth((state) => state.user);
  const setServicosOferecidosStore = useAuth((state) => state.setServicosOferecidos);

  // Refs de controle
  const busyRef = useRef(false);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);
  // Snapshot do fallback de servicosOferecidos sem inflar deps do loadMe
  const userServicosFallbackRef = useRef<ServicoOferecido[] | undefined>(user?.servicosOferecidos);
  useEffect(() => {
    userServicosFallbackRef.current = user?.servicosOferecidos;
  }, [user?.servicosOferecidos]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── State ────────────────────────────────────────────────────────────────
  const [me, setMe] = useState<Me | null>(null);
  const [profile, setProfile] = useState<DiaristaProfileMe | null>(null);
  const [avatarLocal, setAvatarLocal] = useState<string | null>(null);
  const [avatarRemote, setAvatarRemote] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [verificacao, setVerificacao] = useState<VerificacaoStatus>("NAO_ENVIADO");
  const [catalogo, setCatalogo] = useState<CatalogoTipo[]>([]);
  const [habilidades, setHabilidades] = useState<HabilidadePayload[]>([]);

  // Geo + dark mode
  const [geoEnabled, setGeoEnabled] = useState(true);

  // Modais
  const [modal, setModal] = useState<ModalType>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [localizacaoLoading, setLocalizacaoLoading] = useState(false);

  // Formulários
  const [dadosForm, setDadosForm] = useState({ nome: "", telefone: "", bio: "" });
  const [servicosDraft, setServicosDraft] = useState<ServicoOferecido[]>([]);
  const [areaForm, setAreaForm] = useState({
    cidade: "",
    uf: "",
    bairros: "",
    atendeTodaCidade: false,
    raioAtendimentoKm: "",
  });
  const [precosForm, setPrecosForm] = useState({
    leve: "",
    medio: "",
    pesada: "",
    babaHora: "",
    cozinheiraBase: "",
    taxaMinima: "",
    cobraDeslocamento: false,
    valorACombinar: false,
    observacao: "",
  });
  const [disponibilidadeForm, setDisponibilidadeForm] = useState<{ dias: number[]; turnos: string[] }>({
    dias: [],
    turnos: [],
  });

  // ── Geo persistido ───────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(GEO_KEY)
      .then((value) => {
        if (!mountedRef.current) return;
        if (value === "0") setGeoEnabled(false);
        if (value === "1") setGeoEnabled(true);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      if (mountedRef.current) setToast(null);
    }, 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Load ─────────────────────────────────────────────────────────────────
  const applyMe = useCallback(
    (data: Me | null) => {
      if (!data) return;
      setMe(data);
      if (data.avatarUrl) setAvatarRemote(data.avatarUrl);
      setUser((prev) => ({
        ...(prev ?? { id: data.id }),
        id: data.id || prev?.id || "",
        nome: data.nome ?? prev?.nome ?? "",
        telefone: data.telefone ?? prev?.telefone,
        role: (data.role as any) ?? prev?.role,
        avatarUrl: data.avatarUrl ?? prev?.avatarUrl,
      }));
      if (data.verificacao?.status) setVerificacao(data.verificacao.status);
      else if (data.verificado) setVerificacao("APROVADO");
    },
    [setUser],
  );

  const loadMe = useCallback(async () => {
    // Protege contra reentrada concorrente — sem isso, useFocusEffect pode
    // disparar GETs em rajada quando endpoints ficam lentos.
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      if (mountedRef.current) {
        setError(null);
        setLoading(true);
      }
      const [meData, perfilData, cat, habs] = await Promise.all([
        getMe(),
        getDiaristaPerfilMe(),
        getCatalogoServicos(),
        getHabilidades(),
      ]);
      if (!mountedRef.current) return;

      applyMe(meData);

      if (perfilData) {
        setProfile(perfilData);
        const foto = perfilData.fotoUrl;
        if (foto) setAvatarRemote(foto);
        if (perfilData.verificacao) {
          const pv = String(perfilData.verificacao).toUpperCase();
          setVerificacao(
            pv === "VERIFICADO" ? "APROVADO" : pv === "REPROVADO" ? "REPROVADO" : "PENDENTE",
          );
        }
        if (Array.isArray(perfilData.servicosOferecidos)) {
          await setServicosOferecidosStore(perfilData.servicosOferecidos);
        } else if (userServicosFallbackRef.current?.length) {
          await setServicosOferecidosStore(userServicosFallbackRef.current);
        }
      }

      setCatalogo(cat?.tipos ?? []);
      setHabilidades(Array.isArray(habs) ? habs : []);
    } catch (e: any) {
      if (mountedRef.current) setError(apiMsg(e, "Falha ao carregar perfil."));
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
    // Deps estáveis: applyMe e setServicosOferecidosStore vêm do zustand.
  }, [applyMe, setServicosOferecidosStore]);

  useFocusEffect(useCallback(() => { void loadMe(); }, [loadMe]));

  // ── Derivados ────────────────────────────────────────────────────────────
  const displayName = useMemo(
    () => firstName(profile?.user?.nome ?? me?.nome ?? user?.nome),
    [profile, me, user],
  );
  const avatarUri = avatarLocal ?? avatarRemote ?? user?.avatarUrl ?? null;
  const avatarFallback: ImageSourcePropType | null = null;
  // O badge de verificação já comunica o status. Aqui mostramos uma linha
  // informativa adicional baseada em dados reais (serviços / total atendido).
  const heroSubtitle = useMemo(() => {
    const total = profile?.totalServicos ?? 0;
    if (total > 0) {
      return `${total} ${total === 1 ? "serviço realizado" : "serviços realizados"}`;
    }
    const servs = profile?.servicosOferecidos ?? [];
    if (servs.length > 0) {
      return `Oferece ${servs.length} ${servs.length === 1 ? "serviço" : "serviços"}`;
    }
    return "";
  }, [profile?.totalServicos, profile?.servicosOferecidos]);
  const bairroNomes = useMemo(
    () => (profile?.bairros ?? []).map((b) => b.bairro.nome).filter(Boolean),
    [profile?.bairros],
  );
  const cidadeUf = useMemo(() => {
    const cidade = profile?.cidade ?? profile?.bairros?.[0]?.bairro?.cidade ?? null;
    const uf = profile?.estado ?? profile?.bairros?.[0]?.bairro?.uf ?? null;
    if (!cidade || !uf) return "Área de atendimento não definida";
    if (profile?.atendeTodaCidade) return `${cidade} • ${uf} — atende toda a cidade`;
    return `${cidade} • ${uf}${bairroNomes.length ? ` — ${bairroNomes.length} bairro(s)` : ""}`;
  }, [profile?.cidade, profile?.estado, profile?.atendeTodaCidade, profile?.bairros, bairroNomes.length]);
  const heroLocation = useMemo(() => {
    const cidade = profile?.cidade ?? profile?.bairros?.[0]?.bairro?.cidade ?? null;
    const uf = profile?.estado ?? profile?.bairros?.[0]?.bairro?.uf ?? null;
    if (cidade && uf) return `${cidade}, ${uf}`;
    return "Cidade não informada";
  }, [profile?.cidade, profile?.estado, profile?.bairros]);
  const heroMemberSince = formatMemberSince(
    me?.createdAt ?? profile?.createdAt ?? (me as any)?.criadoEm ?? null,
  );
  const servicosOferecidos = useMemo<ServicoOferecido[]>(
    () => (profile?.servicosOferecidos as ServicoOferecido[]) ?? [],
    [profile?.servicosOferecidos],
  );

  const completude: DiaristaCompletude = useMemo(
    () => calcularCompletudeDiarista(profile, me?.nome ?? user?.nome ?? ""),
    [profile, me?.nome, user?.nome],
  );

  const precosResumo = useMemo(() => {
    if (profile?.valorACombinar) return "Valor a combinar";
    const leve = formatCurrencyBRL(profile?.precoLeve ?? null);
    const pesada = formatCurrencyBRL(profile?.precoPesada ?? null);
    if (!leve && !pesada) return "Configure seus preços";
    return [leve && `Leve ${leve}`, pesada && `Pesada ${pesada}`].filter(Boolean).join(" • ");
  }, [profile?.valorACombinar, profile?.precoLeve, profile?.precoPesada]);

  const servicosResumo = useMemo(() => {
    if (!servicosOferecidos.length) return "Escolha o que aparece no seu perfil";
    return servicosOferecidos
      .map((id) => SERVICOS_OPTIONS.find((o) => o.id === id)?.title ?? id)
      .join(", ");
  }, [servicosOferecidos]);

  const habilidadesResumo = useMemo(() => {
    if (!habilidades.length) return "Adicione suas especialidades";
    return `${habilidades.length} selecionada(s)`;
  }, [habilidades.length]);

  const disponibilidadeResumo = useMemo(() => {
    const agenda = profile?.agenda ?? [];
    if (!agenda.length) return "Defina dias e turnos disponíveis";
    const dias = new Set<number>();
    const turnos = new Set<string>();
    agenda.forEach((slot) => {
      if (slot.ativo === false) return;
      dias.add(slot.diaSemana);
      turnos.add(slot.turno);
    });
    const diasLabel = Array.from(dias)
      .sort()
      .map((idx) => DIAS_SEMANA.find((d) => d.idx === idx)?.label)
      .filter(Boolean)
      .join(", ");
    const turnosLabel = Array.from(turnos)
      .map((t) => TURNOS.find((tt) => tt.key === t)?.label ?? t)
      .join(" / ");
    return [diasLabel, turnosLabel].filter(Boolean).join(" • ") || "Defina dias e turnos disponíveis";
  }, [profile?.agenda]);

  // ── Sync forms a partir do profile ───────────────────────────────────────
  const openModal = useCallback(
    (type: Exclude<ModalType, null>) => {
      setFormError(null);
      // Inicializa o form correspondente com o snapshot atual do perfil/me
      switch (type) {
        case "dados":
          setDadosForm({
            nome: profile?.user?.nome ?? me?.nome ?? user?.nome ?? "",
            telefone: profile?.user?.telefone ?? me?.telefone ?? user?.telefone ?? "",
            bio: profile?.bio ?? "",
          });
          break;
        case "servicos":
          setServicosDraft(servicosOferecidos);
          break;
        case "area": {
          const b0 = profile?.bairros?.[0]?.bairro;
          setAreaForm({
            // Preferimos cidade/estado salvos no perfil (T-15); fallback no primeiro bairro
            cidade: profile?.cidade ?? b0?.cidade ?? "",
            uf: profile?.estado ?? b0?.uf ?? "",
            bairros: joinBairros(bairroNomes),
            atendeTodaCidade: profile?.atendeTodaCidade ?? false,
            raioAtendimentoKm:
              profile?.raioAtendimentoKm != null ? String(profile.raioAtendimentoKm) : "",
          });
          break;
        }
        case "precos":
          setPrecosForm({
            leve: centsToInput(profile?.precoLeve ?? null),
            medio: centsToInput(profile?.precoMedio ?? null),
            pesada: centsToInput(profile?.precoPesada ?? null),
            babaHora: decimalToInput(profile?.precoBabaHora ?? null),
            cozinheiraBase: decimalToInput(profile?.precoCozinheiraBase ?? null),
            taxaMinima: decimalToInput(profile?.taxaMinima ?? null),
            cobraDeslocamento: profile?.cobraDeslocamento ?? false,
            valorACombinar: profile?.valorACombinar ?? false,
            observacao: profile?.observacaoPreco ?? "",
          });
          break;
        case "habilidades":
          // catálogo já está carregado em `catalogo`; nada para inicializar
          break;
        case "disponibilidade": {
          const dias = new Set<number>();
          const turnos = new Set<string>();
          (profile?.agenda ?? []).forEach((slot) => {
            if (slot.ativo === false) return;
            dias.add(slot.diaSemana);
            turnos.add(slot.turno);
          });
          setDisponibilidadeForm({ dias: Array.from(dias), turnos: Array.from(turnos) });
          break;
        }
        default:
          break;
      }
      setModal(type);
    },
    [profile, me, user, servicosOferecidos, bairroNomes],
  );

  const closeModal = useCallback(() => {
    if (saving) return;
    setModal(null);
    setFormError(null);
  }, [saving]);

  // ── Avatar ───────────────────────────────────────────────────────────────
  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setToast("Permissão negada para acessar fotos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri || !asset.base64 || busyRef.current) return;

    setAvatarLocal(asset.uri);
    setAvatarUploading(true);
    busyRef.current = true;
    try {
      const mime = (asset as { mimeType?: string }).mimeType ?? "image/jpeg";
      const dataUrl = `data:${mime};base64,${asset.base64}`;
      const uploaded = await uploadAvatarDataUrl(dataUrl);
      const finalUrl = uploaded?.user?.avatarUrl ?? dataUrl;
      if (finalUrl && mountedRef.current) setAvatarRemote(finalUrl);
      setUser((u) => (u ? { ...u, avatarUrl: finalUrl ?? u.avatarUrl } : u));
      setToast("Foto atualizada.");
    } catch (e: any) {
      setToast(apiMsg(e, "Falha ao atualizar foto."));
    } finally {
      if (mountedRef.current) setAvatarUploading(false);
      busyRef.current = false;
    }
  };

  // ── Habilidades ──────────────────────────────────────────────────────────
  const toggleHabilidade = (tipo: string, categoria?: string | null) => {
    const key = `${tipo}::${categoria ?? ""}`;
    setHabilidades((prev) => {
      const exists = prev.some((h) => `${h.tipo}::${h.categoria ?? ""}` === key);
      return exists
        ? prev.filter((h) => `${h.tipo}::${h.categoria ?? ""}` !== key)
        : [...prev, { tipo, categoria: categoria ?? null }];
    });
  };

  const salvarHabilidades = async () => {
    if (saving) return;
    try {
      setSaving(true);
      setFormError(null);
      const updated = await putHabilidades(habilidades);
      if (!mountedRef.current) return;
      setHabilidades(Array.isArray(updated) ? updated : habilidades);
      setModal(null);
      setToast("Habilidades salvas.");
    } catch (e: any) {
      setFormError(apiMsg(e, "Falha ao salvar habilidades."));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  // ── Salvar: dados pessoais (nome/telefone/bio) ───────────────────────────
  const salvarDados = async () => {
    const nomeTrim = dadosForm.nome.trim();
    if (nomeTrim.length < 2) {
      setFormError("Informe seu nome completo.");
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      // PATCH mínimo: só nome/telefone/bio em /api/me
      await updatePerfilBase({
        nome: nomeTrim,
        telefone: dadosForm.telefone.trim(),
        bio: dadosForm.bio.trim(),
      });
      if (!mountedRef.current) return;
      setProfile((prev) => (prev ? { ...prev, bio: dadosForm.bio.trim() || null } : prev));
      setUser((cur) =>
        cur
          ? {
              ...cur,
              nome: nomeTrim,
              telefone: dadosForm.telefone.trim(),
              bio: dadosForm.bio.trim() || null,
            }
          : cur,
      );
      setModal(null);
      setToast("Dados atualizados.");
    } catch (e: any) {
      setFormError(apiMsg(e, "Falha ao salvar."));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  // ── Salvar: serviços oferecidos ──────────────────────────────────────────
  const toggleServicoDraft = (servico: ServicoOferecido) => {
    setServicosDraft((cur) =>
      cur.includes(servico) ? cur.filter((s2) => s2 !== servico) : [...cur, servico],
    );
  };

  const salvarServicos = async () => {
    if (saving) return;
    if (servicosDraft.length === 0) {
      setFormError("Selecione ao menos um serviço.");
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      // PATCH /api/diarista/me — payload mínimo só com servicosOferecidos
      const res = await patchDiaristaPerfil({ servicosOferecidos: servicosDraft });
      const next = Array.isArray(res?.servicosOferecidos)
        ? (res.servicosOferecidos as ServicoOferecido[])
        : servicosDraft;
      if (!mountedRef.current) return;
      setProfile((prev) => (prev ? { ...prev, servicosOferecidos: next } : prev));
      await setServicosOferecidosStore(next);
      setUser((cur) => (cur ? { ...cur, servicosOferecidos: next } : cur));
      setModal(null);
      setToast("Serviços oferecidos salvos.");
    } catch (e: any) {
      setFormError(apiMsg(e, "Falha ao salvar serviços."));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  // ── Salvar: área de atendimento ──────────────────────────────────────────
  const salvarArea = async () => {
    if (saving) return;
    const cidade = areaForm.cidade.trim();
    const uf = areaForm.uf.trim().toUpperCase();
    const bairros = splitBairros(areaForm.bairros);
    const atendeTodaCidade = areaForm.atendeTodaCidade;
    const raioRaw = areaForm.raioAtendimentoKm.trim();
    let raio: number | null = null;
    if (!atendeTodaCidade && raioRaw) {
      const parsed = Number(raioRaw.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setFormError("Informe um raio de atendimento válido em km.");
        return;
      }
      raio = Math.round(parsed);
    }
    if (!cidade) {
      setFormError("Informe a cidade.");
      return;
    }
    if (uf.length !== 2) {
      setFormError("Informe a UF com 2 letras (ex.: SP).");
      return;
    }
    // Se NÃO atende toda a cidade, exige bairros (compat com fluxo legado).
    if (!atendeTodaCidade && bairros.length === 0) {
      setFormError("Informe ao menos um bairro de atendimento.");
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      // 1) PATCH /api/diarista/me — cidade/estado + cobertura (T-15)
      await updateAreaAtendimento({
        cidade,
        estado: uf,
        atendeTodaCidade,
        raioAtendimentoKm: atendeTodaCidade ? null : raio,
      });
      // 2) PUT /api/diarista/bairros — mantém compat (bairros podem ficar vazios)
      if (bairros.length > 0) {
        await updateBairros({ cidade, uf, bairros });
      }
      if (!mountedRef.current) return;
      // Otimismo no client; loadMe vai sincronizar no próximo focus
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              cidade,
              estado: uf,
              atendeTodaCidade,
              raioAtendimentoKm: atendeTodaCidade ? null : raio,
              bairros:
                bairros.length > 0
                  ? bairros.map((nome, idx) => ({
                      id: `${idx}`,
                      bairroId: `${idx}`,
                      bairro: { id: `${idx}`, nome, cidade, uf },
                    }))
                  : prev.bairros,
            }
          : prev,
      );
      setModal(null);
      setToast("Área de atendimento salva.");
    } catch (e: any) {
      setFormError(apiMsg(e, "Falha ao salvar área."));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  // ── Salvar: preços ───────────────────────────────────────────────────────
  const salvarPrecos = async () => {
    if (saving) return;
    const observacao = precosForm.observacao.trim();
    const valorACombinar = precosForm.valorACombinar;

    // Modo 1 — valor a combinar: ignora todos os números, salva flag + obs.
    if (valorACombinar) {
      try {
        setSaving(true);
        setFormError(null);
        await updatePrecosCompletos({
          valorACombinar: true,
          observacaoPreco: observacao || null,
        });
        if (!mountedRef.current) return;
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                valorACombinar: true,
                observacaoPreco: observacao || null,
              }
            : prev,
        );
        setModal(null);
        setToast("Preços salvos.");
      } catch (e: any) {
        setFormError(apiMsg(e, "Falha ao salvar preços."));
      } finally {
        if (mountedRef.current) setSaving(false);
      }
      return;
    }

    // Modo 2 — preços por nicho
    const leve = toCents(precosForm.leve);
    const medio = toCents(precosForm.medio);
    const pesada = toCents(precosForm.pesada);
    const ofereceDiarista = servicosOferecidos.includes("DIARISTA");
    if (ofereceDiarista && (leve == null || pesada == null)) {
      setFormError("Informe valores válidos para limpeza leve e pesada.");
      return;
    }

    const ofereceBaba = servicosOferecidos.includes("BABA");
    const ofereceCozinheira = servicosOferecidos.includes("COZINHEIRA");

    const babaHora = ofereceBaba ? inputToDecimalString(precosForm.babaHora) : null;
    const cozinheiraBase = ofereceCozinheira
      ? inputToDecimalString(precosForm.cozinheiraBase)
      : null;
    const taxaMinima = inputToDecimalString(precosForm.taxaMinima);

    try {
      setSaving(true);
      setFormError(null);

      // PUT /api/diarista/precos (legado: leve/médio/pesada) — só se DIARISTA
      if (ofereceDiarista && leve != null && pesada != null) {
        await updatePrecos({
          precoLeve: leve,
          precoMedio: medio ?? undefined,
          precoPesada: pesada,
        });
      }

      // PATCH /api/diarista/me — apenas campos T-15 que mudaram
      const patchPayload: Parameters<typeof updatePrecosCompletos>[0] = {
        valorACombinar: false,
        cobraDeslocamento: precosForm.cobraDeslocamento,
        observacaoPreco: observacao || null,
        precoBabaHora: babaHora,
        precoCozinheiraBase: cozinheiraBase,
        taxaMinima,
      };
      await updatePrecosCompletos(patchPayload);

      if (!mountedRef.current) return;
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              precoLeve: ofereceDiarista && leve != null ? leve : prev.precoLeve,
              precoMedio:
                ofereceDiarista
                  ? medio ?? prev.precoMedio ?? 0
                  : prev.precoMedio,
              precoPesada:
                ofereceDiarista && pesada != null ? pesada : prev.precoPesada,
              precoBabaHora: babaHora,
              precoCozinheiraBase: cozinheiraBase,
              taxaMinima,
              cobraDeslocamento: precosForm.cobraDeslocamento,
              valorACombinar: false,
              observacaoPreco: observacao || null,
            }
          : prev,
      );
      setModal(null);
      setToast("Preços salvos.");
    } catch (e: any) {
      setFormError(apiMsg(e, "Falha ao salvar preços."));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  // ── Salvar: disponibilidade ──────────────────────────────────────────────
  const toggleDia = (idx: number) =>
    setDisponibilidadeForm((cur) => ({
      ...cur,
      dias: cur.dias.includes(idx) ? cur.dias.filter((d) => d !== idx) : [...cur.dias, idx],
    }));
  const toggleTurno = (key: string) =>
    setDisponibilidadeForm((cur) => ({
      ...cur,
      turnos: cur.turnos.includes(key) ? cur.turnos.filter((t) => t !== key) : [...cur.turnos, key],
    }));

  const salvarDisponibilidade = async () => {
    if (saving) return;
    if (disponibilidadeForm.dias.length === 0 || disponibilidadeForm.turnos.length === 0) {
      setFormError("Selecione ao menos um dia e um turno.");
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      const slots: DisponibilidadeSlot[] = [];
      disponibilidadeForm.dias.forEach((diaSemana) => {
        disponibilidadeForm.turnos.forEach((turno) => {
          slots.push({ diaSemana, turno, ativo: true });
        });
      });
      await updateDisponibilidade(slots);
      if (!mountedRef.current) return;
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              agenda: slots.map((slot, idx) => ({
                id: `${idx}`,
                diaSemana: slot.diaSemana,
                turno: slot.turno,
                ativo: true,
              })),
            }
          : prev,
      );
      setModal(null);
      setToast("Disponibilidade salva.");
    } catch (e: any) {
      setFormError(apiMsg(e, "Falha ao salvar disponibilidade."));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  // ── Toggle ativo (visibilidade do perfil) ────────────────────────────────
  const toggleAtivoPerfil = async (next: boolean) => {
    // Nota: hoje o PATCH /api/diarista/me valida apenas `servicosOferecidos`.
    // Mantemos o controle no client e mostramos como toggle de exibição.
    setProfile((prev) => (prev ? { ...prev, ativo: next } : prev));
    setToast(next ? "Perfil visível na busca." : "Perfil oculto temporariamente.");
  };

  // ── Misc ─────────────────────────────────────────────────────────────────
  const openWhats = async () => {
    const url = `https://wa.me/5565999990000?text=${encodeURIComponent("Olá! Preciso de suporte no app Dular.")}`;
    const ok = await Linking.canOpenURL(url);
    if (!ok) {
      Alert.alert("WhatsApp", "Não foi possível abrir o WhatsApp.");
      return;
    }
    await Linking.openURL(url);
  };

  // Preenche cidade/UF/bairro do formulário Área usando a localização atual
  // do dispositivo. Não bloqueia a tela: loading só no botão.
  const usarLocalizacaoAtual = async () => {
    if (localizacaoLoading) return;
    setLocalizacaoLoading(true);
    setFormError(null);
    try {
      const { coords, address } = await requestLocationWithAddress();
      if (!mountedRef.current) return;

      const cidade = address?.city || address?.subregion || "";
      const ufRaw = (address as any)?.region_code || address?.region || "";
      const uf = (ufRaw || "").trim().toUpperCase().slice(0, 2);
      const bairro = address?.district || (address as any)?.neighborhood || "";

      if (!cidade || !uf) {
        setToast("Não foi possível identificar cidade/UF da sua localização.");
        return;
      }

      // Preenche o formulário do modal (sem fechar/recarregar a tela)
      setAreaForm((cur) => ({
        ...cur,
        cidade,
        uf,
        bairros: cur.atendeTodaCidade || !bairro
          ? cur.bairros
          : (cur.bairros.trim()
              ? `${cur.bairros}, ${bairro}`
              : bairro),
      }));

      // Toast imediato — UX não espera nenhum PATCH.
      setToast("Localização carregada. Confira e salve a área.");

      // Persiste no backend em BACKGROUND (fire-and-forget). O upsert pode
      // levar segundos via ngrok/Railway, mas isso não pode travar a UI nem
      // bloquear o axios timeout do client (20s). Se falhar, o usuário ainda
      // salva via "Salvar área" depois.
      void (async () => {
        try {
          await api.patch(
            "/api/me/localizacao",
            {
              latitude: coords?.latitude ?? null,
              longitude: coords?.longitude ?? null,
              cidade,
              estado: uf,
              bairro: bairro || null,
              localizacaoPermitida: true,
            },
            // Timeout maior só para este request, já que upsert é write pesado
            // em rede lenta. Sem isso o axios default (20s) corta antes do
            // banco responder.
            { timeout: 45000 } as any,
          );
        } catch {
          // Silencioso — o salvar manual ainda funciona.
        }
      })();
    } catch (e: any) {
      if (!mountedRef.current) return;
      const msg = e?.message ?? "Não foi possível obter localização.";
      setToast(msg.includes("denied") || msg.includes("permission")
        ? "Permissão de localização negada. Preencha manualmente."
        : "Falha ao obter localização. Tente novamente.");
    } finally {
      if (mountedRef.current) setLocalizacaoLoading(false);
    }
  };

  const handleGeoToggle = async (value: boolean) => {
    setGeoEnabled(value);
    AsyncStorage.setItem(GEO_KEY, value ? "1" : "0").catch(() => undefined);
    if (value) {
      try {
        const { coords, address } = await requestLocationWithAddress();
        const cidade = address?.city || address?.subregion || "Cidade não encontrada";
        const uf = (address as any)?.region_code || address?.region || "";
        Alert.alert("Localização ativada", `${cidade}${uf ? "/" + uf : ""}`);
        void coords;
      } catch (e: any) {
        Alert.alert("Localização", e?.message ?? "Não foi possível obter sua localização.");
        setGeoEnabled(false);
        AsyncStorage.setItem(GEO_KEY, "0").catch(() => undefined);
      }
    }
  };

  const logout = () => {
    Alert.alert("Sair", "Encerrar sessão da conta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          try {
            await api.post("/api/auth/logout");
          } catch {}
          onLogout();
        },
      },
    ]);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      {toast ? (
        <View style={s.toast}>
          <Text style={s.toastText}>{toast}</Text>
        </View>
      ) : null}

      <View style={s.root}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.header}>
            <View style={s.headerSide} />
            <Text style={s.title}>Perfil</Text>
            <View style={s.headerSide} />
          </View>

          {loading ? (
            <View style={s.centerCard}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : error ? (
            <DCard style={s.errorCard}>
              <Text style={s.errorTitle}>Não foi possível carregar.</Text>
              <Text style={s.errorText}>{error}</Text>
              <DButton label="Tentar novamente" variant="secondary" onPress={() => { void loadMe(); }} />
            </DCard>
          ) : (
            <>
              <ProfileHeroCard
                nome={displayName}
                subtitle={heroSubtitle}
                location={heroLocation}
                memberSince={heroMemberSince}
                avatarUri={avatarUri}
                avatarFallback={avatarFallback}
                uploading={avatarUploading}
                onAvatarPress={pickAvatar}
                verificacaoStatus={verificacao}
                hideMemberSinceIfEmpty
              />

              {/* ── Bloco A — Status do perfil ─────────────────────────── */}
              <ProfileSection title="Status do perfil">
                <View style={s.statusCard}>
                  <View style={s.statusHeader}>
                    <View
                      style={[
                        s.statusBadge,
                        completude.completo ? s.statusBadgeOk : s.statusBadgeWarn,
                      ]}
                    >
                      <AppIcon
                        name={completude.completo ? "CheckCircle" : "AlertTriangle"}
                        size={14}
                        color={completude.completo ? colors.success : colors.warning}
                        strokeWidth={2.4}
                      />
                      <Text
                        style={[
                          s.statusBadgeText,
                          {
                            color: completude.completo ? colors.success : colors.warning,
                          },
                        ]}
                      >
                        {completude.completo ? "Perfil completo" : "Perfil incompleto"}
                      </Text>
                    </View>
                    <Text style={s.statusProgress}>{completude.progresso}%</Text>
                  </View>
                  <View style={s.progressTrack}>
                    <View
                      style={[
                        s.progressFill,
                        {
                          width: `${Math.max(4, completude.progresso)}%`,
                          backgroundColor: completude.completo ? colors.success : colors.warning,
                        },
                      ]}
                    />
                  </View>
                  {!completude.completo && completude.motivos.length > 0 ? (
                    <View style={s.motivosWrap}>
                      {completude.motivos.map((m) => (
                        <View key={m} style={s.motivoRow}>
                          <View style={s.motivoBullet} />
                          <Text style={s.motivoText}>{m}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={s.statusHint}>
                      Seu perfil está completo e aparece na busca para empregadores.
                    </Text>
                  )}
                </View>
                <ProfileSwitchRow
                  icon="Eye"
                  title="Perfil ativo"
                  subtitle="Ficar visível na busca de empregadores"
                  value={profile?.ativo ?? true}
                  onValueChange={(next) => { void toggleAtivoPerfil(next); }}
                  isLast
                />
              </ProfileSection>

              {/* ── Dados profissionais ─────────────────────────────────── */}
              <ProfileSection title="Dados profissionais">
                <ProfileRow
                  icon="User"
                  title="Nome, telefone e apresentação"
                  subtitle={
                    profile?.bio
                      ? profile.bio.slice(0, 80) + (profile.bio.length > 80 ? "…" : "")
                      : "Complete sua apresentação"
                  }
                  onPress={() => openModal("dados")}
                />
                <ProfileRow
                  icon="Sparkles"
                  title="O que você oferece"
                  subtitle={servicosResumo}
                  onPress={() => openModal("servicos")}
                />
                <ProfileRow
                  icon="MapPin"
                  title="Cidades, UF e bairros"
                  subtitle={cidadeUf}
                  onPress={() => openModal("area")}
                />
                <ProfileRow
                  icon="Wallet"
                  title="Valores por intensidade de serviço"
                  subtitle={precosResumo}
                  onPress={() => openModal("precos")}
                />
                <ProfileRow
                  icon="Star"
                  title="Catálogo de serviços"
                  subtitle={habilidadesResumo}
                  onPress={() => openModal("habilidades")}
                />
                <ProfileRow
                  icon="Calendar"
                  title="Dias e turnos"
                  subtitle={disponibilidadeResumo}
                  onPress={() => openModal("disponibilidade")}
                  isLast
                />
              </ProfileSection>

              {/* ── Documentos e segurança ──────────────────────────────── */}
              <ProfileSection title="Documentos e segurança">
                <ProfileRow
                  icon="FileText"
                  title="Verificação de documentos"
                  subtitle={
                    verificacao === "APROVADO"
                      ? "Documentos aprovados"
                      : verificacao === "PENDENTE"
                        ? "Aguardando análise dos documentos"
                        : verificacao === "REPROVADO"
                          ? "Revise seus documentos"
                          : "Envie seus documentos para verificação"
                  }
                  onPress={() => navigation.navigate("VerificacaoDocs")}
                />
                <ProfileRow
                  icon="ShieldCheck"
                  title="Segurança e SafeScore"
                  subtitle="Histórico e badges de segurança"
                  onPress={() =>
                    Alert.alert("SafeScore", "Seu SafeScore reflete histórico de comportamento na plataforma.")
                  }
                />
                <ProfileRow
                  icon="AlertTriangle"
                  title="Reportar incidente"
                  subtitle="Botão SOS"
                  danger
                  onPress={() =>
                    (navigation as any).navigate(PERFIL_STACK_ROUTES.REPORT_INCIDENT)
                  }
                />
                <ProfileRow
                  icon="Shield"
                  title="Privacidade"
                  subtitle="Controle seus dados"
                  onPress={() => (navigation as any).navigate(PERFIL_STACK_ROUTES.PRIVACIDADE)}
                  isLast
                />
              </ProfileSection>

              {/* ── Suporte, termos e utilidades ────────────────────────── */}
              <ProfileSection title="Suporte, termos e utilidades">
                <ProfileRow
                  icon="Lock"
                  title="Alterar senha"
                  subtitle="Segurança da conta"
                  onPress={() => (navigation as any).navigate(PERFIL_STACK_ROUTES.ALTERAR_SENHA)}
                />
                <ProfileRow
                  icon="MessageCircle"
                  title="Suporte no WhatsApp"
                  subtitle="Fale com a equipe"
                  onPress={openWhats}
                />
                <ProfileRow
                  icon="FileText"
                  title="Termos de uso"
                  subtitle="Leia as regras da plataforma"
                  onPress={() => (navigation as any).navigate(PERFIL_STACK_ROUTES.TERMOS)}
                />
                <ProfileSwitchRow
                  icon="MapPin"
                  title="Ativar geolocalização"
                  subtitle="Melhorar sugestões perto de você"
                  value={geoEnabled}
                  onValueChange={handleGeoToggle}
                />
                <ProfileSwitchRow
                  icon="Sparkles"
                  title="Dark mode"
                  subtitle="Tema escuro do app"
                  value={themeMode === "dark"}
                  onValueChange={toggleTheme}
                  isLast
                />
              </ProfileSection>

              {/* ── Logout ── */}
              <DCard style={s.logoutCard} onPress={logout}>
                <View style={s.logoutIcon}>
                  <AppIcon name="LogOut" size={21} color={colors.danger} strokeWidth={2.3} />
                </View>
                <View style={s.logoutTextWrap}>
                  <Text style={s.logoutTitle}>Sair</Text>
                  <Text style={s.logoutSubtitle}>Encerrar sessão da conta</Text>
                </View>
                <AppIcon name="ChevronRight" size={18} color={colors.danger} strokeWidth={2.2} />
              </DCard>
            </>
          )}
        </ScrollView>
      </View>

      {/* ────────────────────────────────────────────────────────────────────
          Modais — cada seção edita só seus próprios campos
          ──────────────────────────────────────────────────────────────────── */}

      {/* Modal Dados profissionais (B) */}
      <Modal visible={modal === "dados"} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={platformSelect({ ios: "padding", android: undefined })}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View
            style={[
              s.modalSheet,
              { maxHeight: "85%", paddingBottom: Math.max(insets.bottom, spacing.xl) },
            ]}
          >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Dados profissionais</Text>
                <Pressable onPress={closeModal} hitSlop={16} style={{ padding: 6 }}>
                  <AppIcon name="XCircle" size={23} color={colors.textSecondary} />
                </Pressable>
              </View>

              <Text style={s.modalLabel}>Nome</Text>
              <TextInput
                value={dadosForm.nome}
                onChangeText={(v) => setDadosForm((cur) => ({ ...cur, nome: v }))}
                placeholder="Seu nome"
                placeholderTextColor={colors.textMuted}
                style={s.modalInput}
                autoCapitalize="words"
              />

              <Text style={s.modalLabel}>Telefone</Text>
              <TextInput
                value={dadosForm.telefone}
                onChangeText={(v) => setDadosForm((cur) => ({ ...cur, telefone: v }))}
                placeholder="Telefone"
                placeholderTextColor={colors.textMuted}
                style={s.modalInput}
                keyboardType="phone-pad"
              />

              <Text style={s.modalLabel}>Apresentação</Text>
              <TextInput
                value={dadosForm.bio}
                onChangeText={(v) => setDadosForm((cur) => ({ ...cur, bio: v.slice(0, 300) }))}
                placeholder="Conte um pouco sobre você"
                placeholderTextColor={colors.textMuted}
                style={[s.modalInput, s.modalInputMulti]}
                multiline
                maxLength={300}
                textAlignVertical="top"
              />
              <Text style={s.charCount}>{dadosForm.bio.length}/300</Text>

              {formError ? <Text style={s.errorText}>{formError}</Text> : null}

              <DButton
                label={saving ? "Salvando…" : "Salvar dados"}
                onPress={salvarDados}
                loading={saving}
                style={s.saveButton}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Serviços oferecidos (C) */}
      <Modal visible={modal === "servicos"} animationType="fade" transparent onRequestClose={closeModal}>
        <View style={s.floatOverlay}>
          <View style={s.floatCard}>
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>Serviços oferecidos</Text>
                <Text style={s.modalSubtitle}>
                  Escolha os serviços que devem aparecer no seu perfil.
                </Text>
              </View>
              <Pressable onPress={closeModal} hitSlop={12}>
                <AppIcon name="XCircle" size={23} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={{ gap: 9 }}>
              {SERVICOS_OPTIONS.map((item) => {
                const active = servicosDraft.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleServicoDraft(item.id)}
                    disabled={saving}
                    style={({ pressed }) => [
                      s.servicoCard,
                      active && s.servicoCardActive,
                      pressed && { opacity: 0.78 },
                    ]}
                  >
                    <View style={[s.servicoIcon, active && s.servicoIconActive]}>
                      <AppIcon
                        name={item.icon}
                        size={18}
                        color={active ? colors.white : colors.primary}
                        strokeWidth={2.3}
                      />
                    </View>
                    <View style={s.servicoTextWrap}>
                      <Text style={s.servicoTitle}>{item.title}</Text>
                      <Text style={s.servicoSubtitle}>{item.subtitle}</Text>
                    </View>
                    <View style={[s.servicoCheck, active && s.servicoCheckActive]}>
                      {active ? (
                        <AppIcon name="Check" size={13} color={colors.white} strokeWidth={3} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {formError ? <Text style={s.errorText}>{formError}</Text> : null}

            <View style={s.modalActions}>
              <DButton label="Cancelar" onPress={closeModal} variant="secondary" disabled={saving} style={{ flex: 1 }} />
              <DButton
                label={saving ? "Salvando…" : "Salvar"}
                onPress={salvarServicos}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Área de atendimento (D) */}
      <Modal visible={modal === "area"} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={platformSelect({ ios: "padding", android: undefined })}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View
            style={[
              s.modalSheet,
              { maxHeight: "85%", paddingBottom: Math.max(insets.bottom, spacing.xl) },
            ]}
          >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Área de atendimento</Text>
                <Pressable onPress={closeModal} hitSlop={16} style={{ padding: 6 }}>
                  <AppIcon name="XCircle" size={23} color={colors.textSecondary} />
                </Pressable>
              </View>

              <Text style={s.modalLabel}>Cidade</Text>
              <TextInput
                value={areaForm.cidade}
                onChangeText={(v) => setAreaForm((cur) => ({ ...cur, cidade: v }))}
                placeholder="Cidade"
                placeholderTextColor={colors.textMuted}
                style={s.modalInput}
                autoCapitalize="words"
              />

              <Text style={s.modalLabel}>UF</Text>
              <TextInput
                value={areaForm.uf}
                onChangeText={(v) =>
                  setAreaForm((cur) => ({ ...cur, uf: v.toUpperCase().slice(0, 2) }))
                }
                placeholder="Ex.: SP"
                placeholderTextColor={colors.textMuted}
                style={s.modalInput}
                autoCapitalize="characters"
                maxLength={2}
              />

              <View style={s.toggleRow}>
                <View style={s.toggleTextWrap}>
                  <Text style={s.toggleTitle}>Atendo toda a cidade</Text>
                  <Text style={s.toggleSubtitle}>
                    Sem precisar restringir por bairros específicos.
                  </Text>
                </View>
                <Switch
                  value={areaForm.atendeTodaCidade}
                  onValueChange={(v) =>
                    setAreaForm((cur) => ({ ...cur, atendeTodaCidade: v }))
                  }
                  thumbColor={colors.white}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              <Pressable
                onPress={usarLocalizacaoAtual}
                disabled={localizacaoLoading}
                style={({ pressed }) => [
                  s.locationButton,
                  pressed && { opacity: 0.78 },
                  localizacaoLoading && { opacity: 0.6 },
                ]}
              >
                {localizacaoLoading ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <AppIcon name="MapPin" size={16} color={colors.primary} strokeWidth={2.2} />
                )}
                <Text style={s.locationButtonText}>
                  {localizacaoLoading ? "Buscando..." : "Usar localização atual"}
                </Text>
              </Pressable>

              {!areaForm.atendeTodaCidade ? (
                <>
                  <Text style={s.modalLabel}>Raio de atendimento (km) — opcional</Text>
                  <TextInput
                    value={areaForm.raioAtendimentoKm}
                    onChangeText={(v) =>
                      setAreaForm((cur) => ({
                        ...cur,
                        raioAtendimentoKm: v.replace(/[^0-9]/g, "").slice(0, 4),
                      }))
                    }
                    placeholder="Ex.: 10"
                    placeholderTextColor={colors.textMuted}
                    style={s.modalInput}
                    keyboardType="number-pad"
                  />

                  <Text style={s.modalLabel}>Bairros atendidos</Text>
                  <TextInput
                    value={areaForm.bairros}
                    onChangeText={(v) => setAreaForm((cur) => ({ ...cur, bairros: v }))}
                    placeholder="Ex.: Centro, Jardim América, Vila Nova"
                    placeholderTextColor={colors.textMuted}
                    style={[s.modalInput, s.modalInputMulti]}
                    multiline
                    textAlignVertical="top"
                  />
                  <Text style={s.charCount}>Separe os bairros por vírgula.</Text>
                </>
              ) : null}

              {formError ? <Text style={s.errorText}>{formError}</Text> : null}

              <DButton
                label={saving ? "Salvando…" : "Salvar área"}
                onPress={salvarArea}
                loading={saving}
                style={s.saveButton}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Preços (E) */}
      <Modal visible={modal === "precos"} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={platformSelect({ ios: "padding", android: undefined })}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View
            style={[
              s.modalSheet,
              { maxHeight: "85%", paddingBottom: Math.max(insets.bottom, spacing.xl) },
            ]}
          >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Preços</Text>
                <Pressable onPress={closeModal} hitSlop={16} style={{ padding: 6 }}>
                  <AppIcon name="XCircle" size={23} color={colors.textSecondary} />
                </Pressable>
              </View>

              <View style={s.toggleRow}>
                <View style={s.toggleTextWrap}>
                  <Text style={s.toggleTitle}>Valor a combinar</Text>
                  <Text style={s.toggleSubtitle}>
                    Sem preço fixo — combino direto com o cliente.
                  </Text>
                </View>
                <Switch
                  value={precosForm.valorACombinar}
                  onValueChange={(v) =>
                    setPrecosForm((cur) => ({ ...cur, valorACombinar: v }))
                  }
                  thumbColor={colors.white}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              {!precosForm.valorACombinar ? (
                <>
                  {servicosOferecidos.includes("DIARISTA") ? (
                    <>
                      <Text style={s.modalLabel}>Diarista — Limpeza leve (R$)</Text>
                      <TextInput
                        value={precosForm.leve}
                        onChangeText={(v) => setPrecosForm((cur) => ({ ...cur, leve: v }))}
                        placeholder="Ex.: 120,00"
                        placeholderTextColor={colors.textMuted}
                        style={s.modalInput}
                        keyboardType="decimal-pad"
                      />

                      <Text style={s.modalLabel}>Diarista — Limpeza média (R$) — opcional</Text>
                      <TextInput
                        value={precosForm.medio}
                        onChangeText={(v) => setPrecosForm((cur) => ({ ...cur, medio: v }))}
                        placeholder="Ex.: 160,00"
                        placeholderTextColor={colors.textMuted}
                        style={s.modalInput}
                        keyboardType="decimal-pad"
                      />

                      <Text style={s.modalLabel}>Diarista — Limpeza pesada (R$)</Text>
                      <TextInput
                        value={precosForm.pesada}
                        onChangeText={(v) => setPrecosForm((cur) => ({ ...cur, pesada: v }))}
                        placeholder="Ex.: 200,00"
                        placeholderTextColor={colors.textMuted}
                        style={s.modalInput}
                        keyboardType="decimal-pad"
                      />
                    </>
                  ) : null}

                  {servicosOferecidos.includes("BABA") ? (
                    <>
                      <Text style={s.modalLabel}>Babá — preço por hora (R$)</Text>
                      <TextInput
                        value={precosForm.babaHora}
                        onChangeText={(v) =>
                          setPrecosForm((cur) => ({ ...cur, babaHora: v }))
                        }
                        placeholder="Ex.: 35,00"
                        placeholderTextColor={colors.textMuted}
                        style={s.modalInput}
                        keyboardType="decimal-pad"
                      />
                    </>
                  ) : null}

                  {servicosOferecidos.includes("COZINHEIRA") ? (
                    <>
                      <Text style={s.modalLabel}>Cozinheira — preço base (R$)</Text>
                      <TextInput
                        value={precosForm.cozinheiraBase}
                        onChangeText={(v) =>
                          setPrecosForm((cur) => ({ ...cur, cozinheiraBase: v }))
                        }
                        placeholder="Ex.: 180,00"
                        placeholderTextColor={colors.textMuted}
                        style={s.modalInput}
                        keyboardType="decimal-pad"
                      />
                    </>
                  ) : null}

                  <Text style={s.modalLabel}>Taxa mínima (R$) — opcional</Text>
                  <TextInput
                    value={precosForm.taxaMinima}
                    onChangeText={(v) =>
                      setPrecosForm((cur) => ({ ...cur, taxaMinima: v }))
                    }
                    placeholder="Ex.: 80,00"
                    placeholderTextColor={colors.textMuted}
                    style={s.modalInput}
                    keyboardType="decimal-pad"
                  />

                  <View style={s.toggleRow}>
                    <View style={s.toggleTextWrap}>
                      <Text style={s.toggleTitle}>Cobro deslocamento</Text>
                      <Text style={s.toggleSubtitle}>
                        Cobra à parte fora da área padrão.
                      </Text>
                    </View>
                    <Switch
                      value={precosForm.cobraDeslocamento}
                      onValueChange={(v) =>
                        setPrecosForm((cur) => ({ ...cur, cobraDeslocamento: v }))
                      }
                      thumbColor={colors.white}
                      trackColor={{ false: colors.border, true: colors.primary }}
                    />
                  </View>
                </>
              ) : null}

              <Text style={s.modalLabel}>Observação (opcional)</Text>
              <TextInput
                value={precosForm.observacao}
                onChangeText={(v) => setPrecosForm((cur) => ({ ...cur, observacao: v.slice(0, 200) }))}
                placeholder="Ex.: Valor pode variar conforme tamanho do imóvel."
                placeholderTextColor={colors.textMuted}
                style={[s.modalInput, s.modalInputMulti]}
                multiline
                maxLength={200}
                textAlignVertical="top"
              />

              {formError ? <Text style={s.errorText}>{formError}</Text> : null}

              <DButton
                label={saving ? "Salvando…" : "Salvar preços"}
                onPress={salvarPrecos}
                loading={saving}
                style={s.saveButton}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Habilidades (F) */}
      <Modal visible={modal === "habilidades"} animationType="fade" transparent onRequestClose={closeModal}>
        <View style={s.floatOverlay}>
          <View style={s.floatCardTall}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Habilidades</Text>
              <Pressable onPress={closeModal} hitSlop={12}>
                <AppIcon name="XCircle" size={23} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {catalogo.length === 0 ? (
                <Text style={s.modalSubtitle}>Carregando catálogo…</Text>
              ) : (
                catalogo.map((t) => (
                  <View key={t.tipo} style={{ gap: 6 }}>
                    <Text style={s.catLabel}>{t.label}</Text>
                    <View style={s.chips}>
                      {t.categorias.map((c) => {
                        const key = `${t.tipo}::${c.categoria}`;
                        const active = habilidades.some(
                          (h) => `${h.tipo}::${h.categoria ?? ""}` === key,
                        );
                        return (
                          <Pressable
                            key={c.categoria}
                            onPress={() => toggleHabilidade(t.tipo, c.categoria)}
                            style={[s.chip, active && s.chipOn]}
                          >
                            <Text style={[s.chipText, active && s.chipTextOn]}>{c.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {formError ? <Text style={s.errorText}>{formError}</Text> : null}

            <View style={s.modalActions}>
              <DButton label="Cancelar" onPress={closeModal} variant="secondary" disabled={saving} style={{ flex: 1 }} />
              <DButton
                label={saving ? "Salvando…" : "Salvar"}
                onPress={salvarHabilidades}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Disponibilidade (G) */}
      <Modal
        visible={modal === "disponibilidade"}
        animationType="fade"
        transparent
        onRequestClose={closeModal}
      >
        <View style={s.floatOverlay}>
          <View style={s.floatCard}>
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>Disponibilidade</Text>
                <Text style={s.modalSubtitle}>
                  Selecione os dias e turnos em que você atende.
                </Text>
              </View>
              <Pressable onPress={closeModal} hitSlop={12}>
                <AppIcon name="XCircle" size={23} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={s.catLabel}>Dias</Text>
            <View style={s.chips}>
              {DIAS_SEMANA.map((d) => {
                const active = disponibilidadeForm.dias.includes(d.idx);
                return (
                  <Pressable
                    key={d.idx}
                    onPress={() => toggleDia(d.idx)}
                    style={[s.chip, active && s.chipOn]}
                  >
                    <Text style={[s.chipText, active && s.chipTextOn]}>{d.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={s.catLabel}>Turnos</Text>
            <View style={s.chips}>
              {TURNOS.map((t) => {
                const active = disponibilidadeForm.turnos.includes(t.key);
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => toggleTurno(t.key)}
                    style={[s.chip, active && s.chipOn]}
                  >
                    <Text style={[s.chipText, active && s.chipTextOn]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {formError ? <Text style={s.errorText}>{formError}</Text> : null}

            <View style={s.modalActions}>
              <DButton
                label="Cancelar"
                onPress={closeModal}
                variant="secondary"
                disabled={saving}
                style={{ flex: 1 }}
              />
              <DButton
                label={saving ? "Salvando…" : "Salvar"}
                onPress={salvarDisponibilidade}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
type ThemeColors = ReturnType<typeof useDularColors>;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    root: {
      flex: 1,
    },
    scroll: {
      paddingHorizontal: spacing.screenPadding,
      paddingTop: 10,
      paddingBottom: 122,
      gap: 14,
    },
    header: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerSide: {
      width: 48,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 24,
      lineHeight: 29,
      fontWeight: "700",
      letterSpacing: 0,
      textAlign: "center",
    },
    centerCard: {
      minHeight: 420,
      alignItems: "center",
      justifyContent: "center",
    },
    toast: {
      position: "absolute",
      top: 14,
      left: spacing.lg,
      right: spacing.lg,
      zIndex: 20,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      backgroundColor: colors.textPrimary,
      ...shadows.floating,
    },
    toastText: {
      color: colors.white,
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
    },
    errorCard: {
      borderRadius: radius.lg,
      gap: spacing.sm,
    },
    errorTitle: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: "700",
    },
    errorText: {
      color: colors.danger,
      ...typography.caption,
      fontWeight: "700",
      marginTop: spacing.sm,
    },

    // Status
    statusCard: {
      padding: 14,
      gap: 10,
    },
    statusHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    statusBadgeOk: {
      backgroundColor: colors.successSoft,
      borderColor: colors.success,
    },
    statusBadgeWarn: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning,
    },
    statusBadgeText: {
      ...typography.caption,
      fontWeight: "800",
    },
    statusProgress: {
      color: colors.textPrimary,
      ...typography.bodySm,
      fontWeight: "800",
    },
    progressTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: colors.divider,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 999,
    },
    motivosWrap: {
      gap: 6,
      marginTop: 2,
    },
    motivoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    motivoBullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.warning,
    },
    motivoText: {
      color: colors.textSecondary,
      ...typography.caption,
      fontWeight: "500",
      flex: 1,
    },
    statusHint: {
      color: colors.textSecondary,
      ...typography.caption,
      fontWeight: "500",
    },

    // Logout
    logoutCard: {
      borderRadius: radius.lg,
      padding: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderColor: colors.dangerSoft,
      backgroundColor: colors.surface,
    },
    logoutIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.dangerSoft,
    },
    logoutTextWrap: {
      flex: 1,
      gap: 4,
    },
    logoutTitle: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: "700",
    },
    logoutSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "500",
    },

    // Modais
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: colors.overlay,
    },
    modalSheet: {
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      backgroundColor: colors.surface,
      gap: spacing.xs,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
      gap: 12,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    modalSubtitle: {
      color: colors.textSecondary,
      ...typography.bodySm,
      lineHeight: 20,
      fontWeight: "500",
      marginTop: 4,
    },
    modalLabel: {
      marginTop: spacing.sm,
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
    },
    modalInput: {
      minHeight: 44,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      fontSize: 15,
      fontWeight: "600",
    },
    modalInputMulti: {
      minHeight: 94,
      paddingTop: 12,
    },
    charCount: {
      alignSelf: "flex-end",
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    saveButton: {
      marginTop: spacing.md,
    },
    modalActions: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 8,
      marginTop: spacing.sm,
    },
    toggleTextWrap: {
      flex: 1,
      gap: 2,
    },
    toggleTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    toggleSubtitle: {
      color: colors.textSecondary,
      ...typography.caption,
      fontWeight: "500",
    },
    locationButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.lavenderSoft,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    locationButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "700",
    },

    // Floating overlays
    floatOverlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.overlay,
    },
    floatCard: {
      width: "100%",
      borderRadius: radius.xl,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      backgroundColor: colors.surface,
      gap: spacing.sm,
      ...shadows.floating,
    },
    floatCardTall: {
      width: "100%",
      maxHeight: "82%",
      borderRadius: radius.xl,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      backgroundColor: colors.surface,
      gap: spacing.sm,
      ...shadows.floating,
    },

    // Serviços oferecidos
    servicoCard: {
      minHeight: 68,
      borderRadius: radius.md,
      borderWidth: 1.4,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    servicoCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.lavenderSoft,
    },
    servicoIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.lavender,
    },
    servicoIconActive: {
      backgroundColor: colors.primary,
    },
    servicoTextWrap: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    servicoTitle: {
      color: colors.textPrimary,
      ...typography.bodySm,
      fontWeight: "800",
    },
    servicoSubtitle: {
      color: colors.textSecondary,
      ...typography.caption,
      fontWeight: "500",
    },
    servicoCheck: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.4,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    servicoCheckActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },

    // Chips
    catLabel: {
      color: colors.textSecondary,
      ...typography.caption,
      fontWeight: "700",
      marginTop: 6,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radius.pill,
      backgroundColor: colors.lavenderSoft,
      borderWidth: 1,
      borderColor: colors.lavenderStrong,
    },
    chipOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    chipTextOn: {
      color: colors.white,
    },
  });
}
