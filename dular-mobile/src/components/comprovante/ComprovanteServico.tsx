import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { DAvatar, DBadge } from "@/components/ui";
import { api } from "@/lib/api";
import type { ProfileTheme } from "@/theme/profileTheme";
import { colors, radius, shadow } from "@/theme/tokens";
import { formatHorario, parseDataServico, protocoloServico } from "@/utils/formatters";
import { compartilharComprovante, type LinhaComprovante } from "@/utils/comprovantePdf";

/**
 * Comprovante de um serviço — o MESMO nos três perfis.
 *
 * O comprovante existia só no empregador. A diarista e o montador tinham
 * telas de detalhe com um cartão de informações, e nenhuma forma de tirar
 * dali um documento: quem presta o serviço é justamente quem mais precisa
 * comprovar renda.
 *
 * O que muda por perfil é a PERSPECTIVA, não o conteúdo: quem paga lê
 * "Pagamento · Recebedor"; quem recebe lê "Recebimento · Conta que recebeu".
 * Os dois veem as duas partes, o mesmo valor e a mesma linha do tempo — é o
 * mesmo fato, visto de lados opostos.
 */

export type PerspectivaComprovante = "contratante" | "profissional";

/** O que a rota de detalhe traz além da lista. Tudo opcional: serviços
 *  antigos podem não ter parte destes campos. */
type Detalhe = {
  eventos?: { createdAt: string }[];
  cliente?: { nome?: string | null; telefone?: string | null; avatarUrl?: string | null } | null;
  diarista?: { nome?: string | null; telefone?: string | null; avatarUrl?: string | null } | null;
  montador?: { nome?: string | null; telefone?: string | null; avatarUrl?: string | null } | null;
  enderecoCompleto?: string | null;
  observacoes?: string | null;
  temPet?: boolean;
  quartos3Mais?: boolean;
  banheiros2Mais?: boolean;
  paymentReportedAt?: string | null;
  paymentConfirmedAt?: string | null;
  paymentDisputedAt?: string | null;
  recebimento?: {
    titular: string;
    banco?: string | null;
    tipoChave: string;
    chaveMascarada: string;
  } | null;
};

export type ServicoComprovante = {
  id: string;
  status: string;
  tipo?: string | null;
  categoria?: string | null;
  data: string | number | Date;
  hora?: string | null;
  turno?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  precoFinal: number;
  avaliacao?: {
    notaGeral: number;
    pontualidade: number;
    qualidade: number;
    comunicacao: number;
    comentario?: string | null;
  } | null;
};

const TIPO_LABEL: Record<string, string> = {
  FAXINA: "Diarista",
  FAXINEIRA: "Diarista",
  BABA: "Babá",
  CUIDADORA: "Cuidadora",
  COZINHEIRA: "Cozinheira",
  PASSA_ROUPA: "Passadeira",
  LAVADEIRA: "Lavadeira",
  MONTADOR: "Montador",
};

const TIPO_CHAVE_LABEL: Record<string, string> = {
  CPF: "CPF",
  CNPJ: "CNPJ",
  EMAIL: "E-mail",
  TELEFONE: "Telefone",
  PHONE: "Telefone",
  ALEATORIA: "Chave aleatória",
  RANDOM: "Chave aleatória",
  EVP: "Chave aleatória",
};

const ENCERRADOS = ["CONCLUIDO", "CONFIRMADO", "FINALIZADO", "FINALIZADO_CLIENTE", "PAGO", "AVALIADO"];

const up = (v: unknown) => String(v ?? "").toUpperCase();

function statusLabel(st?: string | null) {
  const s = up(st);
  if (s === "PENDENTE" || s === "SOLICITADO") return "Aguardando aceite";
  if (s === "ACEITO") return "Aceito";
  if (s === "INICIADO" || s === "EM_ANDAMENTO") return "Em andamento";
  if (s === "AGUARDANDO_FINALIZACAO") return "Aguardando confirmação";
  if (s === "CONCLUIDO") return "Concluído";
  if (s === "CONFIRMADO") return "Confirmado";
  if (s === "FINALIZADO") return "Finalizado";
  if (s === "CANCELADO") return "Cancelado";
  if (s === "RECUSADO") return "Recusado";
  return st || "Status";
}

