"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"

function requireCoordenador(session: any) {
  if (!session?.user || session.user.role !== "COORDENADOR") throw new Error("Acesso negado")
}

export async function getOrCreateConta(alunoId: bigint) {
  return prisma.contaAluno.upsert({
    where:  { alunoId },
    update: {},
    create: { alunoId, saldo: 0 },
  })
}

const CreditoSchema = z.object({
  alunoId:   z.coerce.bigint().positive(),
  valor:     z.coerce.number().positive().max(99999),
  descricao: z.string().min(2).max(255).default("Crédito adiantado"),
})

export async function adicionarCredito(formData: FormData) {
  const session = await auth()
  requireCoordenador(session)

  const parsed = CreditoSchema.safeParse({
    alunoId:   formData.get("alunoId"),
    valor:     formData.get("valor"),
    descricao: formData.get("descricao") || "Crédito adiantado",
  })
  if (!parsed.success) return { success: false, error: "Dados inválidos" }

  const { alunoId, valor, descricao } = parsed.data
  const conta = await getOrCreateConta(alunoId)

  await prisma.$transaction(async tx => {
    await tx.transacaoAluno.create({
      data: {
        contaId:      conta.id,
        tipo:         "CREDITO",
        valor,
        descricao,
        registradoPor: BigInt(session.user.id),
      },
    })
    await tx.contaAluno.update({
      where: { id: conta.id },
      data:  { saldo: { increment: valor } },
    })
  })

  revalidatePath("/coordenador/financas/contas-a-receber")
  return { success: true }
}

export async function estornarTransacao(transacaoId: string) {
  const session = await auth()
  requireCoordenador(session)

  const tx = await prisma.transacaoAluno.findUnique({
    where: { id: BigInt(transacaoId) },
    include: { conta: true },
  })
  if (!tx) return { success: false, error: "Transação não encontrada" }

  const delta = tx.tipo === "CREDITO"
    ? { decrement: Number(tx.valor) }
    : { increment: Number(tx.valor) }

  await prisma.$transaction(async prismaTx => {
    await prismaTx.transacaoAluno.delete({ where: { id: BigInt(transacaoId) } })
    await prismaTx.contaAluno.update({ where: { id: tx.conta.id }, data: { saldo: delta } })
  })

  revalidatePath("/coordenador/financas/contas-a-receber")
  return { success: true }
}
