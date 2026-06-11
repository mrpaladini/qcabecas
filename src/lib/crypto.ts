import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALG = "aes-256-gcm"

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET não definida")
  // Deriva 32 bytes a partir de qualquer comprimento de segredo
  return Buffer.from(secret.padEnd(32, "0").slice(0, 32), "utf8")
}

export function encryptTemp(plain: string): string {
  const key = getKey()
  const iv  = randomBytes(12)
  const cipher = createCipheriv(ALG, key, iv)
  const enc  = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag  = cipher.getAuthTag()
  // Formato: iv(12) + tag(16) + ciphertext → base64
  return Buffer.concat([iv, tag, enc]).toString("base64")
}

export function decryptTemp(encoded: string): string {
  try {
    const key = getKey()
    const buf  = Buffer.from(encoded, "base64")
    const iv   = buf.subarray(0, 12)
    const tag  = buf.subarray(12, 28)
    const enc  = buf.subarray(28)
    const decipher = createDecipheriv(ALG, key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(enc) + decipher.final("utf8")
  } catch {
    return ""
  }
}
