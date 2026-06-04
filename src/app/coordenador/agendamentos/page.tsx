import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { AgendamentoForm } from "@/components/coordenador/AgendamentoForm"
import { AgendamentoCRUD } from "@/components/coordenador/AgendamentoCRUD"

export default async function AgendamentosPage() {
  const session = await auth()
  if ((session?.user as any)?.role !== "COORDENADOR") redirect("/unauthorized")

  const [alunos, disciplinas, salas, agendamentos] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ALUNO", deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.subject.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        subjectTeachers: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.room.findMany({
      where: { deletedAt: null, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
    prisma.appointment.findMany({
      orderBy: { dataHora: "desc" },
      take: 100,
      include: {
        aluno:     { select: { name: true } },
        professor: { select: { name: true } },
        room:      { select: { id: true, name: true, type: true } },
        subject:   { select: { name: true } },
      },
    }),
  ])

  const alunosData = alunos.map(a => ({ id: String(a.id), name: a.name }))
  const disciplinasData = disciplinas.map(d => ({
    id: d.id,
    name: d.name,
    professores: d.subjectTeachers.map(st => ({ id: String(st.user.id), name: st.user.name })),
  }))
  const salasData = salas.map(s => ({ id: s.id, name: s.name, type: s.type }))

  const agendamentosData = agendamentos.map(apt => ({
    id: String(apt.id),
    disciplina:     apt.subject?.name ?? apt.disciplina,
    aluno:          apt.aluno.name,
    professor:      apt.professor.name,
    dataHora:       apt.dataHora.toISOString(),
    duracaoMinutos: apt.duracaoMinutos,
    status:         apt.status,
    sala:           apt.room?.name ?? null,
    salaTipo:       apt.room?.type ?? null,
    salaId:         apt.room?.id ?? null,
    observacoes:    apt.observacoes ?? null,
    valorCobrado:   apt.valorCobrado?.toString() ?? null,
  }))

  const totais = {
    agendados:  agendamentosData.filter(a => a.status === "AGENDADO").length,
    concluidos: agendamentosData.filter(a => a.status === "CONCLUIDO").length,
    cancelados: agendamentosData.filter(a => a.status === "CANCELADO").length,
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Agendamentos</h1>
        <p className="text-neutral-500 mt-1">Agende aulas e gerencie a agenda do portal.</p>
      </div>

      <AgendamentoForm alunos={alunosData} todasDisciplinas={disciplinasData} salas={salasData} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">
            Agendamentos Recentes ({agendamentosData.length})
          </h2>
          <div className="flex gap-2 text-xs">
            <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold">{totais.agendados} Agendadas</span>
            <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">{totais.concluidos} Concluídas</span>
            <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-semibold">{totais.cancelados} Canceladas</span>
          </div>
        </div>

        <AgendamentoCRUD agendamentos={agendamentosData} salas={salasData} />
      </section>
    </main>
  )
}
