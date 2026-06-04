"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"

function requireCoordenador(session: any) {
  if (!session?.user || session.user.role !== "COORDENADOR") throw new Error("Acesso negado")
}

const HorarioDiaSchema = z.object({
  dia: z.enum(["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"]),
  inicio: z.string().regex(/^\d{2}:\d{2}$/),
  fim: z.string().regex(/^\d{2}:\d{2}$/),
})

const SalaSchema = z.object({
  name: z.string().min(2).max(150),
  type: z.enum(["PRESENCIAL", "VIRTUAL"]),
  location: z.string().max(255).optional(),
  capacity: z.coerce.number().int().min(1).max(1000).optional(),
})

function parseHorarios(raw: string | null): z.infer<typeof HorarioDiaSchema>[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const result = parsed.map(h => HorarioDiaSchema.parse(h))
    return result.length > 0 ? result : null
  } catch {
    return null
  }
}

export async function criarSala(formData: FormData) {
  const session = await auth()
  requireCoordenador(session)

  const parsed = SalaSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    location: formData.get("location") || undefined,
    capacity: formData.get("capacity") || undefined,
  })
  if (!parsed.success) return { success: false, error: "Dados inválidos" }

  const horarios = parseHorarios(formData.get("horariosDisponiveis") as string | null)

  await prisma.room.create({
    data: {
      ...parsed.data,
      horariosDisponiveis: horarios ?? undefined,
    },
  })
  revalidatePath("/coordenador/salas")
  return { success: true }
}

export async function atualizarSala(id: number, formData: FormData) {
  const session = await auth()
  requireCoordenador(session)

  const parsed = SalaSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    location: formData.get("location") || undefined,
    capacity: formData.get("capacity") || undefined,
  })
  if (!parsed.success) return { success: false, error: "Dados inválidos" }

  const horarios = parseHorarios(formData.get("horariosDisponiveis") as string | null)

  await prisma.room.update({
    where: { id },
    data: {
      ...parsed.data,
      horariosDisponiveis: horarios ?? null,
    },
  })
  revalidatePath("/coordenador/salas")
  return { success: true }
}

export async function toggleAtivoSala(id: number, ativo: boolean) {
  const session = await auth()
  requireCoordenador(session)

  await prisma.room.update({ where: { id }, data: { active: ativo } })
  revalidatePath("/coordenador/salas")
  return { success: true }
}

export async function excluirSala(id: number) {
  const session = await auth()
  requireCoordenador(session)

  await prisma.room.update({ where: { id }, data: { deletedAt: new Date(), active: false } })
  revalidatePath("/coordenador/salas")
  return { success: true }
}
