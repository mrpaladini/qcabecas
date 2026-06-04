import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { NovoUsuarioForm } from "@/components/coordenador/NovoUsuarioForm"
import { UsuarioCRUD } from "@/components/coordenador/UsuarioCRUD"

export default async function AlunosPage() {
  const session = await auth()
  if ((session?.user as any)?.role !== "COORDENADOR") redirect("/unauthorized")

  const alunos = await prisma.user.findMany({
    where: { role: "ALUNO" },
    orderBy: [{ deletedAt: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, email: true, phone: true, tempPassword: true, deletedAt: true,
      precoPresencial: true, precoVirtual: true,
      responsavelNome: true, cpfResponsavel: true, responsavelTelefone: true,
      rua: true, bairro: true, cidade: true, cep: true, referenciaEndereco: true,
      escola: true, serie: true, observacoes: true,
    },
  })

  const data = alunos.map(a => ({
    ...a,
    id: String(a.id),
    role: "ALUNO" as const,
    precoPresencial: a.precoPresencial?.toString() ?? null,
    precoVirtual: a.precoVirtual?.toString() ?? null,
  }))

  const ativos     = data.filter(a => !a.deletedAt)
  const inativos   = data.filter(a =>  a.deletedAt)

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Alunos</h1>
        <p className="text-neutral-500 mt-1">
          {ativos.length} ativo(s) · {inativos.length} inativo(s)
        </p>
      </div>

      <NovoUsuarioForm role="ALUNO" />

      <section>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Ativos ({ativos.length})</h2>
        <UsuarioCRUD usuarios={ativos} role="ALUNO" />
      </section>

      {inativos.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-neutral-500 mb-4">Inativos ({inativos.length})</h2>
          <UsuarioCRUD usuarios={inativos} role="ALUNO" />
        </section>
      )}
    </main>
  )
}
