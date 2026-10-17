import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { UploadMaterialForm } from "@/components/aluno/UploadMaterialForm"

export default async function MateriaisPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if ((session.user as any).role !== "ALUNO") redirect("/unauthorized")

  const alunoId = BigInt(session.user.id)

  const agendamentos = await prisma.appointment.findMany({
    where: { alunoId, status: { in: ["AGENDADO", "PENDENTE"] } },
    orderBy: { dataHora: "asc" },
    include: {
      professor: { select: { name: true } },
      subject:   { select: { name: true } },
      materials: { select: { id: true, originalName: true, sizeBytes: true, createdAt: true } },
    },
  })

  const data = agendamentos.map(a => ({
    id: Number(a.id),
    disciplina: a.subject?.name ?? a.disciplina,
    professor:  a.professor.name,
    dataHora:   a.dataHora.toISOString(),
    materiais:  a.materials.map(m => ({
      id: Number(m.id),
      originalName: m.originalName,
      sizeBytes:    m.sizeBytes,
      createdAt:    m.createdAt.toISOString(),
    })),
  }))

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Enviar Materiais</h1>
        <p className="text-neutral-500 mt-1">
          Envie os arquivos que serão usados na aula para o professor.
        </p>
      </div>

      {data.length === 0 ? (
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-10 text-center text-neutral-500">
          <p className="text-4xl mb-3">📅</p>
          <p>Você não tem aulas agendadas.</p>
          <p className="text-sm mt-1">Entre em contato com a coordenação para agendar uma aula.</p>
        </div>
      ) : (
        <UploadMaterialForm agendamentos={data} />
      )}
    </main>
  )
}
