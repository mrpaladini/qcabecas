"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"

function requireCoordenador(session: any) {
  if (!session?.user || session.user.role !== "COORDENADOR") throw new Error("Acesso negado")
}

const DisciplinaSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  professorIds: z.array(z.coerce.bigint()).optional(),
})

export async function criarDisciplina(formData: FormData) {
  const session = await auth()
  requireCoordenador(session)

  const ids = formData.getAll("professorIds").map(v => BigInt(v as string))

  const parsed = DisciplinaSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    professorIds: ids.length > 0 ? ids : undefined,
  })
  if (!parsed.success) return { success: false, error: "Dados inválidos" }

  const { name, description, professorIds } = parsed.data

  const disciplina = await prisma.subject.create({
    data: {
      name,
      description,
      subjectTeachers: professorIds?.length
        ? { create: professorIds.map(uid => ({ userId: uid })) }
        : undefined,
    },
  })

  revalidatePath("/coordenador/disciplinas")
  return { success: true, data: { id: disciplina.id } }
}

export async function atualizarDisciplina(id: number, formData: FormData) {
  const session = await auth()
  requireCoordenador(session)

  const ids = formData.getAll("professorIds").map(v => BigInt(v as string))

  const parsed = DisciplinaSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    professorIds: ids.length > 0 ? ids : undefined,
  })
  if (!parsed.success) return { success: false, error: "Dados inválidos" }

  const { name, description, professorIds } = parsed.data

  await prisma.subject.update({
    where: { id },
    data: { name, description },
  })

  await prisma.subjectTeacher.deleteMany({ where: { subjectId: id } })
  if (professorIds?.length) {
    await prisma.subjectTeacher.createMany({
      data: professorIds.map(uid => ({ subjectId: id, userId: uid })),
    })
  }

  revalidatePath("/coordenador/disciplinas")
  return { success: true }
}

export async function excluirDisciplina(id: number) {
  const session = await auth()
  requireCoordenador(session)

  await prisma.subject.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/coordenador/disciplinas")
  return { success: true }
}

export async function atualizarProfessoresDisciplina(subjectId: number, professorIds: bigint[]) {
  const session = await auth()
  requireCoordenador(session)

  await prisma.subjectTeacher.deleteMany({ where: { subjectId } })
  if (professorIds.length > 0) {
    await prisma.subjectTeacher.createMany({
      data: professorIds.map(uid => ({ subjectId, userId: uid })),
    })
  }

  revalidatePath("/coordenador/disciplinas")
  return { success: true }
}
