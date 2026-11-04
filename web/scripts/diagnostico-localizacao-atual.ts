/**
 * Diagnóstico SOMENTE LEITURA da localização atual gravada pelo app até a
 * vc14 (UF cortada do nome do estado: "Mato Grosso" → "MA"). Não altera nada
 * e não propõe valor novo para ninguém: o reparo é decisão à parte.
 *
 * Imprime só contagens e, por linha suspeita, um identificador pseudônimo
 * (sha256 do id, 12 caracteres) com os sinais e o mês da gravação. Nunca
 * imprime nome, cidade, endereço, coordenada nem o id cru.
 *
 * Uso (em web/): DATABASE_URL=... npx tsx scripts/diagnostico-localizacao-atual.ts
 */
import { createHash } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { sinaisDaLocalizacaoAtual, type SinalDeLocalizacao } from "../src/lib/localizacaoBrasil";

const pseudo = (id: string) => createHash("sha256").update(id).digest("hex").slice(0, 12);
const mes = (d: Date | null) => (d ? d.toISOString().slice(0, 7) : "sem-data");

type Linha = {
  userId: string;
  cidade: string | null;
  estado: string | null;
  cidadeAtual: string | null;
  estadoAtual: string | null;
  latitude: number | null;
  localizacaoAtualizadaEm: Date | null;
  user: { enderecos: Array<{ cidade: string | null; uf: string | null }> };
};

const SELECT = {
  userId: true,
  cidade: true,
  estado: true,
  cidadeAtual: true,
  estadoAtual: true,
  latitude: true,
  localizacaoAtualizadaEm: true,
  user: { select: { enderecos: { orderBy: { updatedAt: "desc" as const }, take: 1, select: { cidade: true, uf: true } } } },
};

async function main() {
  const grupos: Array<[string, Linha[]]> = [
    ["DIARISTA", (await prisma.diaristaProfile.findMany({ where: { cidadeAtual: { not: null } }, select: SELECT })) as Linha[]],
    ["MONTADOR", (await prisma.montadorPerfil.findMany({ where: { cidadeAtual: { not: null } }, select: SELECT })) as Linha[]],
    ["EMPREGADOR", (await prisma.empregadorPerfil.findMany({ where: { cidadeAtual: { not: null } }, select: SELECT })) as Linha[]],
  ];

  for (const [papel, linhas] of grupos) {
    const porSinal = new Map<SinalDeLocalizacao, number>();
    const suspeitas: string[] = [];
    let divergeDaArea = 0;
    let comCoordenada = 0;
    for (const l of linhas) {
      if (l.latitude != null) comCoordenada++;
      if (l.estado && l.estadoAtual && l.estado.toUpperCase() !== l.estadoAtual.toUpperCase()) divergeDaArea++;
      const sinais = sinaisDaLocalizacaoAtual({
        atual: { cidade: l.cidadeAtual, estado: l.estadoAtual },
        area: { cidade: l.cidade, estado: l.estado },
        endereco: l.user.enderecos[0] ?? null,
      });
      for (const s of sinais) porSinal.set(s, (porSinal.get(s) ?? 0) + 1);
      if (sinais.length) suspeitas.push(`${pseudo(l.userId)} ${mes(l.localizacaoAtualizadaEm)} ${sinais.join(",")}`);
    }
    console.log(`\n[${papel}] com localização atual: ${linhas.length} · com coordenada: ${comCoordenada} · UF atual ≠ UF da área: ${divergeDaArea}`);
    for (const [s, n] of porSinal) console.log(`  ${s}: ${n}`);
    console.log(`  suspeitas: ${suspeitas.length}`);
    for (const s of suspeitas) console.log(`    ${s}`);
  }
}

main()
  .catch(() => {
    console.error("[diagnostico-localizacao] falhou (detalhe omitido: pode conter dado pessoal).");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
