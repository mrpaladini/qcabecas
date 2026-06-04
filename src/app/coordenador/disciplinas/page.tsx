import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { criarDisciplina } from "./actions"
import { DisciplinaCRUD } from "@/components/coordenador/DisciplinaCRUD"

export default async function DisciplinasPage() {
  const session = await auth()
  if ((session?.user as any)?.role !== "COORDENADOR") redirect("/unauthorized")

  const [disciplinas, professores] = await Promise.all([
    prisma.subject.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: { subjectTeachers: { include: { user: { select: { id: true, name: true } } } } },
    }),
    prisma.user.findMany({
      where: { role: "PROFESSOR", deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  const disciplinasData = disciplinas.map(d => ({
    id: d.id,
    name: d.name,
    description: d.description,
    professores: d.subjectTeachers.map(st => ({ id: String(st.user.id), name: st.user.name })),
  }))

  const professoresData = professores.map(p => ({ id: String(p.id), name: p.name }))

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Disciplinas</h1>
        <p className="text-neutral-500 mt-1">Cadastre as disciplinas e associe os professores que as lecionam.</p>
      </div>

      {/* Formulário */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6">
        <h2 className="font-semibold text-neutral-900 mb-4">Nova Disciplina</h2>
        <form action={criarDisciplina} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-1">Nome *</label>
              <input id="name" name="name" required className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Ex: Matemática, Português" />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-neutral-700 mb-1">Descrição</label>
              <input id="description" name="description" className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Opcional" />
            </div>
          </div>

          {professores.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Professores que lecionam esta disciplina</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {professores.map(p => (
                  <label key={String(p.id)} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                    <input type="checkbox" name="professorIds" value={String(p.id)} className="rounded" />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <button type="submit" className="bg-primary-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-primary-700 transition-colors text-sm">
            Cadastrar Disciplina
          </button>
        </form>
      </div>

      {/* Lista */}
      <section>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Disciplinas Cadastradas ({disciplinas.length})</h2>
        <DisciplinaCRUD disciplinas={disciplinasData} todosOsProfessores={professoresData} />
      </section>
    </main>
  )
}
