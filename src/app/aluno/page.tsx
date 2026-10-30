import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"

export default async function AlunoDashboard() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if ((session.user as any).role !== "ALUNO") redirect("/unauthorized")

  const alunoId = BigInt(session.user.id)

  const agendamentos = await prisma.appointment.findMany({
    where: { alunoId },
    orderBy: { dataHora: "asc" },
    include: {
      professor: { select: { name: true } },
      subject:   { select: { name: true } },
      room:      { select: { name: true, type: true } },
      materials: { select: { id: true, origem: true } },
    },
  })

  const recebidos = agendamentos.reduce((n, a) => n + a.materials.filter(m => m.origem === "PROFESSOR").length, 0)

  const proximas = agendamentos.filter(
    a => (a.status === "AGENDADO" || a.status === "PENDENTE") && new Date(a.dataHora) >= new Date()
  )
  const historico = agendamentos.filter(
    a => !((a.status === "AGENDADO" || a.status === "PENDENTE") && new Date(a.dataHora) >= new Date())
  )

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          Olá, {session.user.name?.split(" ")[0]}! 👋
        </h1>
        <p className="text-neutral-500 mt-1">Aqui estão suas aulas agendadas.</p>
      </div>

      {/* Ação rápida */}
      {proximas.length > 0 && (
        <div className="bg-primary-50 border border-primary-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-primary-800">Enviar material para uma aula</p>
            <p className="text-sm text-primary-600 mt-0.5">
              PDF, Word, Excel, JPG, PNG ou TXT — até 300MB
            </p>
          </div>
          <Link
            href="/aluno/materiais"
            className="bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors whitespace-nowrap"
          >
            Enviar arquivo
          </Link>
        </div>
      )}

      {/* Materiais recebidos do professor */}
      {recebidos > 0 && (
        <Link href="/aluno/materiais-professor"
          className="block bg-amber-50 border border-amber-200 rounded-2xl p-5 hover:bg-amber-100 transition-colors">
          <p className="font-semibold text-amber-900">📚 Você tem {recebidos} material(is) do professor</p>
          <p className="text-sm text-amber-800 mt-0.5">Toque para ver e baixar os arquivos de estudo →</p>
        </Link>
      )}

      {/* Próximas aulas */}
      <section>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">
          Próximas Aulas ({proximas.length})
        </h2>
        {proximas.length === 0 ? (
          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-8 text-center text-neutral-500">
            <p className="text-4xl mb-3">📅</p>
            <p>Nenhuma aula agendada. Entre em contato com a coordenação.</p>
            <a href="https://wa.me/5519999663378"
              className="inline-block mt-4 text-primary-600 text-sm font-medium hover:underline">
              Contato via WhatsApp
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {proximas.map(apt => (
              <div key={String(apt.id)}
                className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-5 flex flex-wrap items-start justify-between gap-3 shadow-sm">
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold text-neutral-900">
                    {apt.subject?.name ?? apt.disciplina}
                  </p>
                  <p className="text-sm text-neutral-500">Prof. {apt.professor.name}</p>
                  <p className="text-sm text-neutral-500">
                    {new Date(apt.dataHora).toLocaleString("pt-BR", {
                      dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo",
                    })}
                    {" · "}{apt.duracaoMinutos} min
                  </p>
                  {apt.room && (
                    <p className="text-xs text-neutral-400">
                      {apt.room.type === "VIRTUAL" ? "💻" : "🏫"} {apt.room.name}
                    </p>
                  )}
                  {apt.materials.filter(m => m.origem !== "PROFESSOR").length > 0 && (
                    <p className="text-xs text-green-600 font-medium">
                      ✓ {apt.materials.filter(m => m.origem !== "PROFESSOR").length} material(is) enviado(s)
                    </p>
                  )}
                  {apt.materials.some(m => m.origem === "PROFESSOR") && (
                    <Link href="/aluno/materiais-professor" className="block text-xs text-primary-700 font-semibold hover:underline">
                      📚 {apt.materials.filter(m => m.origem === "PROFESSOR").length} material(is) do professor →
                    </Link>
                  )}
                </div>
                <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2">
                  {apt.status === "PENDENTE" ? (
                    <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full">
                      A confirmar
                    </span>
                  ) : (
                    <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                      Agendado
                    </span>
                  )}
                  <Link href="/aluno/materiais"
                    className="text-xs text-primary-600 hover:underline font-medium">
                    Enviar material →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Histórico */}
      {historico.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Histórico</h2>
          <div className="space-y-3">
            {historico.slice(0, 5).map(apt => (
              <div key={String(apt.id)}
                className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-neutral-700">
                    {apt.subject?.name ?? apt.disciplina}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {new Date(apt.dataHora).toLocaleDateString("pt-BR")} · Prof. {apt.professor.name}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  apt.status === "CONCLUIDO"
                    ? "bg-blue-100 text-blue-700"
                    : apt.status === "CANCELADO"
                      ? "bg-red-100 text-red-700"
                      : "bg-neutral-100 text-neutral-600"
                }`}>
                  {apt.status === "CONCLUIDO" ? "Concluída" : apt.status === "CANCELADO" ? "Cancelada" : apt.status === "PENDENTE" ? "Não confirmada" : "Realizada"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