function statusVariant(st?: string | null): "success" | "warning" | "default" | "error" {
  const s = up(st);
  if (["CONFIRMADO", "FINALIZADO"].includes(s)) return "success";
  if (["CONCLUIDO", "ACEITO", "INICIADO", "EM_ANDAMENTO"].includes(s)) return "warning";
  if (["CANCELADO", "RECUSADO"].includes(s)) return "error";
  return "default";
}

function tipoLabel(t?: string | null) {
  return TIPO_LABEL[up(t)] ?? "Serviço";
}

function categoriaLabel(c?: string | null) {
  if (!c) return null;
  return String(c)
    .replace(/^MONTADOR_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (m) => m.toUpperCase());
}

/** Data do serviço é meia-noite UTC — normaliza p/ não deslizar o dia (fuso). */
const formatDate = (v?: string | number | Date | null) =>
  parseDataServico(v)?.toLocaleDateString("pt-BR") ?? "--";

function formatDateTime(v?: string | number | Date | null) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Nota como o resto do app já mostra: "5,0", não "5/5".
 *
 * A fração parecia contagem ("cinco de cinco itens") num documento cheio de
 * outras contagens, e brigava com o card do profissional, que sempre exibiu
 * decimal com vírgula.
 */
function formatNota(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

function formatPreco(centavos?: number | null) {
  if (!centavos || centavos <= 0) return "A combinar";
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}

/** O que foi contratado além do tipo — é o que justifica o valor. */
function escopo(d: Detalhe | null): string | null {
  if (!d) return null;
  const itens: string[] = [];
  if (d.temPet) itens.push("Tem pet");
  if (d.quartos3Mais) itens.push("3+ quartos");
  if (d.banheiros2Mais) itens.push("2+ banheiros");
  return itens.length > 0 ? itens.join(" · ") : null;
}

function RowKV({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.kvRow}>
      <Text style={s.kvLabel}>{label}</Text>
      <Text style={s.kvValue}>{value}</Text>
    </View>
  );
}

/**
 * Busca o detalhe e monta o comprovante.
 *
 * É um hook, e não estado interno do componente, porque o botão de
 * compartilhar mora no CABEÇALHO da tela — na linha do voltar e do título,
 * como nas demais telas do app —, enquanto o corpo é desenhado aqui embaixo.
 * A tela chama o hook uma vez e usa as duas pontas, sem buscar duas vezes.
 */
