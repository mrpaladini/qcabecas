import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { ContasReceberDashboard } from "./ContasReceberDashboard"

export default async function ContasReceberPage() {
  const session = await auth()
  if ((session?.user as any)?.role !== "COORDENADOR") redirect("/unauthorized")

  const [alunos, contas] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ALUNO", deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, responsavelNome: true },
    }),
    prisma.contaAluno.findMany({
      include: {
        aluno: { select: { id: true, name: true, email: true } },
        transacoes: {
          orderBy: { createdAt: "desc" },
          include: {
            appointment: { select: { disciplina: true, dataHora: true } },
          },
        },
      },
    }),
  ])

  // Garante que alunos sem conta apareçam com saldo zero
  const contasPorAlunoId = new Map(contas.map(c => [String(c.alunoId), c]))

  const dadosAlunos = alunos.map(a => {
    const conta = contasPorAlunoId.get(String(a.id))
    return {
      id:              String(a.id),
      name:            a.name,
      email:           a.email,
      responsavelNome: a.responsavelNome ?? null,
      saldo:           conta ? Number(conta.saldo) : 0,
      contaId:         conta ? conta.id : null,
      transacoes:      (conta?.transacoes ?? []).map(t => ({
        id:          String(t.id),
        tipo:        t.tipo,
        valor:       Number(t.valor),
        descricao:   t.descricao,
        createdAt:   t.createdAt.toISOString(),
        disciplina:  t.appointment?.disciplina ?? null,
        aula:        t.appointment?.dataHora.toISOString() ?? null,
        temAppointment: !!t.appointmentId,
      })),
    }
  })

  const totalAReceber = dadosAlunos.reduce((acc, a) => a.saldo < 0 ? acc + Math.abs(a.saldo) : acc, 0)
  const totalCredito  = dadosAlunos.reduce((acc, a) => a.saldo > 0 ? acc + a.saldo : acc, 0)

  return (
    <ContasReceberDashboard
      alunos={dadosAlunos}
      totalAReceber={totalAReceber}
      totalCredito={totalCredito}
    />
  )
}
