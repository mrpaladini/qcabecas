import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getAppointmentsByProfessor } from "@/lib/queries/appointments"
import { urlMaterial } from "@/lib/download-material"

// Server Component — dados filtrados pelo professor logado, nunca expostos a outros
export default async function ProfessorDashboard() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const professorId = parseInt(session.user.id)
  const agendamentos = await getAppointmentsByProfessor(professorId)

  const proximas = agendamentos.filter(
    (a) => (a.status === "AGENDADO" || a.status === "PENDENTE") && new Date(a.dataHora) >= new Date()
  )
  // Aulas já passadas que têm material — o professor continua podendo baixar
  const anterioresComMaterial = agendamentos
    .filter(a => !proximas.includes(a) && a.status !== "CANCELADO" && a.materials.length > 0)
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
    .slice(0, 15)

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
                    <ListaMateriais materiais={apt.materials} />
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

      {anterioresComMaterial.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            Materiais de aulas anteriores
          </h2>
          <div className="space-y-3">
            {anterioresComMaterial.map((apt) => (
              <div key={apt.id} className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4">
                <p className="text-sm font-medium text-neutral-800">
                  {apt.disciplina} — {apt.aluno.name}
                </p>
                <p className="text-xs text-neutral-500 mb-2">
                  {new Date(apt.dataHora).toLocaleString("pt-BR", {
                    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
                  })}
                </p>
                <ListaMateriais materiais={apt.materials} />
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

type MaterialItem = { id: bigint; originalName: string; mimetype: string; sizeBytes: number }

function fmtTamanho(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Lista de arquivos com links de download (rota protegida /api/materiais/[id]). */
function ListaMateriais({ materiais }: { materiais: MaterialItem[] }) {
  return (
    <ul className="space-y-1.5">
      {materiais.map((m) => {
        const visualizavel = ["application/pdf", "image/jpeg", "image/png"].includes(m.mimetype)
        const href = urlMaterial(m.id, m.originalName)
        return (
          <li key={String(m.id)} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-600">
            <span aria-hidden="true">📄</span>
            <a href={href} className="font-medium text-primary-700 hover:underline break-all">
              {m.originalName}
            </a>
            <span className="text-neutral-400">({fmtTamanho(m.sizeBytes)})</span>
            <span className="flex gap-1.5 ml-auto">
              {visualizavel && (
                <a href={urlMaterial(m.id, m.originalName, true)} target="_blank" rel="noopener noreferrer"
                  className="border border-neutral-200 bg-white px-2 py-1 rounded-md hover:bg-neutral-100">
                  Abrir
                </a>
              )}
              <a href={href}
                className="border border-primary-200 bg-white text-primary-700 px-2 py-1 rounded-md hover:bg-primary-50 font-medium">
                ⬇ Baixar
              </a>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
