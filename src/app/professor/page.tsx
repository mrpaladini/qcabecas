import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getAppointmentsByProfessor } from "@/lib/queries/appointments"

// Server Component — dados filtrados pelo professor logado, nunca expostos a outros
export default async function ProfessorDashboard() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const professorId = parseInt(session.user.id)
  const agendamentos = await getAppointmentsByProfessor(professorId)

  const proximas = agendamentos.filter(
    (a) => (a.status === "AGENDADO" || a.status === "PENDENTE") && new Date(a.dataHora) >= new Date()
  )

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          Olá, {session.user.name.split(" ")[0]}! 👋
        </h1>
        <p className="text-neutral-500 mt-1">Sua agenda de aulas.</p>
      </div>

      {/* Próximas aulas */}
      <section>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">
          Próximas Aulas ({proximas.length})
        </h2>

        {proximas.length === 0 ? (
          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-8 text-center text-neutral-500">
            <p className="text-4xl mb-3">📅</p>
            <p>Nenhuma aula agendada para os próximos dias.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {proximas.map((apt) => (
              <div
                key={apt.id}
                className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-card"
              >
                {/* Cabeçalho da aula */}
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-neutral-900">{apt.disciplina}</p>
                    <p className="text-sm text-neutral-500">
                      Aluno: {apt.aluno.name}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {new Date(apt.dataHora).toLocaleString("pt-BR", {
                        dateStyle: "long",
                        timeStyle: "short",
                        timeZone: "America/Sao_Paulo",
                      })}
                      {" · "}
                      {apt.duracaoMinutos} min
                    </p>
                  </div>
                  {apt.status === "PENDENTE" ? (
                    <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full">
                      A confirmar
                    </span>
                  ) : (
                    <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                      Agendado
                    </span>
                  )}
                </div>

                {/* Materiais enviados pelo aluno */}
                {apt.materials.length > 0 ? (
                  <div className="bg-neutral-50 rounded-xl p-3 mt-2">
                    <p className="text-xs font-semibold text-neutral-600 mb-2">
                      📎 Materiais enviados pelo aluno ({apt.materials.length})
                    </p>
                    <ul className="space-y-1">
                      {apt.materials.map((m) => (
                        <li key={m.id} className="flex items-center gap-2 text-xs text-neutral-600">
                          <span>📄</span>
                          <span>{m.originalName}</span>
                          <span className="text-neutral-400">
                            ({(m.sizeBytes / 1024).toFixed(0)} KB)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 mt-2 italic">
                    Nenhum material enviado pelo aluno ainda.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
