import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getAppointmentsByProfessor } from "@/lib/queries/appointments"
import { ListaArquivos, MateriaisParaAluno } from "@/components/professor/MateriaisProfessor"

type Aula = Awaited<ReturnType<typeof getAppointmentsByProfessor>>[number]

function serializar(materiais: Aula["materials"], professorId?: number) {
  return materiais.map(m => ({
    id: String(m.id), originalName: m.originalName, mimetype: m.mimetype, sizeBytes: m.sizeBytes,
    // só exclui o que ele mesmo enviou (ex.: após troca de professor, não apaga o do anterior)
    podeExcluir: professorId !== undefined && m.enviadoPorId !== null && Number(m.enviadoPorId) === professorId,
  }))
}

function CartaoAula({ apt, professorId, compacto = false }: { apt: Aula; professorId: number; compacto?: boolean }) {
  const doAluno    = serializar(apt.materials.filter(m => m.origem !== "PROFESSOR"))
  const doProfessor = serializar(apt.materials.filter(m => m.origem === "PROFESSOR"), professorId)
  return (
    <div className={compacto
      ? "bg-neutral-50 border border-neutral-200 rounded-2xl p-4"
      : "bg-white border border-neutral-200 rounded-2xl p-4 sm:p-5 shadow-card"}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className={compacto ? "text-sm font-medium text-neutral-800" : "font-semibold text-neutral-900"}>
            {apt.disciplina}{compacto && ` — ${apt.aluno.name}`}
          </p>
          {!compacto && <p className="text-sm text-neutral-500">Aluno: {apt.aluno.name}</p>}
          <p className={compacto ? "text-xs text-neutral-500" : "text-sm text-neutral-500"}>
            {new Date(apt.dataHora).toLocaleString("pt-BR", {
              dateStyle: compacto ? "short" : "long", timeStyle: "short", timeZone: "America/Sao_Paulo",
            })}
            {" · "}{apt.duracaoMinutos} min
          </p>
        </div>
        {!compacto && (apt.status === "PENDENTE" ? (
          <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full">A confirmar</span>
        ) : (
          <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">Agendado</span>
        ))}
      </div>

      {/* Materiais enviados pelo aluno */}
      {doAluno.length > 0 ? (
        <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-3 mt-2">
          <p className="text-xs font-semibold text-neutral-600 mb-2">📎 Enviados pelo aluno ({doAluno.length})</p>
          <ListaArquivos materiais={doAluno} />
        </div>
      ) : (
        <p className="text-xs text-neutral-400 mt-2 italic">Nenhum material enviado pelo aluno.</p>
      )}

      {/* Materiais do professor para o aluno */}
      <MateriaisParaAluno appointmentId={String(apt.id)} alunoNome={apt.aluno.name} enviados={doProfessor} />
    </div>
  )
}

// Server Component — dados filtrados pelo professor logado, nunca expostos a outros
export default async function ProfessorDashboard() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if ((session.user as { role?: string }).role !== "PROFESSOR") redirect("/dashboard")

  const professorId = parseInt(session.user.id!)
  const agendamentos = await getAppointmentsByProfessor(professorId)

  const agora = new Date()
  const proximas = agendamentos.filter(
    (a) => (a.status === "AGENDADO" || a.status === "PENDENTE") && new Date(a.dataHora) >= agora
  )
  // Aulas já passadas (não canceladas): o professor ainda pode baixar e enviar materiais
  const anteriores = agendamentos
    .filter(a => !proximas.includes(a) && a.status !== "CANCELADO")
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
    .slice(0, 20)

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          Olá, {session.user.name?.split(" ")[0]}! 👋
        </h1>
        <p className="text-neutral-500 mt-1">Sua agenda de aulas e materiais.</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Próximas Aulas ({proximas.length})</h2>
        {proximas.length === 0 ? (
          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-8 text-center text-neutral-500">
            <p className="text-4xl mb-3">📅</p>
            <p>Nenhuma aula agendada para os próximos dias.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {proximas.map(apt => <CartaoAula key={String(apt.id)} apt={apt} professorId={professorId} />)}
          </div>
        )}
      </section>

      {anteriores.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-1">Aulas anteriores</h2>
          <p className="text-sm text-neutral-500 mb-4">Baixe os materiais do aluno ou envie conteúdo de revisão.</p>
          <div className="space-y-3">
            {anteriores.map(apt => <CartaoAula key={String(apt.id)} apt={apt} professorId={professorId} compacto />)}
          </div>
        </section>
      )}
    </main>
  )
}
