import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { ConferenciaRelatorio } from "../ConferenciaRelatorio"

export default async function ConferenciaProfessorPage() {
  const session = await auth()
  if ((session?.user as any)?.role !== "COORDENADOR") redirect("/unauthorized")

  // Mesma base de Contas a Pagar: evidências de aulas concluídas
  const [professores, evidencias] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PROFESSOR" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.evidencia.findMany({
      where: { status: "CONCLUIDO" },
      orderBy: { dataAula: "asc" },
      select: {
        id: true, dataAula: true, duracaoMinutos: true, disciplina: true,
        valorProfessor: true, pagoProfessor: true,
        appointment: { select: { professorId: true } },
      },
    }),
  ])

  const linhas = evidencias.map(e => ({
    id:             String(e.id),
    pessoaId:       String(e.appointment.professorId),
    dataHora:       e.dataAula.toISOString(),
    duracaoMinutos: e.duracaoMinutos,
    disciplina:     e.disciplina,
    valor:          Number(e.valorProfessor),
    pago:           e.pagoProfessor,
  }))

  return (
    <ConferenciaRelatorio
      tipo="professor"
      pessoas={professores.map(p => ({ id: String(p.id), name: p.name }))}
      linhas={linhas}
      geradoEm={new Date().toISOString()}
    />
  )
}
