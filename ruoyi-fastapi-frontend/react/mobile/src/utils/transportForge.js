import forge from "node-forge/lib/forge.js";
import "node-forge/lib/util.js";
import "node-forge/lib/asn1.js";
import "node-forge/lib/oids.js";
import "node-forge/lib/cipher.js";
import "node-forge/lib/cipherModes.js";
import "node-forge/lib/aes.js";
import "node-forge/lib/jsbn.js";
import "node-forge/lib/pkcs1.js";
import "node-forge/lib/prime.js";
import "node-forge/lib/random.js";
import "node-forge/lib/md.js";
import "node-forge/lib/sha256.js";
import "node-forge/lib/mgf1.js";
import "node-forge/lib/pem.js";
import "node-forge/lib/rsa.js";

// The transport uses only an RSA public key; avoid bundling certificate,
// private-key, PKCS#12 and password-encryption modules from forge/lib/pki.
forge.pki.publicKeyFromPem = (pem) => {
  const message = forge.pem.decode(pem)[0];
  if (!message || !["PUBLIC KEY", "RSA PUBLIC KEY"].includes(message.type))
    throw new Error("无效的 RSA 公钥");
  if (message.procType?.type === "ENCRYPTED")
    throw new Error("不支持加密的公钥");
  return forge.pki.publicKeyFromAsn1(forge.asn1.fromDer(message.body));
};
let randomBytePool = "";
const toBytes = (bytes) =>
  Array.from(bytes, (value) => String.fromCharCode(value)).join("");
function consumeRandomBytes(length) {
  if (randomBytePool.length < length && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(Math.max(length, 4096));
    globalThis.crypto.getRandomValues(bytes);
    randomBytePool += toBytes(bytes);
  }
  if (randomBytePool.length < length)
    throw new Error("传输加密随机数池不足，当前运行环境无法补充安全随机数");
  const result = randomBytePool.slice(0, length);
  randomBytePool = randomBytePool.slice(length);
  return result;
}
forge.random.getBytesSync = consumeRandomBytes;
forge.random.getBytes = (length, callback) => {
  const bytes = consumeRandomBytes(length);
  if (callback) callback(null, bytes);
  return bytes;
};
export function primeForgeRandomBytes(bytes) {
  randomBytePool = (randomBytePool + String(bytes || "")).slice(-16384);
}
export default forge;
