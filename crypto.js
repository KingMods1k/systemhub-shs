// crypto.js — criptografia do fluxo de documentos do RH.
//
// AES-256-GCM para o conteúdo (cifra autenticada — detecta adulteração).
// RSA-OAEP (2048 bits) como "envelope": cifra só a chave AES, não o arquivo inteiro.
// RSA-PSS + SHA-256 para assinatura (garante integridade a partir do momento
// em que o servidor processa o documento).

const crypto = require('crypto');

const AES_ALGO = 'aes-256-gcm';
const AES_KEY_BYTES = 32; // 256 bits
const IV_BYTES = 12;      // tamanho de nonce recomendado para GCM

// ---------------------------------------------------------------------------
// Chaves permanentes do servidor (RSA_public / RSA_private no .env)
// ---------------------------------------------------------------------------
// Tolerante ao formato: aceita tanto o PEM colado direto (com "\n" reais ou
// escapados) quanto o PEM em Base64 numa linha só.
function loadEnvKey(varName) {
  const raw = process.env[varName];
  if (!raw) {
    throw new Error(`Variavel de ambiente ${varName} nao definida.`);
  }
  const value = raw.trim();
  if (value.includes('-----BEGIN')) {
    return value.replace(/\\n/g, '\n');
  }
  const decoded = Buffer.from(value, 'base64').toString('utf8');
  if (!decoded.includes('-----BEGIN')) {
    throw new Error(`Nao foi possivel interpretar ${varName} como chave RSA (PEM ou Base64 de PEM).`);
  }
  return decoded;
}

let serverPublicKey = null;
let serverPrivateKey = null;

function getServerPublicKey() {
  if (!serverPublicKey) serverPublicKey = loadEnvKey('RSA_public');
  return serverPublicKey;
}

function getServerPrivateKey() {
  if (!serverPrivateKey) serverPrivateKey = loadEnvKey('RSA_private');
  return serverPrivateKey;
}

// ---------------------------------------------------------------------------
// AES-256-GCM
// ---------------------------------------------------------------------------
function generateAesKey() {
  return crypto.randomBytes(AES_KEY_BYTES);
}

function aesEncrypt(plaintextBuffer, keyBuffer) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(AES_ALGO, keyBuffer, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

function aesDecrypt(ciphertextBuffer, keyBuffer, ivBuffer, authTagBuffer) {
  const decipher = crypto.createDecipheriv(AES_ALGO, keyBuffer, ivBuffer);
  decipher.setAuthTag(authTagBuffer);
  return Buffer.concat([decipher.update(ciphertextBuffer), decipher.final()]);
}

// ---------------------------------------------------------------------------
// RSA-OAEP — envelope da chave AES
// ---------------------------------------------------------------------------
function rsaEncrypt(dataBuffer, publicKeyPem) {
  return crypto.publicEncrypt(
    { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    dataBuffer
  );
}

function rsaDecrypt(encryptedBuffer, privateKeyPem) {
  return crypto.privateDecrypt(
    { key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    encryptedBuffer
  );
}

// ---------------------------------------------------------------------------
// Assinatura — RSA-PSS + SHA-256
// ---------------------------------------------------------------------------
function sign(dataBuffer, privateKeyPem) {
  return crypto.sign('sha256', dataBuffer, {
    key: privateKeyPem,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  });
}

function verify(dataBuffer, signatureBuffer, publicKeyPem) {
  return crypto.verify(
    'sha256',
    dataBuffer,
    { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PSS_PADDING },
    signatureBuffer
  );
}

// ---------------------------------------------------------------------------
// Chaves RSA temporárias (efêmeras, só em RAM)
// ---------------------------------------------------------------------------
// Usadas pra trocar a chave AES com o app sem depender só do TLS: o server
// gera um par, entrega a pública, e a privada nunca sai da memória do processo.
// Cada chave é de uso único (consumida e apagada assim que usada) e expira
// sozinha se ninguém usar.
const TEMP_KEY_TTL_MS = 5 * 60 * 1000; // 5 minutos
const tempKeys = new Map(); // keyId -> { privateKey, expiresAt }

function generateTempKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const keyId = crypto.randomUUID();
  tempKeys.set(keyId, { privateKey, expiresAt: Date.now() + TEMP_KEY_TTL_MS });
  return { keyId, publicKey };
}

// Consome (usa e apaga) uma chave temporária. Retorna null se não existir ou tiver expirado.
function consumeTempPrivateKey(keyId) {
  const entry = tempKeys.get(keyId);
  tempKeys.delete(keyId); // uso único — apaga mesmo se já estiver expirada/inválida
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry.privateKey;
}

// Limpeza periódica de chaves que expiraram sem nunca terem sido usadas
setInterval(() => {
  const now = Date.now();
  for (const [keyId, entry] of tempKeys) {
    if (now > entry.expiresAt) tempKeys.delete(keyId);
  }
}, 60 * 1000).unref();

module.exports = {
  generateAesKey,
  aesEncrypt,
  aesDecrypt,
  rsaEncrypt,
  rsaDecrypt,
  sign,
  verify,
  getServerPublicKey,
  getServerPrivateKey,
  generateTempKeyPair,
  consumeTempPrivateKey,
};
