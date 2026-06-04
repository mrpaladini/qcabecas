import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { criarSala } from "./actions"
import { SalaCRUD } from "@/components/coordenador/SalaCRUD"

export default async function SalasPage() {
  const session = await auth()
  if ((session?.user as any)?.role !== "COORDENADOR") redirect("/unauthorized")

  const todasSalas = await prisma.room.findMany({
    where: { deletedAt: null },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  })

  const ativas   = todasSalas.filter(s => s.active)
  const inativas = todasSalas.filter(s => !s.active)

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Salas de Aula</h1>
        <p className="text-neutral-500 mt-1">Cadastre salas presenciais e ambientes virtuais.</p>
      </div>

      {/* Formulário */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6">
        <h2 className="font-semibold text-neutral-900 mb-4">Nova Sala</h2>
        <form action={criarSala} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-1">Nome *</label>
            <input id="name" name="name" required className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Ex: Sala 01, Google Meet" />
          </div>
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-neutral-700 mb-1">Tipo *</label>
            <select id="type" name="type" required className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="PRESENCIAL">🏫 Presencial</option>
              <option value="VIRTUAL">💻 Virtual</option>
            </select>
          </div>
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-neutral-700 mb-1">Endereço / URL</label>
            <input id="location" name="location" className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Endereço físico ou link de videoconferência" />
          </div>
          <div>
            <label htmlFor="capacity" className="block text-sm font-medium text-neutral-700 mb-1">Capacidade</label>
            <input id="capacity" name="capacity" type="number" min="1" className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Nº máximo de alunos" />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="bg-primary-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-primary-700 transition-colors text-sm">
              Cadastrar Sala
            </button>
          </div>
        </form>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Ativas ({ativas.length})</h2>
        <SalaCRUD salas={ativas} />
      </section>

      {inativas.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-neutral-500 mb-4">Inativas ({inativas.length})</h2>
          <SalaCRUD salas={inativas} />
        </section>
      )}
    </main>
  )
}
