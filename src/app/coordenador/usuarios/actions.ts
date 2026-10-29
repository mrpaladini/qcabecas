"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { Role, Prisma } from "@prisma/client"
import { randomBytes } from "crypto"
import { encryptTemp, decryptTemp } from "@/lib/crypto"
import { parseSeries, parseDisponibilidade } from "@/lib/professor"
import { registrarAuditoria, quem, fmtMoeda } from "@/lib/audit"

const PAPEL: Record<string, string> = { ALUNO: "aluno", PROFESSOR: "professor", COORDENADOR: "coordenador" }

function requireCoordenador(session: any) {
  if (!session?.user || session.user.role !== "COORDENADOR")
    throw new Error("Acesso negado")
}

function gerarSenha(tamanho = 8): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(tamanho)
  return Array.from(bytes, b => chars[b % chars.length]).join("")
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

const ProfessorExtraSchema = z.object({
  phone2:        str(20),
  escolaAtuacao: str(200),
})

const UsuarioCreateSchema = z.object({
  name:            z.string().min(3).max(150),
  email:           z.string().email(),
  phone:           str(20),
  role:            z.nativeEnum(Role),
  precoPresencial: z.coerce.number().min(0).optional(),
  precoVirtual:    z.coerce.number().min(0).optional(),
}).merge(AlunoExtraSchema).merge(ProfessorExtraSchema)

const UsuarioUpdateSchema = z.object({
  name:            z.string().min(3).max(150),
  email:           z.string().email(),
  phone:           str(20),
  precoPresencial: z.coerce.number().min(0).optional(),
  precoVirtual:    z.coerce.number().min(0).optional(),
}).merge(AlunoExtraSchema).merge(ProfessorExtraSchema)

function professorFromForm(formData: FormData) {
  return {
    phone2:        formData.get("phone2")        || undefined,
    escolaAtuacao: formData.get("escolaAtuacao") || undefined,
  }
}

/** Campos complexos do professor (JSON / checkboxes) — já validados. */
function professorJsonFromForm(formData: FormData) {
  const series = parseSeries(formData.get("seriesAtendidas"))
  const disp   = parseDisponibilidade(formData.get("disponibilidade"))
  const bool = (k: string) => ["on", "true", "1"].includes(String(formData.get(k) ?? ""))
  return {
    seriesAtendidas:  series.length ? series : Prisma.DbNull,
    disponibilidade:  disp.length ? disp : Prisma.DbNull,
    atendePresencial: bool("atendePresencial"),
    atendeOnline:     bool("atendeOnline"),
  }
}

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
    ...professorFromForm(formData),
  })
  if (!parsed.success) return { success: false, error: "Dados inválidos: " + JSON.stringify(parsed.error.flatten().fieldErrors) }

  const existe = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existe) return { success: false, error: "E-mail já cadastrado" }

  const senhaPlain   = gerarSenha()
  const passwordHash = await bcrypt.hash(senhaPlain, 12)

  const { name, email, phone, precoPresencial, precoVirtual,
    responsavelNome, cpfResponsavel, responsavelTelefone,
    rua, bairro, cidade, cep, referenciaEndereco,
    escola, serie, observacoes, phone2, escolaAtuacao } = parsed.data

  // created_at (data de cadastro) é preenchido automaticamente pelo banco
  const user = await prisma.user.create({
    data: {
      name, email, phone, role,
      passwordHash,
      tempPassword: encryptTemp(senhaPlain),
      consentimentoLgpd: true,
      precoPresencial: precoPresencial ?? null,
      precoVirtual:    precoVirtual ?? null,
      observacoes:     observacoes ?? null,
      ...(role === "ALUNO" ? {
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
      } : {}),
      ...(role === "PROFESSOR" ? {
        phone2:        phone2 ?? null,
        escolaAtuacao: escolaAtuacao ?? null,
        ...professorJsonFromForm(formData),
      } : {}),
    },
  })

  await registrarAuditoria(session, "USUARIO_CRIADO", "Usuario", user.id,
    `${quem(session)} cadastrou ${PAPEL[role] ?? "usuário"} ${name} (${email})`)

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
    ...professorFromForm(formData),
  })
  if (!parsed.success) return { success: false, error: "Dados inválidos: verifique nome (mín. 3 letras), e-mail e valores" }

  const user = await prisma.user.findUnique({ where: { id: BigInt(id) }, select: { role: true, email: true, name: true, precoPresencial: true, precoVirtual: true } })
  if (!user) return { success: false, error: "Usuário não encontrado" }

  if (parsed.data.email !== user.email) {
    const emailExiste = await prisma.user.findFirst({ where: { email: parsed.data.email, id: { not: BigInt(id) } } })
    if (emailExiste) return { success: false, error: "E-mail já cadastrado para outro usuário" }
  }

  const { name, email, phone, precoPresencial, precoVirtual,
    responsavelNome, cpfResponsavel, responsavelTelefone,
    rua, bairro, cidade, cep, referenciaEndereco,
    escola, serie, observacoes, phone2, escolaAtuacao } = parsed.data

  // Só grava os campos que pertencem ao perfil do usuário — assim a edição
  // de um professor nunca apaga dados de aluno e vice-versa.
  await prisma.user.update({
    where: { id: BigInt(id) },
    data: {
      name, email,
      phone:           phone ?? null,
      ...(user.role !== "COORDENADOR" ? {
        precoPresencial: precoPresencial ?? null,
        precoVirtual:    precoVirtual ?? null,
        observacoes:     observacoes ?? null,
      } : {}),
      ...(user.role === "ALUNO" ? {
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
      } : {}),
      ...(user.role === "PROFESSOR" ? {
        phone2:        phone2 ?? null,
        escolaAtuacao: escolaAtuacao ?? null,
        ...professorJsonFromForm(formData),
      } : {}),
    },
  })

  const mud: string[] = []
  if (user.name !== name) mud.push(`nome ${user.name} → ${name}`)
  if (user.email !== email) mud.push(`e-mail ${user.email} → ${email}`)
  if (user.role !== "COORDENADOR") {
    if (Number(user.precoPresencial ?? 0) !== Number(precoPresencial ?? 0))
      mud.push(`valor presencial ${fmtMoeda(Number(user.precoPresencial ?? 0))} → ${fmtMoeda(Number(precoPresencial ?? 0))}`)
    if (Number(user.precoVirtual ?? 0) !== Number(precoVirtual ?? 0))
      mud.push(`valor online ${fmtMoeda(Number(user.precoVirtual ?? 0))} → ${fmtMoeda(Number(precoVirtual ?? 0))}`)
  }
  await registrarAuditoria(session, "USUARIO_ALTERADO", "Usuario", id,
    `${quem(session)} alterou o cadastro do ${PAPEL[user.role] ?? "usuário"} ${name}` + (mud.length ? `: ${mud.join("; ")}` : ""))

  revalidatePath("/coordenador/alunos")
  revalidatePath("/coordenador/professores")
  revalidatePath("/coordenador/coordenadores")
  return { success: true }
}