export function useComprovante(
  // Aceita nulo porque a tela ainda pode estar carregando: hook não pode ser
  // chamado condicionalmente, então quem decide é ele, não o chamador.
  servico: ServicoComprovante | null | undefined,
  perspectiva: PerspectivaComprovante,
  onAviso?: (texto: string) => void,
) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const protocolo = protocoloServico(servico?.id);

  // Contratante, endereço completo, escopo, linha do tempo do pagamento e para
  // onde o PIX foi só existem na rota de detalhe — a lista não os devolve.
  useEffect(() => {
    const id = servico?.id;
    if (!id) return;
    let cancelado = false;
    (async () => {
      try {
        const res = await api.get(`/api/servicos/${id}`);
        if (!cancelado && res.data?.servico) setDetalhe(res.data.servico as Detalhe);
      } catch {
        /* silencioso: o comprovante mostra o que tiver */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [servico?.id]);

  const doProfissional = perspectiva === "profissional";
  const categoria = categoriaLabel(servico?.categoria);
  const detalhes = escopo(detalhe);
  const recebimento = detalhe?.recebimento ?? null;
  const informadoEm = formatDateTime(detalhe?.paymentReportedAt);
  const pagoEm = formatDateTime(detalhe?.paymentConfirmedAt);
  const contestadoEm = formatDateTime(detalhe?.paymentDisputedAt);
  const enderecoLinha = detalhe?.enderecoCompleto?.trim() || null;
  const emitidoEm = formatDateTime(new Date()) ?? "";
  const valorLabel = formatPreco(servico?.precoFinal);

  const nomeProfissional =
    detalhe?.diarista?.nome?.trim() || detalhe?.montador?.nome?.trim() || null;
  const telProfissional = detalhe?.diarista?.telefone || detalhe?.montador?.telefone || null;
  const nomeContratante = detalhe?.cliente?.nome?.trim() || null;
  // Cada avatar vem do SEU lado do detalhe. A tela passava um só, e a do
  // montador mandava o do empregador — que era desenhado ao lado de
  // "Profissional", ou seja, a foto errada com o nome certo.
  const avatarProfissional = detalhe?.diarista?.avatarUrl || detalhe?.montador?.avatarUrl || null;
  const avatarContratante = detalhe?.cliente?.avatarUrl || null;

  // Sem evento de finalização registrado, admite que não sabe em vez de
  // escrever "Não finalizado" ao lado de um selo "Finalizado".
  const encerrado = ENCERRADOS.includes(up(servico?.status));
  const finalizadoEm = formatDateTime(detalhe?.eventos?.[0]?.createdAt);
  const finalizadoLabel = finalizadoEm ?? (encerrado ? "Data não registrada" : null);

  const tituloPagamento = doProfissional ? "Recebimento" : "Pagamento";
  const rotuloRecebedor = doProfissional ? "Conta que recebeu" : "Recebedor";

  const linhasServico: LinhaComprovante[] = [
    { rotulo: "Tipo", valor: tipoLabel(servico?.tipo) },
    ...(categoria ? [{ rotulo: "Categoria", valor: categoria }] : []),
    { rotulo: "Horário", valor: formatHorario(servico?.hora, servico?.turno) },
    ...(detalhes ? [{ rotulo: "Detalhes", valor: detalhes }] : []),
  ];
  const linhasDatas: LinhaComprovante[] = [
    { rotulo: "Agendada", valor: formatDate(servico?.data) },
    ...(finalizadoLabel ? [{ rotulo: "Finalização", valor: finalizadoLabel }] : []),
  ];
  const linhasPagamento: LinhaComprovante[] = [
    ...(recebimento
      ? [
          { rotulo: rotuloRecebedor, valor: recebimento.titular },
          ...(recebimento.banco ? [{ rotulo: "Banco", valor: recebimento.banco }] : []),
          {
            rotulo: TIPO_CHAVE_LABEL[up(recebimento.tipoChave)] ?? "Chave PIX",
            valor: recebimento.chaveMascarada,
          },
        ]
      : []),
    ...(informadoEm ? [{ rotulo: "Pagamento informado", valor: informadoEm }] : []),
    ...(pagoEm ? [{ rotulo: "Confirmado pelo profissional", valor: pagoEm }] : []),
    ...(contestadoEm ? [{ rotulo: "Contestado", valor: contestadoEm }] : []),
  ];

  const compartilhar = async () => {
    if (gerandoPdf) return;
    setGerandoPdf(true);
    try {
      await compartilharComprovante({
        protocolo,
        status: statusLabel(servico?.status),
        emitidoEm,
        resumo: {
          servico: [tipoLabel(servico?.tipo), categoria].filter(Boolean).join(" · "),
          quando: `${formatDate(servico?.data)} · ${formatHorario(servico?.hora, servico?.turno)}`,
        },
        servico: linhasServico,
        observacoes: detalhe?.observacoes?.trim() || null,
        profissional: { nome: nomeProfissional ?? "Aguardando profissional", telefone: telProfissional },
        contratante: nomeContratante
          ? { nome: nomeContratante, telefone: detalhe?.cliente?.telefone ?? null }
          : null,
        local: [
          ...(enderecoLinha ? [enderecoLinha] : []),
          `${servico?.bairro}, ${servico?.cidade} - ${servico?.uf}`,
        ],
        datas: linhasDatas,
        valor: valorLabel,
        pagamento: linhasPagamento,
        viaPix: !!recebimento,
        avaliacao: servico?.avaliacao
          ? {
              nota: formatNota(servico?.avaliacao.notaGeral),
              comentario: servico?.avaliacao.comentario,
              linhas: [
                { rotulo: "Pontualidade", valor: formatNota(servico?.avaliacao.pontualidade) },
                { rotulo: "Qualidade", valor: formatNota(servico?.avaliacao.qualidade) },
                { rotulo: "Comunicação", valor: formatNota(servico?.avaliacao.comunicacao) },
              ],
            }
          : null,
      });
    } catch {
      onAviso?.("Não foi possível gerar o comprovante.");
    } finally {
      setGerandoPdf(false);
    }
  };

  return {
    compartilhar,
    gerandoPdf,
    protocolo,
    detalhe,
    perspectiva,
    dados: {
      statusTexto: statusLabel(servico?.status),
      statusTipo: statusVariant(servico?.status),
      linhasServico,
      linhasDatas,
      linhasPagamento,
      enderecoLinha,
      nomeProfissional,
      telProfissional,
      nomeContratante,
      valorLabel,
      viaPix: !!recebimento,
      tituloPagamento,
      emitidoEm,
      avatarProfissional,
      avatarContratante,
      iniciais: (nomeProfissional ?? "?").slice(0, 2).toUpperCase(),
      iniciaisContratante: (nomeContratante ?? "?").slice(0, 2).toUpperCase(),
    },
  };
}

export type Comprovante = ReturnType<typeof useComprovante>;

/** Botão de compartilhar do cabeçalho — mesmo círculo do BackCircleButton. */
export function BotaoCompartilharComprovante({
  comprovante,
  theme,
}: {
  comprovante: Comprovante;
  theme: ProfileTheme;
}) {
  return (
    <Pressable
      onPress={comprovante.compartilhar}
      disabled={comprovante.gerandoPdf}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Compartilhar comprovante"
      style={({ pressed }) => [
        s.btnCabecalho,
        { borderColor: theme.border },
        (pressed || comprovante.gerandoPdf) && { opacity: 0.6 },
      ]}
    >
      {comprovante.gerandoPdf ? (
        <ActivityIndicator size="small" color={theme.icon} />
      ) : (
        <Ionicons name="share-outline" size={19} color={theme.icon} />
      )}
    </Pressable>
  );
}

type Props = {
  comprovante: Comprovante;
  servico: ServicoComprovante;
  theme: ProfileTheme;
  /** Avatar da outra parte, quando a tela já o tem em mãos. */
  avatarUrl?: string | null;
  onAviso?: (texto: string) => void;
};

export function ComprovanteServico({ comprovante, servico, theme, avatarUrl, onAviso }: Props) {
  const { protocolo, detalhe, dados } = comprovante;
  const {
    statusTexto,
    statusTipo,
    linhasServico,
    linhasDatas,
    linhasPagamento,
    enderecoLinha,
    nomeProfissional,
    telProfissional,
    nomeContratante,
    valorLabel,
    viaPix,
    tituloPagamento,
    emitidoEm,
    avatarProfissional,
    avatarContratante,
    iniciais,
    iniciaisContratante,
  } = dados;

  return (
    <>
      {/* PROTOCOLO + status + compartilhar */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>Protocolo</Text>
        <View style={s.protocoloRow}>
          <Pressable
            onPress={async () => {
              await Clipboard.setStringAsync(protocolo);
              onAviso?.("Protocolo copiado.");
            }}
            hitSlop={8}
            style={s.protocoloPress}
          >
            <Text style={s.protocolo}>{protocolo}</Text>
            <Ionicons name="copy-outline" size={15} color={colors.sub} />
          </Pressable>
          <DBadge label={statusTexto} type={statusTipo} />
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.sectionLabel}>Serviço</Text>
        {linhasServico.map((l, i) => (
          <View key={l.rotulo}>
            {i > 0 ? <View style={s.divider} /> : null}
            <RowKV label={l.rotulo} value={l.valor} />
          </View>
        ))}
        {detalhe?.observacoes?.trim() ? (
          <>
            <View style={s.divider} />
            <Text style={s.obsLabel}>Observações</Text>
            <Text style={s.obsTexto}>{detalhe.observacoes.trim()}</Text>
          </>
        ) : null}
      </View>

      {/* PARTES — um comprovante nomeia os dois lados. */}
      <View style={s.card}>
        <Text style={s.sectionLabel}>Partes</Text>
        <View style={s.parteRow}>
          <DAvatar size="md" uri={avatarProfissional ?? avatarUrl ?? undefined} initials={iniciais} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.parteFuncao}>Profissional</Text>
            <Text style={s.parteNome}>{nomeProfissional ?? "Aguardando profissional"}</Text>
            {telProfissional ? <Text style={s.parteSub}>{telProfissional}</Text> : null}
          </View>
        </View>
        {nomeContratante ? (
          <>
            <View style={s.divider} />
            {/* Mesma linha do profissional: as duas partes têm o mesmo peso
                num comprovante, e só uma tinha rosto. */}
            <View style={s.parteRow}>
              <DAvatar size="md" uri={avatarContratante ?? undefined} initials={iniciaisContratante} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.parteFuncao}>Contratante</Text>
                <Text style={s.parteNome}>{nomeContratante}</Text>
                {detalhe?.cliente?.telefone ? (
                  <Text style={s.parteSub}>{detalhe.cliente.telefone}</Text>
                ) : null}
              </View>
            </View>
          </>
        ) : null}
      </View>

      <View style={s.card}>
        <Text style={s.sectionLabel}>Local</Text>
        <View style={s.infoRow}>
          <Ionicons name="location-outline" size={15} color={theme.icon} />
          <View style={{ flex: 1 }}>
            {enderecoLinha ? <Text style={s.infoText}>{enderecoLinha}</Text> : null}
            <Text style={enderecoLinha ? s.infoTextSub : s.infoText}>
              {servico.bairro}, {servico.cidade} - {servico.uf}
            </Text>
          </View>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.sectionLabel}>Datas</Text>
        {linhasDatas.map((l, i) => (
          <View key={l.rotulo}>
            {i > 0 ? <View style={s.divider} /> : null}
            <RowKV label={l.rotulo} value={l.valor} />
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.sectionLabel}>{tituloPagamento}</Text>
        <View style={s.pagamentoTopo}>
          <Text style={[s.valor, { color: theme.textAccent }]}>{valorLabel}</Text>
          {viaPix ? <Text style={s.pagamentoForma}>via PIX</Text> : null}
        </View>
        {linhasPagamento.map((l) => (
          <View key={l.rotulo}>
            <View style={s.divider} />
            <RowKV label={l.rotulo} value={l.valor} />
          </View>
        ))}
      </View>

      {servico.avaliacao ? (
        <View style={s.card}>
          <Text style={s.sectionLabel}>Avaliação</Text>
          <View style={s.infoRow}>
            <Ionicons name="star" size={16} color={colors.star} />
            <Text style={[s.infoText, { fontWeight: "700" }]}>
              {formatNota(servico.avaliacao.notaGeral)}
            </Text>
          </View>
          {servico.avaliacao.comentario ? (
            <Text style={s.comentario}>“{servico.avaliacao.comentario}”</Text>
          ) : null}
          <View style={s.divider} />
          <RowKV label="Pontualidade" value={formatNota(servico.avaliacao.pontualidade)} />
          <RowKV label="Qualidade" value={formatNota(servico.avaliacao.qualidade)} />
          <RowKV label="Comunicação" value={formatNota(servico.avaliacao.comunicacao)} />
        </View>
      ) : null}

      <Text style={s.rodape}>Guarde este protocolo para suporte: {protocolo}</Text>
      <Text style={s.emissao}>Emitido em {emitidoEm}</Text>
    </>
  );
}

export default ComprovanteServico;

const s = StyleSheet.create({
  section: { gap: 6 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.sub,
  },
  protocoloRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  protocoloPress: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  protocolo: { fontSize: 17, fontWeight: "800", color: colors.ink },
  card: {
    gap: 6,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.stroke,
    ...shadow.card,
  },
  kvRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 3 },
  kvLabel: { fontSize: 13, fontWeight: "500", color: colors.sub },
  kvValue: { fontSize: 13, fontWeight: "700", color: colors.ink, flexShrink: 1, textAlign: "right" },
  divider: { height: 1, backgroundColor: colors.stroke },
  parteRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  parteFuncao: { fontSize: 11, fontWeight: "700", color: colors.sub, textTransform: "uppercase", letterSpacing: 0.4 },
  parteNome: { fontSize: 14, fontWeight: "700", color: colors.ink },
  parteSub: { fontSize: 12, fontWeight: "500", color: colors.sub },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  infoText: { fontSize: 13, fontWeight: "500", color: colors.ink, flex: 1 },
  infoTextSub: { fontSize: 12, fontWeight: "500", color: colors.sub },
  obsLabel: { fontSize: 12, fontWeight: "700", color: colors.sub },
  obsTexto: { fontSize: 13, fontWeight: "500", color: colors.ink, lineHeight: 19 },
  pagamentoTopo: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
  pagamentoForma: { fontSize: 12, fontWeight: "700", color: colors.sub },
  valor: { fontSize: 20, fontWeight: "800" },
  comentario: { fontSize: 13, fontWeight: "500", color: colors.ink, fontStyle: "italic" },
  btnCabecalho: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rodape: { fontSize: 11, fontWeight: "500", color: colors.sub, textAlign: "center", marginTop: 6 },
  emissao: { fontSize: 11, fontWeight: "500", color: colors.sub, textAlign: "center", marginTop: 2 },
});
