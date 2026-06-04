import { prisma } from "@/lib/db"

// Busca materiais de um agendamento — sempre filtrado por alunoId para evitar IDOR
// Professor usa version sem filtro de alunoId (ver abaixo)
export async function getMaterialsByAppointment(
  appointmentId: number,
  alunoId: number
) {
  return prisma.material.findMany({
    where: { appointmentId, alunoId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalName: true,
      mimetype: true,
      sizeBytes: true,
      createdAt: true,
    },
  })
}

// Versão para professor — pode ver todos os materiais do agendamento (sem filtro de aluno)
export async function getMaterialsByAppointmentForProfessor(
  appointmentId: number,
  professorId: number
) {
  // Verificar que o agendamento pertence ao professor antes de retornar materiais
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, professorId },
  })

  if (!appointment) return []

  return prisma.material.findMany({
    where: { appointmentId },
    orderBy: { createdAt: "desc" },
    include: {
      aluno: { select: { name: true } },
    },
  })
}
