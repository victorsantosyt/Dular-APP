import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { modoEndereco } from "../src/screens/empregador/service-flow/enderecoModo";

const FLUXO = join(import.meta.dirname, "..", "src", "screens", "empregador", "service-flow");
const telas = readdirSync(FLUXO).filter((n) => n.endsWith("Screen.tsx"));

/**
 * O `SafeAreaView` do react-native só age no iOS. No Android edge-to-edge o
 * voltar e as barras de progresso do fluxo ficavam sob a barra de status e o
 * recorte da câmera. Toda etapa usa o `FlowScreen`, que aplica o inset real.
 */
test("toda etapa do fluxo usa FlowScreen, não o SafeAreaView do react-native", () => {
  assert.ok(telas.length >= 7, `achei só ${telas.length} telas`);
  for (const nome of telas) {
    const codigo = readFileSync(join(FLUXO, nome), "utf8");
    assert.ok(!/<SafeAreaView\b/.test(codigo), `${nome} ainda usa SafeAreaView direto`);
    assert.ok(codigo.includes("<FlowScreen>"), `${nome} não usa FlowScreen`);
  }
});

test("FlowScreen reserva o topo e deixa a base para o FlowFooter", () => {
  const codigo = readFileSync(join(FLUXO, "components.tsx"), "utf8");
  assert.match(codigo, /import \{ SafeAreaView, useSafeAreaInsets \} from "react-native-safe-area-context"/);
  assert.match(codigo, /edges=\{\["top", "left", "right"\]\}/);
  // A base já é somada pelo FlowFooter: incluir "bottom" dobraria o espaço.
  assert.match(codigo, /paddingBottom: spacing\.xl \+ insets\.bottom/);
});

test("endereço: com cadastrados só lista, sem cadastro cai no formulário", () => {
  assert.equal(modoEndereco(null, false), "carregando");
  assert.equal(modoEndereco([{ id: "a" }], false), "cadastrados");
  assert.equal(modoEndereco([{ id: "a" }, { id: "b" }], false), "cadastrados");
  assert.equal(modoEndereco([], false), "formulario");
  assert.equal(modoEndereco(null, true), "formulario");
});
