"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { salvarArquivoMaterial } from "@/lib/upload-material"
import { registrarAuditoria, quem, fmtDataHoraAudit } from "@/lib/audit"

/** Aluno envia material para o professor da aula. */
export async function uploadMaterial(formData: FormData) {
  const session = await auth()
  if (!session?.user) return { success: false, error: "Não autenticado" }
  if ((session.user as { role?: string }).role !== "ALUNO") return { success: false, error: "Acesso negado" }

  const file = formData.get("file") as File | null
  const appointmentIdRaw = formData.get("appointmentId") as string | null
  if (!file || !appointmentIdRaw) return { success: false, error: "Arquivo e agendamento são obrigatórios" }

  let appointmentId: bigint
  try { appointmentId = BigInt(appointmentIdRaw) } catch { return { success: false, error: "Agendamento inválido" } }

  const alunoId = BigInt(session.user.id!)
  // Anti-IDOR: agendamento deve pertencer ao aluno logado
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, alunoId, status: { in: ["AGENDADO", "PENDENTE"] } },
  })
  if (!appointment) return { success: false, error: "Agendamento não encontrado ou não pertence a você" }

  const res = await salvarArquivoMaterial(file, appointmentId)
  if (!res.ok) return { success: false, error: res.error }

  await prisma.material.create({
    data: { appointmentId, alunoId, ...res.arquivo, origem: "ALUNO", enviadoPorId: alunoId },
  })

  await registrarAuditoria(session, "MATERIAL_ENVIADO", "Material", appointmentId,
    `${quem(session)} enviou o material "${res.arquivo.originalName}" para a aula de ${appointment.disciplina} em ${fmtDataHoraAudit(appointment.dataHora)}`)

  revalidatePath("/aluno/materiais")
  revalidatePath("/professor")
  return { success: true, data: { originalName: res.arquivo.originalName } }
}
