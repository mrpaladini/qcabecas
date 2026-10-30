import { prisma } from "@/lib/db"

// Busca aulas de um aluno específico — sempre filtrado por alunoId para evitar IDOR
export async function getAppointmentsByAluno(alunoId: number) {
  return prisma.appointment.findMany({
    where: {
      alunoId,
      deletedAt: undefined, // appointments não têm deletedAt, usam cancelledAt
    },
    orderBy: { dataHora: "asc" },
    include: {
      professor: { select: { id: true, name: true, email: true } },
      materials: {
        select: { id: true, originalName: true, mimetype: true, sizeBytes: true, createdAt: true },
      },
    },
  })
}

// Busca aulas de um professor específico — sempre filtrado por professorId para evitar IDOR
export async function getAppointmentsByProfessor(professorId: number) {
  return prisma.appointment.findMany({
    where: { professorId },
    orderBy: { dataHora: "asc" },
    include: {
      aluno: { select: { id: true, name: true, email: true } },
      materials: {
        select: {
          id: true,
          originalName: true,
          mimetype: true,
          sizeBytes: true,
          createdAt: true,
          alunoId: true,
          origem: true,
          enviadoPorId: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })
}

// Visão completa para o coordenador — sem restrição de perfil
export async function getAllAppointments(page = 1, pageSize = 50) {
  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      orderBy: { dataHora: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        aluno: { select: { id: true, name: true, email: true } },
        professor: { select: { id: true, name: true, email: true } },
        _count: { select: { materials: true } },
      },
    }),
    prisma.appointment.count(),
  ])

  return { appointments, total, page, pageSize }
}

// Busca agendamentos futuros (status AGENDADO, data >= hoje)
export async function getUpcomingAppointmentsByAluno(alunoId: number) {
  return prisma.appointment.findMany({
    where: {
      alunoId,
      status: { in: ["AGENDADO", "PENDENTE"] },
      dataHora: { gte: new Date() },
    },
    orderBy: { dataHora: "asc" },
    include: {
      professor: { select: { name: true } },
    },
  })
}

// Lista de alunos e professores para o formulário de agendamento do coordenador
export async function getUsersByRole(role: "ALUNO" | "PROFESSOR") {
  return prisma.user.findMany({
    where: { role, deletedAt: null },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  })
}
