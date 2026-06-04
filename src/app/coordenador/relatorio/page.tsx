import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { RelatorioCliente } from "./RelatorioCliente"

export default async function RelatorioPage() {
  const session = await auth()
  if ((session?.user as any)?.role !== "COORDENADOR") redirect("/unauthorized")

  const agendamentos = await prisma.appointment.findMany({
    orderBy: { dataHora: "asc" },
    include: {
      aluno:      { select: { name: true, email: true } },
      professor:  { select: { name: true } },
      room:       { select: { name: true, type: true } },
      subject:    { select: { name: true } },
    },
  })

  const data = agendamentos.map(a => ({
    id: String(a.id),
    dataHora: a.dataHora.toISOString(),
    duracaoMinutos: a.duracaoMinutos,
    disciplina: a.subject?.name ?? a.disciplina,
    status: a.status,
    aluno: a.aluno.name,
    alunoEmail: a.aluno.email,
    professor: a.professor.name,
    sala: a.room?.name ?? null,
    salaTipo: a.room?.type ?? null,
    observacoes: a.observacoes ?? null,
  }))

  return <RelatorioCliente agendamentos={data} geradoEm={new Date().toISOString()} />
}
