"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { registrarAuditoria, quem, primeiroNome, fmtMoeda } from "@/lib/audit"

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

const LancamentoSchema = z.object({
  alunoId:   z.coerce.bigint().positive(),
  tipo:      z.enum(["CREDITO", "DEBITO"]),
  valor:     z.coerce.number().positive().max(99999),
  descricao: z.string().min(2).max(255),
})

/**
 * Lançamento manual na conta do aluno.
 * CREDITO = pagamento/adiantamento do aluno (aumenta o saldo).
 * DEBITO  = cobrança/ajuste (diminui o saldo — aluno passa a dever).
 */
async function lancar(formData: FormData, tipo: "CREDITO" | "DEBITO") {
  const session = await auth()
  requireCoordenador(session)

  const padrao = tipo === "CREDITO" ? "Crédito adiantado" : "Débito (ajuste)"
  const parsed = LancamentoSchema.safeParse({
    alunoId:   formData.get("alunoId"),
    tipo,
    valor:     String(formData.get("valor") ?? "").replace(",", "."),
    descricao: formData.get("descricao") || padrao,
  })
  if (!parsed.success) return { success: false, error: "Dados inválidos: informe um valor maior que zero" }

  const { alunoId, valor, descricao } = parsed.data
  const conta = await getOrCreateConta(alunoId)

  await prisma.$transaction(async tx => {
    await tx.transacaoAluno.create({
      data: {
        contaId:      conta.id,
        tipo,
        valor,
        descricao,
        registradoPor: BigInt((session as any).user.id),
      },
    })
    await tx.contaAluno.update({
      where: { id: conta.id },
      data:  { saldo: tipo === "CREDITO" ? { increment: valor } : { decrement: valor } },
    })
  })

  const aluno = await prisma.user.findUnique({ where: { id: alunoId }, select: { name: true } })
  await registrarAuditoria(session, tipo === "CREDITO" ? "FINANCEIRO_CREDITO_ALUNO" : "FINANCEIRO_DEBITO_ALUNO",
    "ContaAluno", conta.id,
    `${quem(session)} lançou ${tipo === "CREDITO" ? "crédito" : "débito"} de ${fmtMoeda(valor)} na conta do aluno ` +
    `${primeiroNome(aluno?.name ?? "")} (${descricao})`)

  revalidatePath("/coordenador/financas/contas-a-receber")
  return { success: true }
}

export async function adicionarCredito(formData: FormData) {
  return lancar(formData, "CREDITO")
}

export async function adicionarDebito(formData: FormData) {
  return lancar(formData, "DEBITO")
}

export async function estornarTransacao(transacaoId: string) {
  const session = await auth()
  requireCoordenador(session)

  const tx = await prisma.transacaoAluno.findUnique({
    where: { id: BigInt(transacaoId) },
    include: { conta: { include: { aluno: { select: { name: true } } } } },
  })
  if (!tx) return { success: false, error: "Transação não encontrada" }

  const delta = tx.tipo === "CREDITO"
    ? { decrement: Number(tx.valor) }
    : { increment: Number(tx.valor) }

  await prisma.$transaction(async prismaTx => {
    await prismaTx.transacaoAluno.delete({ where: { id: BigInt(transacaoId) } })
    await prismaTx.contaAluno.update({ where: { id: tx.conta.id }, data: { saldo: delta } })
  })

  await registrarAuditoria(session, "FINANCEIRO_ESTORNO_ALUNO", "ContaAluno", tx.conta.id,
    `${quem(session)} estornou ${tx.tipo === "CREDITO" ? "crédito" : "débito"} de ${fmtMoeda(Number(tx.valor))} ` +
    `da conta do aluno ${primeiroNome(tx.conta.aluno.name)} (${tx.descricao})`)

  revalidatePath("/coordenador/financas/contas-a-receber")
  return { success: true }
}
