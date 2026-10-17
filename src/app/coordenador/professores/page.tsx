import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { decryptTemp } from "@/lib/crypto"
import { NovoUsuarioForm } from "@/components/coordenador/NovoUsuarioForm"
import { UsuariosComBusca } from "@/components/coordenador/UsuariosComBusca"
import { parseDisponibilidade, parseSeries } from "@/lib/professor"

export default async function ProfessoresPage() {
  const session = await auth()
  if ((session?.user as any)?.role !== "COORDENADOR") redirect("/unauthorized")

  const professores = await prisma.user.findMany({
    where: { role: "PROFESSOR" },
    orderBy: [{ deletedAt: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, email: true, phone: true, phone2: true, tempPassword: true,
      deletedAt: true, createdAt: true, precoPresencial: true, precoVirtual: true,
      observacoes: true, escolaAtuacao: true, seriesAtendidas: true,
      atendePresencial: true, atendeOnline: true, disponibilidade: true,
      ajustesProfessor: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, tipo: true, valor: true, descricao: true, createdAt: true, pagamentoId: true },
      },
    },
  })

  const data = professores.map(({ ajustesProfessor, ...p }) => ({
    ...p,
    id: String(p.id),
    role: "PROFESSOR" as const,
    createdAt: p.createdAt.toISOString(),
    precoPresencial: p.precoPresencial?.toString() ?? null,
    precoVirtual: p.precoVirtual?.toString() ?? null,
    tempPassword: p.tempPassword ? decryptTemp(p.tempPassword) : null,
    seriesAtendidas: parseSeries(p.seriesAtendidas),
    disponibilidade: parseDisponibilidade(p.disponibilidade),
    ajustes: ajustesProfessor.map(a => ({
      id: String(a.id),
      tipo: a.tipo,
      valor: Number(a.valor),
      descricao: a.descricao,
      createdAt: a.createdAt.toISOString(),
      pagamentoId: a.pagamentoId ? String(a.pagamentoId) : null,
    })),
  }))

  const ativos   = data.filter(p => !p.deletedAt).length
  const inativos = data.length - ativos

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Professores</h1>
        <p className="text-neutral-500 mt-1">
          {ativos} ativo(s) · {inativos} inativo(s)
        </p>
      </div>

      <NovoUsuarioForm role="PROFESSOR" />

      <UsuariosComBusca usuarios={data} role="PROFESSOR" />
    </main>
  )
}
