import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  avaliarPosicao,
  criarConsultaDescartavel,
  ESTADOS_DO_BRASIL,
  interpretarGeocodificacao,
  mensagemSemMunicipio,
  ufDoEstado,
  IDADE_MAXIMA_MS,
  type MotivoSemMunicipio,
} from "../src/lib/municipioAtual";

const ler = (...p: string[]) => readFileSync(join(import.meta.dirname, "..", "src", ...p), "utf8");

test("estado por extenso vira UF por correspondência exata — Mato Grosso é MT, não MA", () => {
  assert.equal(ufDoEstado("Mato Grosso"), "MT");
  assert.equal(ufDoEstado("MATO GROSSO"), "MT");
  assert.equal(ufDoEstado("  mato   grosso "), "MT");
  assert.equal(ufDoEstado("Mato Grosso do Sul"), "MS");
  assert.equal(ufDoEstado("Maranhão"), "MA");
  assert.equal(ufDoEstado("Sao Paulo"), "SP");
  assert.equal(ufDoEstado("Estado de São Paulo"), "SP");
  assert.equal(ufDoEstado("mt"), "MT");
});

test("sem prefixo nem parcial: o que não casa é recusado", () => {
  for (const v of ["Mato", "Grosso", "Mato Gro", "XX", "", null, undefined, "Minas"]) {
    assert.equal(ufDoEstado(v as string), null, String(v));
  }
});

test("todos os 27 estados: nome e sigla resolvem para a própria UF", () => {
  assert.equal(ESTADOS_DO_BRASIL.length, 27);
  for (const [uf, nome] of ESTADOS_DO_BRASIL) {
    assert.equal(ufDoEstado(nome), uf, nome);
    assert.equal(ufDoEstado(uf.toLowerCase()), uf, uf);
  }
});

test("Água Boa–MT como o Android devolve (estado por extenso): Água Boa / MT", () => {
  const r = interpretarGeocodificacao([{ city: null, subregion: "Água Boa", region: "Mato Grosso", isoCountryCode: "BR", district: "Centro" }]);
  assert.deepEqual(r, { ok: true, municipio: { cidade: "Água Boa", uf: "MT", bairro: "Centro" } });
});

test("resultados homônimos em estados diferentes: ambíguo, nenhum é escolhido por ser o primeiro", () => {
  const r = interpretarGeocodificacao([
    { city: "Água Boa", region: "Mato Grosso", isoCountryCode: "BR" },
    { city: "Água Boa", region: "Minas Gerais", isoCountryCode: "BR" },
  ]);
  assert.deepEqual(r, { ok: false, motivo: "ambigua" });
});

test("mesmo município repetido (sigla e extenso): não é ambíguo", () => {
  const r = interpretarGeocodificacao([
    { city: "Água Boa", region: "Mato Grosso", isoCountryCode: "BR" },
    { city: "agua boa", region: "MT", isoCountryCode: "BR" },
  ]);
  assert.equal(r.ok, true);
});

test("estado não reconhecido, fora do Brasil ou sem endereço: recusa com o motivo", () => {
  assert.deepEqual(interpretarGeocodificacao([{ city: "Água Boa", region: "Mato", isoCountryCode: "BR" }]), { ok: false, motivo: "estado-nao-reconhecido" });
  assert.deepEqual(interpretarGeocodificacao([{ city: "Asunción", region: "Asunción", isoCountryCode: "PY" }]), { ok: false, motivo: "fora-do-brasil" });
  assert.deepEqual(interpretarGeocodificacao([]), { ok: false, motivo: "sem-endereco" });
  assert.deepEqual(interpretarGeocodificacao(null), { ok: false, motivo: "sem-endereco" });
});

test("posição imprecisa ou antiga é recusada antes da geocodificação", () => {
  const agora = 10_000_000;
  assert.equal(avaliarPosicao({ coords: { accuracy: 25 }, timestamp: agora - 1_000 }, agora), null);
  assert.equal(avaliarPosicao({ coords: { accuracy: 5_000 }, timestamp: agora }, agora), "imprecisa");
  assert.equal(avaliarPosicao({ coords: { accuracy: null }, timestamp: agora }, agora), "imprecisa");
  assert.equal(avaliarPosicao({ coords: { accuracy: 30 }, timestamp: agora - IDADE_MAXIMA_MS - 1 }, agora), "antiga");
});

test("resposta atrasada: só a última consulta vale e invalidar descarta a em curso", () => {
  const c = criarConsultaDescartavel();
  const primeira = c.iniciar();
  const segunda = c.iniciar();
  assert.equal(primeira(), false);
  assert.equal(segunda(), true);
  c.invalidar(); // edição do campo, fechar o formulário
  assert.equal(segunda(), false);
});

test("nenhuma mensagem de limitação anuncia sucesso", () => {
  const motivos: MotivoSemMunicipio[] = ["permissao-negada", "indisponivel", "imprecisa", "antiga", "sem-endereco", "fora-do-brasil", "estado-nao-reconhecido", "ambigua"];
  for (const m of motivos) assert.doesNotMatch(mensagemSemMunicipio(m), /carregad|sucesso|ativad/i, m);
  assert.match(mensagemSemMunicipio("permissao-negada"), /negada/);
});

test("formulários não cortam o estado e não fixam município", () => {
  for (const arquivo of [["screens", "diarista", "DiaristaPerfil.tsx"], ["hooks", "useCurrentRegion.ts"], ["hooks", "useGeoDefaults.ts"], ["screens", "montador", "MontadorPerfil.tsx"]]) {
    const fonte = ler(...arquivo);
    assert.doesNotMatch(fonte, /region[^\n]{0,60}\.slice\(0, ?2\)/, arquivo.join("/"));
    assert.doesNotMatch(fonte, /region_code/, arquivo.join("/"));
    assert.doesNotMatch(fonte, /Água Boa|"MT"/, arquivo.join("/"));
  }
});

test("'Usar localização atual' só preenche; as coordenadas vão ao servidor no 'Salvar área'", () => {
  const fonte = ler("screens", "diarista", "DiaristaPerfil.tsx");
  const inicio = fonte.indexOf("const usarLocalizacaoAtual = async");
  const fim = fonte.indexOf("const handleGeoToggle", inicio);
  const usar = fonte.slice(inicio, fim);
  assert.doesNotMatch(usar, /api\.patch/);
  assert.match(usar, /cidade,\n\s*uf,/, "cidade e UF juntas");
  const salvar = fonte.slice(fonte.indexOf("const salvarArea = async"), fonte.indexOf("const salvarArea = async") + 4000);
  assert.match(salvar, /preenchida\.cidade === cidade && preenchida\.uf === uf/);
});
