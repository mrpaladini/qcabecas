"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { unlink } from "fs/promises"
import { resolve, sep } from "path"
import { resend, FROM_EMAIL } from "@/lib/resend"
import { salvarArquivoMaterial } from "@/lib/upload-material"
import { registrarAuditoria, quem, primeiroNome, fmtDataHoraAudit } from "@/lib/audit"

function professorDaSessao(session: { user?: unknown } | null) {
  const u = session?.user as { id?: string; role?: string } | undefined
  if (!u?.id || u.role !== "PROFESSOR") return null
  return BigInt(u.id)
}

/**
 * Professor envia material de estudo para o aluno de uma aula sua.
 * O arquivo fica visível só para esse aluno (em "Materiais do professor"),
 * para o próprio professor e para a coordenação.
 */
export async function enviarMaterialProfessor(formData: FormData) {
  const session = await auth()
  const professorId = professorDaSessao(session)
  if (!professorId) return { success: false as const, error: "Acesso negado" }

  const file = formData.get("file") as File | null
  const appointmentIdRaw = formData.get("appointmentId") as string | null
  if (!file || !appointmentIdRaw) return { success: false as const, error: "Selecione o arquivo" }

  let appointmentId: bigint
  try { appointmentId = BigInt(appointmentIdRaw) } catch { return { success: false as const, error: "Aula inválida" } }

  // Anti-IDOR: a aula precisa ser deste professor (e não cancelada)
  const apt = await prisma.appointment.findFirst({
    where: { id: appointmentId, professorId, status: { not: "CANCELADO" } },
    include: {
      aluno:     { select: { id: true, name: true, email: true } },
      professor: { select: { name: true } },
    },
  })
  if (!apt) return { success: false as const, error: "Aula não encontrada" }

  const res = await salvarArquivoMaterial(file, appointmentId)
  if (!res.ok) return { success: false as const, error: res.error }

  await prisma.material.create({
    data: {
      appointmentId,
      alunoId:      apt.aluno.id,   // aluno destinatário
      ...res.arquivo,
      origem:       "PROFESSOR",
      enviadoPorId: professorId,
    },
  })

  await registrarAuditoria(session, "MATERIAL_ENVIADO", "Material", appointmentId,
    `${quem(session)} enviou o material "${res.arquivo.originalName}" para o aluno ${primeiroNome(apt.aluno.name)} ` +
    `(aula de ${apt.disciplina} em ${fmtDataHoraAudit(apt.dataHora)})`)

  // Aviso por e-mail ao aluno (falha no envio não impede o upload)
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: apt.aluno.email,
      subject: `📚 Novo material de ${apt.disciplina}`,
      html: `<p>Olá <strong>${apt.aluno.name}</strong>,<br>O Prof. ${apt.professor.name} enviou o material ` +
        `<strong>${res.arquivo.originalName}</strong> para a aula de <strong>${apt.disciplina}</strong>.<br>` +
        `Acesse o portal em <em>Materiais do professor</em> para baixar.</p>`,
    })
  } catch (e) {
    console.error("[materiais] falha ao avisar aluno por e-mail:", e)
  }

  revalidatePath("/professor")
  revalidatePath("/aluno")
  revalidatePath("/aluno/materiais-professor")
  return { success: true as const, data: { originalName: res.arquivo.originalName } }
}

/** Professor remove um material que ELE enviou (arquivos do aluno não podem ser removidos por aqui). */
export async function excluirMaterialProfessor(materialId: string) {
  const session = await auth()
  const professorId = professorDaSessao(session)
  if (!professorId) return { success: false as const, error: "Acesso negado" }

  let id: bigint
  try { id = BigInt(materialId) } catch { return { success: false as const, error: "Material inválido" } }

  const m = await prisma.material.findFirst({
    where: { id, origem: "PROFESSOR", enviadoPorId: professorId, appointment: { professorId } },
    include: { aluno: { select: { name: true } }, appointment: { select: { disciplina: true, dataHora: true } } },
  })
  if (!m) return { success: false as const, error: "Material não encontrado" }

  await prisma.material.delete({ where: { id } })

  // Remove o arquivo do disco (se não existir mais, segue normalmente)
  const base = resolve(process.cwd(), "uploads")
  const caminho = resolve(base, ...m.filepath.split(/[\\/]+/).filter(p => p && p !== "." && p !== ".."))
  if (caminho.startsWith(base + sep)) await unlink(caminho).catch(() => {})

  await registrarAuditoria(session, "MATERIAL_EXCLUIDO", "Material", id,
    `${quem(session)} excluiu o material "${m.originalName}" enviado ao aluno ${primeiroNome(m.aluno.name)} ` +
    `(aula de ${m.appointment.disciplina} em ${fmtDataHoraAudit(m.appointment.dataHora)})`)

  revalidatePath("/professor")
  revalidatePath("/aluno/materiais-professor")
  return { success: true as const }
}
