import test from "node:test";
import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  privateDecrypt,
  randomBytes,
  constants,
  createDecipheriv,
} from "node:crypto";
import forge, { primeForgeRandomBytes } from "../src/utils/transportForge.js";
test("mobile RSA-OAEP/AES-GCM interoperates with native crypto", () => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const aes = randomBytes(32);
  primeForgeRandomBytes(randomBytes(4096).toString("binary"));
  for (const type of ["spki", "pkcs1"]) {
    const key = forge.pki.publicKeyFromPem(
      pair.publicKey.export({ format: "pem", type }),
    );
    const encrypted = key.encrypt(aes.toString("binary"), "RSA-OAEP", {
      md: forge.md.sha256.create(),
      mgf1: { md: forge.md.sha256.create() },
    });
    assert.deepEqual(
      privateDecrypt(
        {
          key: pair.privateKey,
          oaepHash: "sha256",
          padding: constants.RSA_PKCS1_OAEP_PADDING,
        },
        Buffer.from(encrypted, "binary"),
      ),
      aes,
    );
  }
  const iv = randomBytes(12);
  const aad = '{"path":"/login"}';
  const message = "验证码与中文用户";
  const cipher = forge.cipher.createCipher("AES-GCM", aes.toString("binary"));
  cipher.start({
    iv: iv.toString("binary"),
    additionalData: aad,
    tagLength: 128,
  });
  cipher.update(forge.util.createBuffer(message, "utf8"));
  assert.ok(cipher.finish());
  const decipher = createDecipheriv("aes-256-gcm", aes, iv);
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(cipher.mode.tag.getBytes(), "binary"));
  assert.equal(
    Buffer.concat([
      decipher.update(Buffer.from(cipher.output.getBytes(), "binary")),
      decipher.final(),
    ]).toString(),
    message,
  );
  assert.throws(() => forge.pki.publicKeyFromPem("not a public key"));
});
