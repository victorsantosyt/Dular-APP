import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { hashPassword } from "../src/lib/password";

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new pg.Pool({ connectionString: datasourceUrl });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  // Território do piloto (inclui variação com e sem acento para evitar “não achou bairro”)
  const territórios = [
    { cidade: "Cuiaba", uf: "MT", bairros: ["Centro", "Santa Rosa", "Jardim Italia"] },
    { cidade: "Cuiabá", uf: "MT", bairros: ["Centro", "Santa Rosa", "Jardim Itália"] },
  ];

  for (const t of territórios) {
    for (const nome of t.bairros) {
      await prisma.bairro.upsert({
        where: { nome_cidade_uf: { nome, cidade: t.cidade, uf: t.uf } },
        update: {},
        create: { nome, cidade: t.cidade, uf: t.uf },
      });
    }
  }

  // Senhas padrão
  const senhaCliente = await hashPassword("cliente123");
  const senhaDiarista = await hashPassword("diarista123");
  const senhaAdmin = await hashPassword("admin123");
  const senhaAdminExtra = await hashPassword("S982575428yt");

  // ADMIN
  await prisma.user.upsert({
    where: { telefone: "65999990000" },
    update: {},
    create: {
      nome: "Admin Dular",
      telefone: "65999990000",
      senhaHash: senhaAdmin,
      role: "ADMIN",
    },
  });

  // ADMIN extra (pedido: victordev.tec@gmail.com / S982575428yt)
  await prisma.user.upsert({
    where: { telefone: "65999990100" },
    update: {
      nome: "Victor Dev",
      email: "victordev.tec@gmail.com",
    },
    create: {
      nome: "Victor Dev",
      telefone: "65999990100",
      email: "victordev.tec@gmail.com",
      senhaHash: senhaAdminExtra,
      role: "ADMIN",
    },
  });

  // Clientes de teste
  const clientes = [
    { nome: "Cliente Teste 1", tel: "65999990001" },
    { nome: "Cliente Teste 2", tel: "65999990003" },
    { nome: "Cliente Teste 3", tel: "65999990004" },
  ];

  for (const c of clientes) {
    await prisma.user.upsert({
      where: { telefone: c.tel },
      update: {},
      create: { nome: c.nome, telefone: c.tel, senhaHash: senhaCliente, role: "CLIENTE" },
    });
  }

  // Diaristas do piloto
  const diaristas = [
    {
      nome: "Mariana Silva",
      tel: "65999990002",
      precoLeve: 15000,
      precoPesada: 22000,
      bio: "Capricho e pontualidade.",
      bairros: ["Centro", "Santa Rosa"],
      disponibilidade: [
        { diaSemana: 1, turno: "MANHA" },
        { diaSemana: 1, turno: "TARDE" },
        { diaSemana: 3, turno: "MANHA" },
      ],
    },
    {
      nome: "Amanda Costa",
      tel: "65999990005",
      precoLeve: 16000,
      precoPesada: 24000,
      bio: "Experiência em residências e pets.",
      bairros: ["Centro", "Jardim Italia"],
      disponibilidade: [
        { diaSemana: 2, turno: "MANHA" },
        { diaSemana: 4, turno: "TARDE" },
      ],
    },
    {
      nome: "Carlos Pereira",
      tel: "65999990006",
      precoLeve: 14000,
      precoPesada: 21000,
      bio: "Rápido e organizado.",
      bairros: ["Santa Rosa", "Centro"],
      disponibilidade: [
        { diaSemana: 5, turno: "MANHA" },
        { diaSemana: 6, turno: "TARDE" },
      ],
    },
  ];

  for (const d of diaristas) {
    const user = await prisma.user.upsert({
      where: { telefone: d.tel },
      update: { nome: d.nome },
      create: {
        nome: d.nome,
        telefone: d.tel,
        senhaHash: senhaDiarista,
        role: "DIARISTA",
      },
    });

    const profile = await prisma.diaristaProfile.upsert({
      where: { userId: user.id },
      update: {
        verificacao: "VERIFICADO",
        precoLeve: d.precoLeve,
        precoPesada: d.precoPesada,
        bio: d.bio,
      },
      create: {
        userId: user.id,
        verificacao: "VERIFICADO",
        precoLeve: d.precoLeve,
        precoPesada: d.precoPesada,
        bio: d.bio,
      },
    });

    // Habilidades (tags/categorias)
    const habilidades =
      d.tel === "65999990002"
        ? [
            { tipo: "FAXINA", categoria: "FAXINA_LEVE" },
            { tipo: "FAXINA", categoria: "FAXINA_PESADA" },
          ]
        : d.tel === "65999990005"
        ? [{ tipo: "BABA", categoria: "BABA_DIURNA" }]
        : [
            { tipo: "FAXINA", categoria: "FAXINA_COMPLETA" },
            { tipo: "PASSA_ROUPA", categoria: "PASSA_ROUPA_BASICO" },
          ];

    await prisma.diaristaHabilidade.deleteMany({ where: { diaristaId: user.id } });
    await prisma.diaristaHabilidade.createMany({
      data: habilidades.map((h) => ({
        diaristaId: user.id,
        tipo: h.tipo as any,
        categoria: h.categoria as any,
      })),
      skipDuplicates: true,
    });

    // Bairros (tenta nas duas variantes de cidade para cobrir acentos)
    for (const t of territórios) {
      for (const nome of d.bairros) {
        const b = await prisma.bairro.findUnique({
          where: { nome_cidade_uf: { nome, cidade: t.cidade, uf: t.uf } },
        });
        if (!b) continue;
        await prisma.diaristaBairro.upsert({
          where: { diaristaId_bairroId: { diaristaId: profile.id, bairroId: b.id } },
          update: {},
          create: { diaristaId: profile.id, bairroId: b.id },
        });
      }
    }

    // Disponibilidade
    for (const slot of d.disponibilidade) {
      await prisma.disponibilidade.upsert({
        where: {
          diaristaId_diaSemana_turno: {
            diaristaId: profile.id,
            diaSemana: slot.diaSemana,
            turno: slot.turno as any,
          },
        },
        update: { ativo: true },
        create: {
          diaristaId: profile.id,
          diaSemana: slot.diaSemana,
          turno: slot.turno as any,
          ativo: true,
        },
      });
    }
  }

  console.log("Seed concluído:");
  console.log("Admin: 65999990000 / admin123");
  console.log("Admin extra: 65999990100 / S982575428yt (email: victordev.tec@gmail.com)");
  console.log("Clientes:");
  clientes.forEach((c) => console.log(`- ${c.tel} / cliente123`));
  console.log("Diaristas:");
  diaristas.forEach((d) => console.log(`- ${d.tel} / diarista123 (${d.nome})`));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
