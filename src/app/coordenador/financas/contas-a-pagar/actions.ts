"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"

function requireCoordenador(session: any) {
  if (!session?.user || session.user.role !== "COORDENADOR") throw new Error("Acesso negado")
}

const GerarPagamentoSchema = z.object({
  professorId:   z.coerce.bigint().positive(),
  evidenciaIds:  z.array(z.coerce.bigint().positive()).min(1, "Selecione ao menos uma aula"),
  observacoes:   z.string().max(500).optional(),
})

export async function gerarPagamento(
  professorId: string,
  evidenciaIds: string[],
  observacoes?: string,
) {
  const session = await auth()
  requireCoordenador(session)

  const parsed = GerarPagamentoSchema.safeParse({ professorId, evidenciaIds, observacoes })
  if (!parsed.success) return { success: false, error: "Dados inválidos" }

  const { professorId: profId, evidenciaIds: ids } = parsed.data

  // Busca professor e evidências
  const [professor, evidencias] = await Promise.all([
    prisma.user.findFirst({
      where: { id: profId, role: "PROFESSOR", deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.evidencia.findMany({
      where: {
        id: { in: ids },
        status: "CONCLUIDO",
        pagoProfessor: false,
        appointment: { professorId: profId },
      },
    }),
  ])

  if (!professor) return { success: false, error: "Professor não encontrado" }
  if (evidencias.length === 0) return { success: false, error: "Nenhuma aula válida selecionada" }
  if (evidencias.length !== ids.length)
    return { success: false, error: "Algumas aulas selecionadas não estão disponíveis para pagamento" }

  const totalValor = evidencias.reduce((acc, e) => acc + Number(e.valorProfessor), 0)
  const datas = evidencias.map(e => e.dataAula).sort((a, b) => a.getTime() - b.getTime())

  const pagamento = await prisma.$transaction(async tx => {
    const pag = await tx.pagamentoProfessor.create({
      data: {
        professorId:   profId,
        professorNome: professor.name,
        totalValor,
        aulaCount:     evidencias.length,
        periodoInicio: datas[0],
        periodoFim:    datas[datas.length - 1],
        observacoes:   observacoes || null,
        geradoPor:     BigInt(session.user.id),
      },
    })

    await tx.evidencia.updateMany({
      where: { id: { in: ids } },
      data: {
        pagoProfessor: true,
        pagamentoId:   pag.id,
      },
    })

    return pag
  })

  revalidatePath("/coordenador/financas/contas-a-pagar")
  return { success: true, pagamentoId: String(pagamento.id) }
}

export async function getPagamento(id: string) {
  const session = await auth()
  requireCoordenador(session)

  const pagamento = await prisma.pagamentoProfessor.findUnique({
    where: { id: BigInt(id) },
    include: {
      professor: { select: { name: true, email: true } },
      gerador:   { select: { name: true } },
      evidencias: { orderBy: { dataAula: "asc" } },
    },
  })
  if (!pagamento) return null

  return {
    id:            String(pagamento.id),
    professorNome: pagamento.professorNome,
    professorEmail: pagamento.professor.email,
    totalValor:    Number(pagamento.totalValor),
    aulaCount:     pagamento.aulaCount,
    periodoInicio: pagamento.periodoInicio?.toISOString() ?? null,
    periodoFim:    pagamento.periodoFim?.toISOString() ?? null,
    observacoes:   pagamento.observacoes ?? null,
    geradoEm:      pagamento.geradoEm.toISOString(),
    geradoPor:     pagamento.gerador.name,
    evidencias:    pagamento.evidencias.map(e => ({
      id:             String(e.id),
      dataAula:       e.dataAula.toISOString(),
      disciplina:     e.disciplina,
      alunoNome:      e.alunoNome,
      duracaoMinutos: e.duracaoMinutos,
      salaTipo:       e.salaTipo ?? null,
      valorProfessor: Number(e.valorProfessor),
    })),
  }
}
