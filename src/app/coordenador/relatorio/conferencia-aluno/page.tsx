import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { ConferenciaRelatorio } from "../ConferenciaRelatorio"

export default async function ConferenciaAlunoPage() {
  const session = await auth()
  if ((session?.user as any)?.role !== "COORDENADOR") redirect("/unauthorized")

  // Aulas concluídas = as que geram cobrança na conta do aluno (Contas a Receber)
  const [alunos, aulas] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ALUNO" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.appointment.findMany({
      where: { status: "CONCLUIDO" },
      orderBy: { dataHora: "asc" },
      select: {
        id: true, alunoId: true, dataHora: true, duracaoMinutos: true, disciplina: true, valorCobrado: true,
        subject: { select: { name: true } },
        transacaoAluno: { select: { valor: true } },
      },
    }),
  ])

  const linhas = aulas.map(a => ({
    id:             String(a.id),
    pessoaId:       String(a.alunoId),
    dataHora:       a.dataHora.toISOString(),
    duracaoMinutos: a.duracaoMinutos,
    disciplina:     a.subject?.name ?? a.disciplina,
    // valor efetivamente lançado na conta do aluno (ou o valor da aula, se ainda não lançado)
    valor:          Number(a.transacaoAluno?.valor ?? a.valorCobrado ?? 0),
  }))

  return (
    <ConferenciaRelatorio
      tipo="aluno"
      pessoas={alunos.map(p => ({ id: String(p.id), name: p.name }))}
      linhas={linhas}
      geradoEm={new Date().toISOString()}
    />
  )
}
