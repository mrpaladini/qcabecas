import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { NovoUsuarioForm } from "@/components/coordenador/NovoUsuarioForm"
import { UsuarioCRUD } from "@/components/coordenador/UsuarioCRUD"

export default async function ProfessoresPage() {
  const session = await auth()
  if ((session?.user as any)?.role !== "COORDENADOR") redirect("/unauthorized")

  const professores = await prisma.user.findMany({
    where: { role: "PROFESSOR" },
    orderBy: [{ deletedAt: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, phone: true, tempPassword: true, deletedAt: true, precoPresencial: true, precoVirtual: true },
  })

  const data = professores.map(p => ({
    ...p,
    id: String(p.id),
    role: "PROFESSOR" as const,
    precoPresencial: p.precoPresencial?.toString() ?? null,
    precoVirtual: p.precoVirtual?.toString() ?? null,
  }))

  const ativos   = data.filter(p => !p.deletedAt)
  const inativos = data.filter(p =>  p.deletedAt)

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Professores</h1>
        <p className="text-neutral-500 mt-1">
          {ativos.length} ativo(s) · {inativos.length} inativo(s)
        </p>
      </div>

      <NovoUsuarioForm role="PROFESSOR" />

      <section>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Ativos ({ativos.length})</h2>
        <UsuarioCRUD usuarios={ativos} role="PROFESSOR" />
      </section>

      {inativos.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-neutral-500 mb-4">Inativos ({inativos.length})</h2>
          <UsuarioCRUD usuarios={inativos} role="PROFESSOR" />
        </section>
      )}
    </main>
  )
}
