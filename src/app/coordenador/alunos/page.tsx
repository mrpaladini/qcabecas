import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { decryptTemp } from "@/lib/crypto"
import { NovoUsuarioForm } from "@/components/coordenador/NovoUsuarioForm"
import { UsuariosComBusca } from "@/components/coordenador/UsuariosComBusca"

export default async function AlunosPage() {
  const session = await auth()
  if ((session?.user as any)?.role !== "COORDENADOR") redirect("/unauthorized")

  const alunos = await prisma.user.findMany({
    where: { role: "ALUNO" },
    orderBy: [{ deletedAt: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, email: true, phone: true, tempPassword: true, deletedAt: true, createdAt: true,
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
    createdAt: a.createdAt.toISOString(),
    precoPresencial: a.precoPresencial?.toString() ?? null,
    precoVirtual: a.precoVirtual?.toString() ?? null,
    tempPassword: a.tempPassword ? decryptTemp(a.tempPassword) : null,
  }))

  const ativos   = data.filter(a => !a.deletedAt).length
  const inativos = data.length - ativos

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Alunos</h1>
        <p className="text-neutral-500 mt-1">
          {ativos} ativo(s) · {inativos} inativo(s)
        </p>
      </div>

      <NovoUsuarioForm role="ALUNO" />

      <UsuariosComBusca usuarios={data} role="ALUNO" />
    </main>
  )
}
