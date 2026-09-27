/**
 * Seed do banco de STAGING — somente dados sintéticos.
 *
 * Nenhum nome, e-mail, telefone ou documento real: e-mails em @exemplo.test
 * (domínio reservado), telefones 55000000xxxx, nomes com o prefixo [STG].
 * Não usar seed.ts (tem conta real) nem copiar-contas-para-prod.ts.
 *
 * Antes de gravar qualquer coisa:
 *   - confirma a identidade do banco (scripts/staging/confirmar-banco.mjs);
 *   - recusa se já existir QUALQUER usuário (o staging nasce vazio; um banco
 *     com gente dentro não é o lugar deste seed).
 *
 * Uso (em web/, com as variáveis do staging):
 *   STAGING_SENHA=<senha sintética> npx tsx prisma/seed-staging.ts
 */
import { PrismaClient, type PaymentStatus, type ServicoStatus, type ServicoTipo } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password";
import { confirmarBancoStaging } from "../scripts/staging/confirmar-banco.mjs";

const HORA = 60 * 60 * 1000;

async function main() {
  const senha = process.env.STAGING_SENHA ?? "";
  if (senha.length < 16) throw new Error("STAGING_SENHA ausente ou curta (mínimo 16).");

  const id = await confirmarBancoStaging();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_UNPOOLED! }) });
  try {
    if ((await prisma.user.count()) > 0) throw new Error("O banco já tem usuários: seed recusado.");

    const senhaHash = await hashPassword(senha);
    const pessoa = (nome: string, email: string, telefone: string, role: "EMPREGADOR" | "DIARISTA" | "MONTADOR") =>
      prisma.user.create({ data: { nome: `[STG] ${nome}`, email, telefone, role, senhaHash } });

    const ana = await pessoa("Empregadora Ana Exemplo", "empregadora@exemplo.test", "5500000000101", "EMPREGADOR");
    const bruno = await pessoa("Empregador Bruno Exemplo", "empregador2@exemplo.test", "5500000000102", "EMPREGADOR");
    const carla = await pessoa("Diarista Carla Exemplo", "diarista@exemplo.test", "5500000000201", "DIARISTA");
    const davi = await pessoa("Montador Davi Exemplo", "montador@exemplo.test", "5500000000301", "MONTADOR");

    const agora = Date.now();
    let n = 0;
    async function servico(opts: {
      cliente: string;
      diarista?: string;
      montador?: string;
      status: ServicoStatus;
      pagamento?: PaymentStatus;
      mensagens?: number;
    }) {
      const tipo: ServicoTipo = opts.montador ? "MONTADOR" : "FAXINA";
      const s = await prisma.servico.create({
        data: {
          tipo,
          data: new Date(agora + ++n * 24 * HORA),
          turno: "TARDE",
          cidade: "Cidade Exemplo",
          uf: "MT",
          bairro: "Bairro Exemplo",
          precoFinal: 15000,
          clientId: opts.cliente,
          diaristaId: opts.diarista ?? null,
          montadorId: opts.montador ?? null,
          status: opts.status,
          paymentStatus: opts.pagamento ?? "WAITING_PAYMENT",
        },
      });
      const sala = await prisma.chatRoom.create({ data: { servicoId: s.id } });
      const profissional = (opts.diarista ?? opts.montador)!;
      const total = opts.mensagens ?? 4;
      const inicio = agora - (total + 1) * 60_000;
      await prisma.chatMessage.createMany({
        data: Array.from({ length: total }, (_, i) => {
          const doCliente = i % 3 === 0;
          const recente = i >= total - 2;
          const t = new Date(inicio + i * 60_000);
          return {
            roomId: sala.id,
            senderId: doCliente ? opts.cliente : profissional,
            type: "TEXT" as const,
            content: `[STG] mensagem ${String(i + 1).padStart(2, "0")} de ${total}`,
            createdAt: t,
            // As duas últimas ficam não lidas; as demais, entregues e lidas.
            deliveredAt: recente ? null : t,
            readAt: recente ? null : t,
          };
        }),
      });
      return s;
    }

    // Ativas (a exclusão recusa).
    await servico({ cliente: ana.id, diarista: carla.id, status: "ACEITO" });
    await servico({ cliente: ana.id, diarista: carla.id, status: "EM_ANDAMENTO" });
    await servico({ cliente: ana.id, montador: davi.id, status: "AGUARDANDO_FINALIZACAO" });
    // Arquivadas em cada estado de pagamento.
    await servico({ cliente: ana.id, diarista: carla.id, status: "CONCLUIDO", pagamento: "WAITING_PAYMENT" });
    await servico({ cliente: ana.id, diarista: carla.id, status: "CONCLUIDO", pagamento: "PAYMENT_REPORTED" });
    await servico({ cliente: ana.id, montador: davi.id, status: "CONFIRMADO", pagamento: "PAYMENT_DISPUTED" });
    await servico({ cliente: ana.id, montador: davi.id, status: "CONFIRMADO", pagamento: "PAYMENT_CONFIRMED" });
    await servico({ cliente: ana.id, diarista: carla.id, status: "FINALIZADO", pagamento: "PAYMENT_CONFIRMED" });
    // Histórico paginado: mais de 50 mensagens.
    await servico({ cliente: ana.id, montador: davi.id, status: "FINALIZADO", pagamento: "PAYMENT_CONFIRMED", mensagens: 70 });
    // Isolamento entre contas: outro empregador com a mesma diarista.
    await servico({ cliente: bruno.id, diarista: carla.id, status: "FINALIZADO", pagamento: "PAYMENT_CONFIRMED" });

    const [usuarios, servicos, salas, mensagens] = await Promise.all([
      prisma.user.count(),
      prisma.servico.count(),
      prisma.chatRoom.count(),
      prisma.chatMessage.count(),
    ]);
    console.log(`[staging] seed em ${id.banco}: ${usuarios} usuários, ${servicos} serviços, ${salas} salas, ${mensagens} mensagens.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(`[staging] seed RECUSADO: ${e?.falhaDeIdentidade || e instanceof Error ? e.message : "erro"}`);
  process.exit(1);
});
