"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { randomUUID } from "crypto"
import { fileTypeFromBuffer } from "file-type"
import { registrarAuditoria, quem, fmtDataHoraAudit } from "@/lib/audit"

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

const MAX_BYTES = 300 * 1024 * 1024 // 300 MB

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-À-ž]/g, "_").substring(0, 200)
}

function extFromName(name: string): string {
  const parts = name.split(".")
  return parts.length > 1 ? `.${parts.pop()!.toLowerCase()}` : ""
}

export async function uploadMaterial(formData: FormData) {
  const session = await auth()
  if (!session?.user) return { success: false, error: "Não autenticado" }
  if ((session.user as any).role !== "ALUNO") return { success: false, error: "Acesso negado" }

  const file = formData.get("file") as File | null
  const appointmentIdRaw = formData.get("appointmentId") as string | null

  if (!file || !appointmentIdRaw) return { success: false, error: "Arquivo e agendamento são obrigatórios" }

  let appointmentId: bigint
  try { appointmentId = BigInt(appointmentIdRaw) } catch { return { success: false, error: "Agendamento inválido" } }

  // Anti-IDOR: agendamento deve pertencer ao aluno logado
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, alunoId: BigInt(session.user.id), status: { in: ["AGENDADO", "PENDENTE"] } },
  })
  if (!appointment) return { success: false, error: "Agendamento não encontrado ou não pertence a você" }

  if (file.size > MAX_BYTES) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(0)
    return { success: false, error: `Arquivo de ${sizeMB}MB excede o limite de 300MB` }
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
  } else if (!detected && ALLOWED_EXTENSIONS.has(ext)) {
    // TXT e formatos sem magic bytes: confiar na extensão
    const clientMime = file.type
    realMime = ALLOWED[clientMime] ? clientMime : "text/plain"
  } else {
    return { success: false, error: "Tipo não permitido. Aceitos: PDF, Word (doc/docx), Excel (xls/xlsx), JPG, PNG, TXT" }
  }

  if (!ALLOWED[realMime]) {
    return { success: false, error: "Tipo não permitido. Aceitos: PDF, Word (doc/docx), Excel (xls/xlsx), JPG, PNG, TXT" }
  }

  const originalName = sanitizeFilename(file.name)
  const storedName   = `${randomUUID()}${ALLOWED[realMime]}`
  const uploadDir    = join(process.cwd(), "uploads", String(appointmentId))
  // Sempre com "/" — funciona igual no Windows (local) e no Linux (Hostinger)
  const filepath     = `${appointmentId}/${storedName}`

  try {
    await mkdir(uploadDir, { recursive: true })
    await writeFile(join(uploadDir, storedName), buffer)
  } catch {
    return { success: false, error: "Erro ao salvar o arquivo. Tente novamente." }
  }

  await prisma.material.create({
    data: {
      appointmentId,
      alunoId:      BigInt(session.user.id),
      originalName,
      storedName,
      filepath,
      mimetype:  realMime,
      sizeBytes: file.size,
    },
  })

  await registrarAuditoria(session, "MATERIAL_ENVIADO", "Material", appointmentId,
    `${quem(session)} enviou o material "${originalName}" para a aula de ${appointment.disciplina} em ${fmtDataHoraAudit(appointment.dataHora)}`)

  return { success: true, data: { originalName } }
}
