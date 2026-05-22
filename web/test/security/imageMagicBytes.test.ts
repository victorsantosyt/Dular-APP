import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectImageMime, extensionForMime } from "../../src/lib/imageMagicBytes";

const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);

describe("detectImageMime", () => {
  it("identifica JPEG real (FF D8 FF)", () => {
    assert.equal(detectImageMime(JPEG_HEADER), "image/jpeg");
  });

  it("identifica PNG real (89 50 4E 47 0D 0A 1A 0A)", () => {
    assert.equal(detectImageMime(PNG_HEADER), "image/png");
  });

  it("rejeita buffer aleatório", () => {
    const garbage = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
    assert.equal(detectImageMime(garbage), null);
  });

  it("rejeita buffer vazio", () => {
    assert.equal(detectImageMime(Buffer.alloc(0)), null);
  });

  it("rejeita buffer JPEG truncado (apenas 2 bytes)", () => {
    assert.equal(detectImageMime(Buffer.from([0xff, 0xd8])), null);
  });

  it("rejeita buffer PNG truncado (4 bytes)", () => {
    assert.equal(detectImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47])), null);
  });

  it("rejeita arquivo de texto disfarçado de JPG", () => {
    const text = Buffer.from("Esse arquivo é um TXT renomeado para .jpg");
    assert.equal(detectImageMime(text), null);
  });

  it("rejeita GIF (não é nem JPEG nem PNG)", () => {
    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    assert.equal(detectImageMime(gif), null);
  });

  it("rejeita PDF disfarçado", () => {
    const pdf = Buffer.from("%PDF-1.4\n");
    assert.equal(detectImageMime(pdf), null);
  });

  it("PNG com signature parcial (faltando último byte) é rejeitado", () => {
    const fake = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x00]);
    assert.equal(detectImageMime(fake), null);
  });
});

describe("extensionForMime", () => {
  it("retorna .jpg para image/jpeg", () => {
    assert.equal(extensionForMime("image/jpeg"), ".jpg");
  });

  it("retorna .png para image/png", () => {
    assert.equal(extensionForMime("image/png"), ".png");
  });
});
