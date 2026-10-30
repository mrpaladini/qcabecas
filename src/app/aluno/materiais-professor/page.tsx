import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { ListaArquivos } from "@/components/professor/MateriaisProfessor"

// Materiais de estudo que os professores enviaram para o aluno logado
export default async function MateriaisDoProfessorPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if ((session.user as { role?: string }).role !== "ALUNO") redirect("/unauthorized")

  const alunoId = BigInt(session.user.id!)

  // Anti-IDOR: só materiais destinados a este aluno, em aulas dele
  const aulas = await prisma.appointment.findMany({
    where: { alunoId, materials: { some: { origem: "PROFESSOR", alunoId } } },
    orderBy: { dataHora: "desc" },
    include: {
      professor: { select: { name: true } },
      subject:   { select: { name: true } },
      materials: {
        where: { origem: "PROFESSOR", alunoId },
        orderBy: { createdAt: "desc" },
        select: { id: true, originalName: true, mimetype: true, sizeBytes: true, createdAt: true },
      },
    },
  })

  const total = aulas.reduce((n, a) => n + a.materials.length, 0)

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Materiais do professor</h1>
        <p className="text-neutral-500 mt-1">
          Arquivos que seus professores enviaram para você estudar.
          {total > 0 && ` ${total} arquivo(s).`}
        </p>
      </div>

      {aulas.length === 0 ? (
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-10 text-center text-neutral-500">
          <p className="text-4xl mb-3">📚</p>
          <p>Nenhum material recebido ainda.</p>
          <p className="text-sm mt-1">Quando um professor enviar um arquivo, ele aparece aqui e você recebe um aviso por e-mail.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {aulas.map(a => (
            <section key={String(a.id)} className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="mb-3">
                <h2 className="font-semibold text-neutral-900">{a.subject?.name ?? a.disciplina}</h2>
                <p className="text-sm text-neutral-500">
                  Prof. {a.professor.name} · aula de{" "}
                  {a.dataHora.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}
                </p>
              </div>
              <ListaArquivos materiais={a.materials.map(m => ({
                id: String(m.id), originalName: m.originalName, mimetype: m.mimetype, sizeBytes: m.sizeBytes,
              }))} />
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
