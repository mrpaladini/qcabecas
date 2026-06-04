import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { CalendarioAulas } from "@/components/coordenador/CalendarioAulas"

export default async function CalendarioPage() {
  const session = await auth()
  if ((session?.user as any)?.role !== "COORDENADOR") redirect("/unauthorized")

  const [agendamentos, salas] = await Promise.all([
    prisma.appointment.findMany({
      where: { status: { not: "CANCELADO" } },
      orderBy: { dataHora: "asc" },
      include: {
        aluno: { select: { name: true } },
        professor: { select: { name: true } },
        room: { select: { id: true, name: true, type: true } },
      },
    }),
    prisma.room.findMany({
      where: { deletedAt: null, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
  ])

  const eventos = agendamentos.map(a => ({
    id: String(a.id),
    title: `${a.disciplina} — ${a.aluno.name}`,
    start: new Date(a.dataHora),
    end: new Date(new Date(a.dataHora).getTime() + a.duracaoMinutos * 60000),
    status: a.status,
    aluno: a.aluno.name,
    professor: a.professor.name,
    salaId: a.roomId ?? null,
    sala: a.room?.name ?? null,
    salaTipo: a.room?.type ?? null,
  }))

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Calendário de Aulas</h1>
        <p className="text-neutral-500 mt-1">Visualize e filtre os agendamentos por sala de aula.</p>
      </div>
      <CalendarioAulas eventos={eventos} salas={salas} />
    </main>
  )
}
