import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { AgendamentoForm } from "@/components/coordenador/AgendamentoForm"
import { AgendamentoCRUD } from "@/components/coordenador/AgendamentoCRUD"
import { parseDisponibilidade } from "@/lib/professor"

export default async function AgendamentosPage() {
  const session = await auth()
  if ((session?.user as any)?.role !== "COORDENADOR") redirect("/unauthorized")

  const [alunos, disciplinas, salas, agendamentos, coordenadores] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ALUNO", deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, responsavelNome: true, precoPresencial: true, precoVirtual: true },
    }),
    prisma.subject.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        subjectTeachers: {
          // Só professores ativos aparecem para agendamento
          where: { user: { deletedAt: null } },
          include: {
            user: {
              select: { id: true, name: true, disponibilidade: true, atendePresencial: true, atendeOnline: true },
            },
          },
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
        coordenador: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "COORDENADOR", deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])
  const coordenadoresData = coordenadores.map(c => ({ id: String(c.id), name: c.name }))
  const coordenadorPadrao = String((session?.user as any)?.id ?? "")

  const alunosData = alunos.map(a => ({
    id: String(a.id),
    name: a.name,
    email: a.email,
    responsavelNome: a.responsavelNome,
    precoPresencial: a.precoPresencial?.toString() ?? null,
    precoVirtual: a.precoVirtual?.toString() ?? null,
  }))
  const disciplinasData = disciplinas.map(d => ({
    id: d.id,
    name: d.name,
    professores: d.subjectTeachers
      .map(st => ({
        id: String(st.user.id),
        name: st.user.name,
        disponibilidade: parseDisponibilidade(st.user.disponibilidade),
        atendePresencial: st.user.atendePresencial,
        atendeOnline: st.user.atendeOnline,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }))
  const salasData = salas.map(s => ({ id: s.id, name: s.name, type: s.type }))
  // Professores ativos de cada disciplina (para a troca de professor na edição)
  const professoresPorDisciplina: Record<number, { id: string; name: string }[]> = Object.fromEntries(
    disciplinasData.map(d => [d.id, d.professores.map(p => ({ id: p.id, name: p.name }))]),
  )

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
    coordenadorId:  String(apt.coordenador.id),
    professorId:    String(apt.professorId),
    subjectId:      apt.subjectId ?? null,
    coordenador:    apt.coordenador.name,
  }))

  const totais = {
    pendentes:  agendamentosData.filter(a => a.status === "PENDENTE").length,
    agendados:  agendamentosData.filter(a => a.status === "AGENDADO").length,
    concluidos: agendamentosData.filter(a => a.status === "CONCLUIDO").length,
    cancelados: agendamentosData.filter(a => a.status === "CANCELADO").length,
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-8 sm:space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Agendamentos</h1>
        <p className="text-neutral-500 mt-1">Agende aulas e gerencie a agenda do portal.</p>
      </div>

      <AgendamentoForm alunos={alunosData} todasDisciplinas={disciplinasData} salas={salasData}
        coordenadores={coordenadoresData} coordenadorPadrao={coordenadorPadrao} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">
            Agendamentos Recentes ({agendamentosData.length})
          </h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold">{totais.pendentes} Pendentes</span>
            <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold">{totais.agendados} Agendadas</span>
            <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">{totais.concluidos} Concluídas</span>
            <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-semibold">{totais.cancelados} Canceladas</span>
          </div>
        </div>

        <AgendamentoCRUD agendamentos={agendamentosData} salas={salasData} coordenadores={coordenadoresData}
          professoresPorDisciplina={professoresPorDisciplina} />
      </section>
    </main>
  )
}
