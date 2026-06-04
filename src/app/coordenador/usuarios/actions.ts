"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { Role } from "@prisma/client"

function requireCoordenador(session: any) {
  if (!session?.user || session.user.role !== "COORDENADOR")
    throw new Error("Acesso negado")
}

function gerarSenha(tamanho = 8): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
  return Array.from({ length: tamanho }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

const str = (max: number) => z.string().max(max).optional()

const AlunoExtraSchema = z.object({
  responsavelNome:    str(150),
  cpfResponsavel:     str(14),
  responsavelTelefone: str(20),
  rua:                str(255),
  bairro:             str(100),
  cidade:             str(100),
  cep:                str(9),
  referenciaEndereco: str(255),
  escola:             str(200),
  serie:              str(50),
  observacoes:        z.string().max(2000).optional(),
})

const UsuarioCreateSchema = z.object({
  name:            z.string().min(3).max(150),
  email:           z.string().email(),
  phone:           str(20),
  role:            z.nativeEnum(Role),
  precoPresencial: z.coerce.number().min(0).optional(),
  precoVirtual:    z.coerce.number().min(0).optional(),
}).merge(AlunoExtraSchema)

const UsuarioUpdateSchema = z.object({
  name:            z.string().min(3).max(150),
  email:           z.string().email(),
  phone:           str(20),
  precoPresencial: z.coerce.number().min(0).optional(),
  precoVirtual:    z.coerce.number().min(0).optional(),
}).merge(AlunoExtraSchema)

function extraFromForm(formData: FormData) {
  return {
    responsavelNome:     formData.get("responsavelNome")     || undefined,
    cpfResponsavel:      formData.get("cpfResponsavel")      || undefined,
    responsavelTelefone: formData.get("responsavelTelefone") || undefined,
    rua:                 formData.get("rua")                 || undefined,
    bairro:              formData.get("bairro")              || undefined,
    cidade:              formData.get("cidade")              || undefined,
    cep:                 formData.get("cep")                 || undefined,
    referenciaEndereco:  formData.get("referenciaEndereco")  || undefined,
    escola:              formData.get("escola")              || undefined,
    serie:               formData.get("serie")               || undefined,
    observacoes:         formData.get("observacoes")         || undefined,
  }
}

export async function criarUsuario(formData: FormData) {
  const session = await auth()
  requireCoordenador(session)

  const role = formData.get("role") as Role
  const parsed = UsuarioCreateSchema.safeParse({
    name:            formData.get("name"),
    email:           formData.get("email"),
    phone:           formData.get("phone") || undefined,
    role,
    precoPresencial: formData.get("precoPresencial") || undefined,
    precoVirtual:    formData.get("precoVirtual") || undefined,
    ...extraFromForm(formData),
  })
  if (!parsed.success) return { success: false, error: "Dados inválidos: " + JSON.stringify(parsed.error.flatten().fieldErrors) }

  const existe = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existe) return { success: false, error: "E-mail já cadastrado" }

  const senhaPlain   = gerarSenha()
  const passwordHash = await bcrypt.hash(senhaPlain, 12)

  const { name, email, phone, precoPresencial, precoVirtual,
    responsavelNome, cpfResponsavel, responsavelTelefone,
    rua, bairro, cidade, cep, referenciaEndereco,
    escola, serie, observacoes } = parsed.data

  const user = await prisma.user.create({
    data: {
      name, email, phone, role,
      passwordHash,
      tempPassword: senhaPlain,
      consentimentoLgpd: true,
      precoPresencial: precoPresencial ?? null,
      precoVirtual:    precoVirtual ?? null,
      responsavelNome:     responsavelNome ?? null,
      cpfResponsavel:      cpfResponsavel ?? null,
      responsavelTelefone: responsavelTelefone ?? null,
      rua:                 rua ?? null,
      bairro:              bairro ?? null,
      cidade:              cidade ?? null,
      cep:                 cep ?? null,
      referenciaEndereco:  referenciaEndereco ?? null,
      escola:              escola ?? null,
      serie:               serie ?? null,
      observacoes:         observacoes ?? null,
    },
  })

  const path = role === "ALUNO" ? "/coordenador/alunos" : role === "PROFESSOR" ? "/coordenador/professores" : "/coordenador/coordenadores"
  revalidatePath(path)
  return { success: true, data: { id: String(user.id), senhaGerada: senhaPlain } }
}

export async function atualizarUsuario(id: string, formData: FormData) {
  const session = await auth()
  requireCoordenador(session)

  const parsed = UsuarioUpdateSchema.safeParse({
    name:            formData.get("name"),
    email:           formData.get("email"),
    phone:           formData.get("phone") || undefined,
    precoPresencial: formData.get("precoPresencial") || undefined,
    precoVirtual:    formData.get("precoVirtual") || undefined,
    ...extraFromForm(formData),
  })
  if (!parsed.success) return { success: false, error: "Dados inválidos" }

  const user = await prisma.user.findUnique({ where: { id: BigInt(id) }, select: { role: true, email: true } })
  if (!user) return { success: false, error: "Usuário não encontrado" }

  if (parsed.data.email !== user.email) {
    const emailExiste = await prisma.user.findFirst({ where: { email: parsed.data.email, id: { not: BigInt(id) } } })
    if (emailExiste) return { success: false, error: "E-mail já cadastrado para outro usuário" }
  }

  const { name, email, phone, precoPresencial, precoVirtual,
    responsavelNome, cpfResponsavel, responsavelTelefone,
    rua, bairro, cidade, cep, referenciaEndereco,
    escola, serie, observacoes } = parsed.data

  await prisma.user.update({
    where: { id: BigInt(id) },
    data: {
      name, email,
      phone:           phone ?? null,
      precoPresencial: precoPresencial ?? null,
      precoVirtual:    precoVirtual ?? null,
      responsavelNome:     responsavelNome ?? null,
      cpfResponsavel:      cpfResponsavel ?? null,
      responsavelTelefone: responsavelTelefone ?? null,
      rua:                 rua ?? null,
      bairro:              bairro ?? null,
      cidade:              cidade ?? null,
      cep:                 cep ?? null,
      referenciaEndereco:  referenciaEndereco ?? null,
      escola:              escola ?? null,
      serie:               serie ?? null,
      observacoes:         observacoes ?? null,
    },
  })

  revalidatePath("/coordenador/alunos")
  revalidatePath("/coordenador/professores")
  revalidatePath("/coordenador/coordenadores")
  return { success: true }
}

export async function desativarUsuario(id: string) {
  const session = await auth()
  requireCoordenador(session)
  await prisma.user.update({ where: { id: BigInt(id) }, data: { deletedAt: new Date() } })
  revalidatePath("/coordenador/alunos")
  revalidatePath("/coordenador/professores")
  revalidatePath("/coordenador/coordenadores")
  return { success: true }
}

export async function reativarUsuario(id: string) {
  const session = await auth()
  requireCoordenador(session)
  await prisma.user.update({ where: { id: BigInt(id) }, data: { deletedAt: null } })
  revalidatePath("/coordenador/alunos")
  revalidatePath("/coordenador/professores")
  revalidatePath("/coordenador/coordenadores")
  return { success: true }
}

export async function regerarSenha(id: string) {
  const session = await auth()
  requireCoordenador(session)
  const senhaPlain   = gerarSenha()
  const passwordHash = await bcrypt.hash(senhaPlain, 12)
  await prisma.user.update({ where: { id: BigInt(id) }, data: { passwordHash, tempPassword: senhaPlain } })
  return { success: true, data: { senhaGerada: senhaPlain } }
}
