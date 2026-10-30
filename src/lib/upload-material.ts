import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { randomUUID } from "crypto"
import { fileTypeFromBuffer } from "file-type"

/**
 * Validação e gravação de arquivos de material (usado por aluno e professor).
 * - Confere o tipo REAL pelo conteúdo (magic bytes), não só pela extensão.
 * - Grava em uploads/<idAula>/<uuid>.<ext> (fora de /public — só sai pela rota protegida).
 * - O caminho no banco usa sempre "/" (funciona no Windows e no Linux).
 */

// Tipos aceitos: PDF, Word, Excel, JPG, PNG, TXT
const ALLOWED: Record<string, string> = {
  "application/pdf":       ".pdf",
  "image/jpeg":            ".jpg",
  "image/png":             ".png",
  "text/plain":            ".txt",
  "application/msword":    ".doc",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":       ".xlsx",
}

const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".txt", ".doc", ".docx", ".xls", ".xlsx"])

export const MAX_BYTES = 300 * 1024 * 1024 // 300 MB
const MSG_TIPO = "Tipo não permitido. Aceitos: PDF, Word (doc/docx), Excel (xls/xlsx), JPG, PNG, TXT"

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-À-ž ()]/g, "_").replace(/\s+/g, " ").trim().substring(0, 200) || "arquivo"
}

function extFromName(name: string): string {
  const parts = name.split(".")
  return parts.length > 1 ? `.${parts.pop()!.toLowerCase()}` : ""
}

export type ArquivoSalvo = {
  originalName: string
  storedName: string
  filepath: string
  mimetype: string
  sizeBytes: number
}

export async function salvarArquivoMaterial(
  file: File,
  appointmentId: bigint,
): Promise<{ ok: true; arquivo: ArquivoSalvo } | { ok: false; error: string }> {
  if (!file || file.size === 0) return { ok: false, error: "Selecione um arquivo" }
  if (file.size > MAX_BYTES) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(0)
    return { ok: false, error: `Arquivo de ${sizeMB}MB excede o limite de 300MB` }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const detected = await fileTypeFromBuffer(buffer)
  const ext = extFromName(file.name)

  // Determinar MIME real por magic bytes; OOXML e TXT como fallback
  let realMime: string
  if (detected && ALLOWED[detected.mime]) {
    realMime = detected.mime
  } else if (detected?.mime === "application/zip" && (ext === ".docx" || ext === ".xlsx")) {
    realMime = ext === ".docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  } else if (detected?.mime === "application/x-cfb" && (ext === ".doc" || ext === ".xls")) {
    realMime = ext === ".doc" ? "application/msword" : "application/vnd.ms-excel"
  } else if (!detected && ALLOWED_EXTENSIONS.has(ext)) {
    // TXT e formatos sem magic bytes: confiar na extensão
    const clientMime = file.type
    realMime = ALLOWED[clientMime] ? clientMime : "text/plain"
  } else {
    return { ok: false, error: MSG_TIPO }
  }
  if (!ALLOWED[realMime]) return { ok: false, error: MSG_TIPO }

  const originalName = sanitizeFilename(file.name)
  const storedName   = `${randomUUID()}${ALLOWED[realMime]}`
  const uploadDir    = join(process.cwd(), "uploads", String(appointmentId))
  // Sempre com "/" — funciona igual no Windows (local) e no Linux (Hostinger)
  const filepath     = `${appointmentId}/${storedName}`

  try {
    await mkdir(uploadDir, { recursive: true })
    await writeFile(join(uploadDir, storedName), buffer)
  } catch {
    return { ok: false, error: "Erro ao salvar o arquivo. Tente novamente." }
  }

  return { ok: true, arquivo: { originalName, storedName, filepath, mimetype: realMime, sizeBytes: file.size } }
}
