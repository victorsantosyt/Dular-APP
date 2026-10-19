import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nomeCompletoValido } from "../src/utils/formatters";

const tela = readFileSync(join(import.meta.dirname, "..", "src", "screens", "perfil", "VerificacaoDocs.tsx"), "utf8");

test("nome completo: mesma regra do servidor", () => {
  assert.equal(nomeCompletoValido("Maria"), false, "só um nome");
  assert.equal(nomeCompletoValido("Maria 123"), false, "com números");
  assert.equal(nomeCompletoValido("  Maria   da  Silva "), true);
  assert.equal(nomeCompletoValido("José D'Ávila"), true);
  assert.equal(nomeCompletoValido("A B"), false, "partes curtas");
});

test("verificação: pede só o nome completo que falta e grava antes dos arquivos", () => {
  assert.match(tela, /const faltaNomeCompleto = !currentUser\?\.nomeCompleto;/);
  const envio = tela.slice(tela.indexOf("const enviar = async"));
  assert.ok(envio.indexOf("atualizarDadosPessoais({ nomeCompleto") < envio.indexOf('api.post("/api/verificacoes"'), "nome antes do upload");
});

test("verificação: motivo da reprovação ou do reenvio aparece na tela", () => {
  assert.match(tela, /setMotivo\(me\.motivoVerificacao \?\? null\)/);
  assert.match(tela, /Motivo: \{motivo\}/);
  assert.match(tela, /Precisamos de um novo envio/);
});

test("selfie: só pela câmera frontal, com orientação, refazer e envio junto dos documentos", () => {
  const selfie = tela.slice(tela.indexOf("const tirarSelfie"), tela.indexOf("const pickFromGallery"));
  assert.match(selfie, /launchCameraAsync\(/);
  assert.match(selfie, /CameraType\.front/);
  assert.doesNotMatch(selfie, /launchImageLibraryAsync|DocumentPicker/, "nunca da galeria nem de arquivos");
  assert.match(selfie, /Linking\.openSettings\(\)/, "permissão negada tem caminho de saída");
  assert.match(tela, /Em lugar iluminado, com o rosto inteiro visível e a imagem nítida\. Sem filtros, sem óculos escuros e sem outras pessoas na foto\./);
  assert.match(tela, /Refazer selfie/);
  assert.match(tela, /form\.append\("selfie", selfie as any\)/);
  const envio = tela.slice(tela.indexOf("const enviar = async"));
  assert.ok(envio.indexOf("if (!selfie)") < envio.indexOf('api.post("/api/verificacoes"'), "sem selfie não envia");
});

test("selfie: finalidade, acesso e retenção explicados; nunca chamada de prova de vida na tela", () => {
  assert.match(tela, /Para que serve: .*Quem vê: .*Por quanto tempo: /);
  assert.match(tela, /Não usamos reconhecimento facial automático/);
  const semComentarios = tela.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(semComentarios, /prova de vida/i);
});