export async function desativarUsuario(id: string) {
  const session = await auth()
  requireCoordenador(session)
  const desat = await prisma.user.update({ where: { id: BigInt(id) }, data: { deletedAt: new Date() } })
  await registrarAuditoria(session, "USUARIO_DESATIVADO", "Usuario", id,
    `${quem(session)} desativou o ${PAPEL[desat.role] ?? "usuário"} ${desat.name}`)
  revalidatePath("/coordenador/alunos")
  revalidatePath("/coordenador/professores")
  revalidatePath("/coordenador/coordenadores")
  return { success: true }
}

export async function reativarUsuario(id: string) {
  const session = await auth()
  requireCoordenador(session)
  const reat = await prisma.user.update({ where: { id: BigInt(id) }, data: { deletedAt: null } })
  await registrarAuditoria(session, "USUARIO_REATIVADO", "Usuario", id,
    `${quem(session)} reativou o ${PAPEL[reat.role] ?? "usuário"} ${reat.name}`)
  revalidatePath("/coordenador/alunos")
  revalidatePath("/coordenador/professores")
  revalidatePath("/coordenador/coordenadores")
  return { success: true }
}

/**
 * Exclusão definitiva — só é permitida se o usuário não tiver nenhum histórico
 * (aulas, pagamentos, lançamentos). Com histórico, o caminho é "Desativar",
 * que preserva todos os dados.
 */
export async function excluirUsuario(id: string) {
  const session = await auth()
  requireCoordenador(session)

  const userId = BigInt(id)
  if (String((session as any).user.id) === id) return { success: false, error: "Você não pode excluir o próprio usuário" }

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      name: true,
      _count: {
        select: {
          appointmentsAsAluno: true,
          appointmentsAsProfessor: true,
          appointmentsAsCoordenador: true,
          materials: true,
          pagamentosRecebidos: true,
          pagamentosGerados: true,
          transacoesRegistradas: true,
          ajustesProfessor: true,
          ajustesRegistrados: true,
        },
      },
      contaAluno: { select: { id: true, _count: { select: { transacoes: true } } } },
    },
  })
  if (!u) return { success: false, error: "Usuário não encontrado" }

  const c = u._count
  const aulas = c.appointmentsAsAluno + c.appointmentsAsProfessor + c.appointmentsAsCoordenador
  const financeiro = c.pagamentosRecebidos + c.pagamentosGerados + c.transacoesRegistradas +
    c.ajustesProfessor + c.ajustesRegistrados + (u.contaAluno?._count.transacoes ?? 0)
  if (aulas > 0 || financeiro > 0 || c.materials > 0) {
    const partes = [
      aulas > 0 ? `${aulas} aula(s)` : null,
      financeiro > 0 ? `${financeiro} lançamento(s) financeiro(s)` : null,
      c.materials > 0 ? `${c.materials} material(is)` : null,
    ].filter(Boolean).join(", ")
    return {
      success: false,
      error: `Não é possível excluir: há ${partes} vinculados. Use "Desativar" para manter o histórico.`,
    }
  }

  await prisma.$transaction(async tx => {
    await tx.subjectTeacher.deleteMany({ where: { userId } })
    if (u.contaAluno) await tx.contaAluno.delete({ where: { id: u.contaAluno.id } })
    await tx.user.delete({ where: { id: userId } })
  })
  await registrarAuditoria(session, "USUARIO_EXCLUIDO", "Usuario", id,
    `${quem(session)} excluiu definitivamente o ${PAPEL[u.role] ?? "usuário"} ${u.name}`)

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
  const alvo = await prisma.user.update({ where: { id: BigInt(id) }, data: { passwordHash, tempPassword: encryptTemp(senhaPlain) } })
  await registrarAuditoria(session, "SENHA_REGERADA", "Usuario", id,
    `${quem(session)} gerou nova senha para o ${PAPEL[alvo.role] ?? "usuário"} ${alvo.name}`)
  return { success: true, data: { senhaGerada: senhaPlain } }
}
