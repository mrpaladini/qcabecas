"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"

function requireCoordenador(session: any) {
  if (!session?.user || session.user.role !== "COORDENADOR") throw new Error("Acesso negado")
}

const AjusteSchema = z.object({
  professorId: z.coerce.bigint().positive(),
  tipo:        z.enum(["CREDITO", "DEBITO"]),
  valor:       z.coerce.number().positive("Informe um valor maior que zero").max(99999),
  descricao:   z.string().trim().min(2, "Descreva o motivo").max(255),
})

/**
 * Lança um crédito (valor a favor do professor) ou débito (desconto) na conta
 * do professor. O ajuste fica "pendente" e entra no próximo pagamento gerado
 * em Contas a Pagar.
 */
export async function lancarAjusteProfessor(formData: FormData) {
  const session = await auth()
  requireCoordenador(session)

  const valorRaw = String(formData.get("valor") ?? "").replace(/[^\d,\.]/g, "").replace(",", ".")
  const parsed = AjusteSchema.safeParse({
    professorId: formData.get("professorId"),
    tipo:        formData.get("tipo"),
    valor:       valorRaw,
    descricao:   formData.get("descricao"),
  })
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0]
    return { success: false, error: msg ?? "Dados inválidos" }
  }

  const { professorId, tipo, valor, descricao } = parsed.data
  const professor = await prisma.user.findFirst({ where: { id: professorId, role: "PROFESSOR" }, select: { id: true } })
  if (!professor) return { success: false, error: "Professor não encontrado" }

  await prisma.ajusteProfessor.create({
    data: {
      professorId,
      tipo,
      valor,
      descricao,
      registradoPor: BigInt((session as any).user.id),
    },
  })

  revalidatePath("/coordenador/professores")
  revalidatePath("/coordenador/financas/contas-a-pagar")
  return { success: true }
}

/** Remove um ajuste que ainda não entrou em nenhum pagamento. */
export async function estornarAjusteProfessor(ajusteId: string) {
  const session = await auth()
  requireCoordenador(session)

  const ajuste = await prisma.ajusteProfessor.findUnique({ where: { id: BigInt(ajusteId) } })
  if (!ajuste) return { success: false, error: "Lançamento não encontrado" }
  if (ajuste.pagamentoId) return { success: false, error: "Este lançamento já faz parte de um pagamento gerado e não pode ser estornado" }

  await prisma.ajusteProfessor.delete({ where: { id: ajuste.id } })

  revalidatePath("/coordenador/professores")
  revalidatePath("/coordenador/financas/contas-a-pagar")
  return { success: true }
}
