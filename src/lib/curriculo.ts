import { writeFile, mkdir, unlink } from "fs/promises"
import { join, resolve, sep } from "path"
import { randomUUID } from "crypto"
import { fileTypeFromBuffer } from "file-type"
import { CURRICULO_MAX_BYTES } from "@/lib/professor"

/**
 * Currículo do professor.
 * - Aceita PDF, Word (doc/docx), JPG e PNG, até 10 MB.
 * - Confere o tipo REAL pelo conteúdo (magic bytes), não só pela extensão.
 * - Grava em uploads/curriculos/<idProfessor>/<uuid>.<ext> (fora de /public:
 *   só sai pela rota /api/curriculos, que exige login de coordenador).
 */

const TIPOS: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg":      ".jpg",
  "image/png":       ".png",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}

const MSG_TIPO = "Currículo: envie um arquivo PDF, Word (doc/docx), JPG ou PNG"

export type CurriculoPreparado = {
  buffer: Buffer
  originalName: string
  ext: string
  mime: string
  size: number
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-À-ž ()]/g, "_").replace(/\s+/g, " ").trim().substring(0, 200) || "curriculo"
}

function extFromName(name: string): string {
  const parts = name.split(".")
  return parts.length > 1 ? `.${parts.pop()!.toLowerCase()}` : ""
}

/** Lê o campo "curriculo" do FormData. Sem arquivo → null (nada a fazer). */
export function arquivoDoForm(formData: FormData): File | null {
  const f = formData.get("curriculo")
  return f && typeof f === "object" && "size" in f && (f as File).size > 0 ? (f as File) : null
}

/** Valida o arquivo antes de gravar qualquer coisa no banco. */
export async function prepararCurriculo(file: File): Promise<{ ok: true; arq: CurriculoPreparado } | { ok: false; error: string }> {
  if (file.size > CURRICULO_MAX_BYTES) {
    return { ok: false, error: `Currículo: arquivo de ${(file.size / 1024 / 1024).toFixed(1)}MB excede o limite de 10MB` }
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  const detected = await fileTypeFromBuffer(buffer)
  const ext = extFromName(file.name)

  let mime: string | null = null
  if (detected && TIPOS[detected.mime]) mime = detected.mime
  else if (detected?.mime === "application/zip" && ext === ".docx") mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  else if (detected?.mime === "application/x-cfb" && ext === ".doc") mime = "application/msword"
  if (!mime) return { ok: false, error: MSG_TIPO }

  return { ok: true, arq: { buffer, originalName: sanitizeFilename(file.name), ext: TIPOS[mime], mime, size: file.size } }
}

function baseUploads() {
  return resolve(process.cwd(), "uploads")
}

/** Grava o arquivo e devolve os campos a salvar no usuário. */
export async function gravarCurriculo(professorId: bigint, arq: CurriculoPreparado) {
  const storedName = `${randomUUID()}${arq.ext}`
  const dir = join(baseUploads(), "curriculos", String(professorId))
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, storedName), arq.buffer)
  return {
    curriculoNome:      arq.originalName,
    // Sempre com "/" — funciona igual no Windows (local) e no Linux (Hostinger)
    curriculoArquivo:   `curriculos/${professorId}/${storedName}`,
    curriculoMime:      arq.mime,
    curriculoTamanho:   arq.size,
    curriculoEnviadoEm: new Date(),
  }
}

export const CURRICULO_VAZIO = {
  curriculoNome: null, curriculoArquivo: null, curriculoMime: null, curriculoTamanho: null, curriculoEnviadoEm: null,
}

/** Caminho absoluto seguro (impede path traversal) — ou null se inválido. */
export function caminhoCurriculo(relativo: string): string | null {
  const base = baseUploads()
  const partes = relativo.split(/[\\/]+/).filter(s => s && s !== "." && s !== "..")
  const abs = resolve(base, ...partes)
  return abs.startsWith(base + sep) ? abs : null
}

/** Remove o arquivo antigo (não falha se já não existir). */
export async function apagarArquivoCurriculo(relativo: string | null | undefined) {
  if (!relativo) return
  const abs = caminhoCurriculo(relativo)
  if (abs) await unlink(abs).catch(() => {})
}
