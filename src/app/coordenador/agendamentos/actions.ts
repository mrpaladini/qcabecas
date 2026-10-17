"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { resend, FROM_EMAIL } from "@/lib/resend"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const FIELD_LABELS: Record<string, string> = {
  alunoId:        "Aluno",
  professorId:    "Professor",
  subjectId:      "Disciplina",
  roomId:         "Sala",
  dataHora:       "Data e hora",
  duracaoMinutos: "Duração",
  observacoes:    "Observações",
  valorCobrado:   "Valor cobrado",
  status:         "Status",
}

function buildFieldErrors(zodError: z.ZodError): Record<string, string> {
  const flat = zodError.flatten().fieldErrors
  return Object.fromEntries(
    Object.entries(flat).map(([k, msgs]) => [k, (msgs?.[0] ? `${FIELD_LABELS[k] ?? k}: ${msgs[0]}` : `${FIELD_LABELS[k] ?? k} inválido`)])
  )
}

function sanitizeValor(raw: FormDataEntryValue | null): string | undefined {
  if (!raw) return undefined
  const cleaned = String(raw).replace(/[^\d,\.]/g, "").replace(",", ".")
  const num = parseFloat(cleaned)
  return isNaN(num) ? undefined : String(num)
}

const AgendamentoSchema = z.object({
  alunoId:        z.coerce.bigint().positive({ message: "Selecione um aluno" }),
  professorId:    z.coerce.bigint().positive({ message: "Selecione um professor" }),
  subjectId:      z.coerce.number().int().positive().optional(),
  roomId:         z.coerce.number().int().positive().optional(),
  dataHora:       z.string().min(1, "Informe a data e hora"),
  duracaoMinutos: z.coerce.number().int().refine(v => [60, 90, 120, 150, 180].includes(v), {
    message: "Escolha 1h, 1h30, 2h, 2h30 ou 3h",
  }).default(60),
  observacoes:    z.string().max(500).optional(),
  valorCobrado:   z.coerce.number({ message: "Informe o valor da aula" })
                    .positive("Informe o valor da aula"),
  status:         z.enum(["PENDENTE", "AGENDADO"]).default("PENDENTE"),
})

// Status que ocupam o horário do professor/sala (bloqueiam conflito)
const STATUS_ATIVOS = ["PENDENTE", "AGENDADO"] as const

async function notificarAula(
  tipo: "PENDENTE" | "AGENDADO",
  aluno: { name: string; email: string },
  professor: { name: string; email: string },
  disciplinaNome: string,
  dataHora: Date,
) {
  const dataFormatada = dataHora.toLocaleString("pt-BR", {
    dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo",
  })
  const pendente = tipo === "PENDENTE"
  await Promise.allSettled([
    resend.emails.send({
      from: FROM_EMAIL, to: aluno.email,
      subject: pendente ? `⏳ Aula pré-agendada: ${disciplinaNome} — confirme sua presença` : `✅ Aula agendada: ${disciplinaNome}`,
      html: pendente
        ? `<p>Olá <strong>${aluno.name}</strong>,<br>Reservamos uma aula de <strong>${disciplinaNome}</strong> para <strong>${dataFormatada}</strong> com o Prof. ${professor.name}.<br>Ela está <strong>pendente de confirmação</strong> — responda à coordenação para confirmar.</p>`
        : `<p>Olá <strong>${aluno.name}</strong>,<br>Sua aula de <strong>${disciplinaNome}</strong> foi agendada para <strong>${dataFormatada}</strong> com o Prof. ${professor.name}.</p>`,
    }),
    resend.emails.send({
      from: FROM_EMAIL, to: professor.email,
      subject: pendente ? `⏳ Aula a confirmar: ${disciplinaNome} com ${aluno.name}` : `📅 Nova aula: ${disciplinaNome} com ${aluno.name}`,
      html: pendente
        ? `<p>Olá <strong>${professor.name}</strong>,<br>Há uma aula de <strong>${disciplinaNome}</strong> com ${aluno.name} pré-agendada para <strong>${dataFormatada}</strong>.<br>Ela está <strong>pendente de confirmação</strong> — responda à coordenação para confirmar.</p>`
        : `<p>Olá <strong>${professor.name}</strong>,<br>Você tem uma nova aula de <strong>${disciplinaNome}</strong> com ${aluno.name} em <strong>${dataFormatada}</strong>.</p>`,
    }),
  ])
}

async function registrarEvidencia(
  appointmentId: bigint,
  novoStatus: "CONCLUIDO" | "CANCELADO",
) {
  const apt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      aluno:     { select: { name: true } },
      professor: { select: { name: true, precoPresencial: true, precoVirtual: true } },
      room:      { select: { type: true } },
    },
  })
  if (!apt) return

  const duracaoHoras   = apt.duracaoMinutos / 60   // ex: 90min → 1.5h
  const isPresencial   = apt.room?.type === "PRESENCIAL"
  // Usa o preço do tipo da sala; se não houver sala, prefere precoPresencial
  const precoPresencial = Number(apt.professor.precoPresencial ?? 0)
  const precoVirtual    = Number(apt.professor.precoVirtual ?? precoPresencial)
  const precoHora      = isPresencial ? precoPresencial : (apt.room ? precoVirtual : precoPresencial)
  const valorProfessor  = Math.round(duracaoHoras * precoHora * 100) / 100
  const valorAluno     = Number(apt.valorCobrado ?? 0)

  await prisma.evidencia.upsert({
    where:  { appointmentId },
    update: {
      status:         novoStatus,
      valorProfessor,
      valorAluno,
      salaTipo:       apt.room?.type ?? null,
      duracaoMinutos: apt.duracaoMinutos,
      updatedAt:      new Date(),
    },
    create: {
      appointmentId,
      alunoNome:      apt.aluno.name,
      professorNome:  apt.professor.name,
      dataAula:       apt.dataHora,
      duracaoMinutos: apt.duracaoMinutos,
      disciplina:     apt.disciplina,
      salaTipo:       apt.room?.type ?? null,
      valorProfessor,
      valorAluno,
      status:         novoStatus,
    },
  })
}

export async function criarAgendamento(formData: FormData) {
  const session = await auth()
  if (!session?.user) return { success: false, error: "Não autenticado" }
  if (session.user.role !== "COORDENADOR") return { success: false, error: "Acesso negado" }

  const raw = {
    alunoId:        formData.get("alunoId"),
    professorId:    formData.get("professorId"),
    subjectId:      formData.get("subjectId") || undefined,
    roomId:         formData.get("roomId") || undefined,
    dataHora:       formData.get("dataHora"),
    duracaoMinutos: formData.get("duracaoMinutos"),
    observacoes:    formData.get("observacoes") || undefined,
    valorCobrado:   sanitizeValor(formData.get("valorCobrado")),
    status:         formData.get("status") || undefined,
  }

  const parsed = AgendamentoSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors = buildFieldErrors(parsed.error)
    const firstMsg = Object.values(fieldErrors)[0] ?? "Verifique os campos"
    return { success: false as const, error: firstMsg, fieldErrors }
  }

  const { alunoId, professorId, subjectId, roomId, dataHora, duracaoMinutos, observacoes, valorCobrado, status } = parsed.data

  // Buscar nome da disciplina (para o campo legado + e-mail)
  const subject = subjectId ? await prisma.subject.findUnique({ where: { id: subjectId } }) : null
  const disciplinaNome = subject?.name ?? "Aula"

  const [aluno, professor] = await Promise.all([
    prisma.user.findFirst({ where: { id: alunoId, role: "ALUNO", deletedAt: null } }),
    prisma.user.findFirst({ where: { id: professorId, role: "PROFESSOR", deletedAt: null } }),
  ])
  if (!aluno)    return { success: false, error: "Aluno não encontrado" }
  if (!professor) return { success: false, error: "Professor não encontrado" }

  // Calcular horário de início e fim da nova aula
  const novoInicio = new Date(dataHora)
  const novoFim    = new Date(novoInicio.getTime() + duracaoMinutos * 60_000)

  // Verificar conflito de professor (mesmo professor, horário sobreposto)
  type ConflictRow = { id: bigint }
  const conflitoProfessor = await prisma.$queryRaw<ConflictRow[]>`
    SELECT id FROM appointments
    WHERE professor_id = ${professorId}
      AND status IN ('PENDENTE', 'AGENDADO')
      AND data_hora < ${novoFim}
      AND DATE_ADD(data_hora, INTERVAL duracao_minutos MINUTE) > ${novoInicio}
    LIMIT 1
  `
  if (conflitoProfessor.length > 0) {
    return {
      success: false,
      error: `Professor ${professor.name} já tem uma aula marcada neste horário. Escolha outro horário.`,
    }
  }

  // Verificar conflito de sala (mesma sala, horário sobreposto)
  if (roomId) {
    const conflitoSala = await prisma.$queryRaw<ConflictRow[]>`
      SELECT id FROM appointments
      WHERE room_id = ${roomId}
        AND status IN ('PENDENTE', 'AGENDADO')
        AND data_hora < ${novoFim}
        AND DATE_ADD(data_hora, INTERVAL duracao_minutos MINUTE) > ${novoInicio}
      LIMIT 1
    `
    if (conflitoSala.length > 0) {
      const sala = await prisma.room.findUnique({ where: { id: roomId }, select: { name: true } })
      return {
        success: false,
        error: `Sala "${sala?.name}" já está ocupada neste horário. Escolha outra sala ou horário.`,
      }
    }
  }

  const appointment = await prisma.$transaction(async (tx) => {
    return tx.appointment.create({
      data: {
        coordenadorId: BigInt(session.user.id),
        alunoId,
        professorId,
        subjectId: subjectId ?? null,
        roomId:    roomId ?? null,
        disciplina:   disciplinaNome,
        dataHora:     new Date(dataHora),
        duracaoMinutos,
        observacoes:  observacoes ?? null,
        valorCobrado,
        status,
      },
    })
  })

  await notificarAula(status, aluno, professor, disciplinaNome, new Date(dataHora))

  revalidatePath("/coordenador/agendamentos")
  return { success: true, data: { appointmentId: String(appointment.id) } }
}

export async function cancelarAgendamento(appointmentId: bigint) {
  const session = await auth()
  if (!session?.user) return { success: false, error: "Não autenticado" }
  if (session.user.role !== "COORDENADOR") return { success: false, error: "Acesso negado" }

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, status: { in: [...STATUS_ATIVOS] } },
  })
  if (!appointment) return { success: false, error: "Agendamento não encontrado ou já cancelado" }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CANCELADO", cancelledAt: new Date() },
  })

  revalidatePath("/coordenador/agendamentos")
  return { success: true }
}

const AtualizarAgendamentoSchema = z.object({
  status:         z.enum(["PENDENTE", "AGENDADO", "CONCLUIDO", "CANCELADO"]),
  dataHora:       z.string().min(1),
  duracaoMinutos: z.coerce.number().int().refine(v => [60, 90, 120, 150, 180].includes(v), {
    message: "Duração deve ser 1h, 1h30, 2h, 2h30 ou 3h",
  }),
  roomId:         z.coerce.number().int().positive().optional(),
  observacoes:    z.string().max(500).optional(),
  valorCobrado:   z.coerce.number().min(0).optional(),
})

export async function atualizarAgendamento(appointmentId: string, formData: FormData) {
  const session = await auth()
  if (!session?.user) return { success: false, error: "Não autenticado" }
  if (session.user.role !== "COORDENADOR") return { success: false, error: "Acesso negado" }

  const parsed = AtualizarAgendamentoSchema.safeParse({
    status:         formData.get("status"),
    dataHora:       formData.get("dataHora"),
    duracaoMinutos: formData.get("duracaoMinutos"),
    roomId:         formData.get("roomId") || undefined,
    observacoes:    formData.get("observacoes") || undefined,
    valorCobrado:   sanitizeValor(formData.get("valorCobrado")),
  })
  if (!parsed.success) {
    const fieldErrors = buildFieldErrors(parsed.error)
    const firstMsg = Object.values(fieldErrors)[0] ?? "Verifique os campos"
    return { success: false as const, error: firstMsg, fieldErrors }
  }

  const apt = await prisma.appointment.findUnique({ where: { id: BigInt(appointmentId) } })
  if (!apt) return { success: false, error: "Agendamento não encontrado" }

  const { status, dataHora, duracaoMinutos, roomId, observacoes, valorCobrado } = parsed.data

  // Valor obrigatório (só dispensado ao cancelar a aula)
  const valorFinal = valorCobrado ?? (apt.valorCobrado ? Number(apt.valorCobrado) : undefined)
  if (status !== "CANCELADO" && !(valorFinal && valorFinal > 0)) {
    const msg = "Valor cobrado: informe o valor da aula"
    return { success: false as const, error: msg, fieldErrors: { valorCobrado: msg } }
  }

  const novoInicio = new Date(dataHora)
  const novoFim    = new Date(novoInicio.getTime() + duracaoMinutos * 60_000)
  const id         = BigInt(appointmentId)

  // Verificar conflito de professor somente se a aula continuará AGENDADA e o horário mudou
  if (status === "AGENDADO" || status === "PENDENTE") {
    type ConflictRow = { id: bigint }
    const conflitoProfessor = await prisma.$queryRaw<ConflictRow[]>`
      SELECT id FROM appointments
      WHERE professor_id = ${apt.professorId}
        AND status IN ('PENDENTE', 'AGENDADO')
        AND id != ${id}
        AND data_hora < ${novoFim}
        AND DATE_ADD(data_hora, INTERVAL duracao_minutos MINUTE) > ${novoInicio}
      LIMIT 1
    `
    if (conflitoProfessor.length > 0)
      return { success: false, error: "Professor já tem outra aula agendada neste horário." }

    if (roomId) {
      const conflitoSala = await prisma.$queryRaw<ConflictRow[]>`
        SELECT id FROM appointments
        WHERE room_id = ${roomId}
          AND status IN ('PENDENTE', 'AGENDADO')
          AND id != ${id}
          AND data_hora < ${novoFim}
          AND DATE_ADD(data_hora, INTERVAL duracao_minutos MINUTE) > ${novoInicio}
        LIMIT 1
      `
      if (conflitoSala.length > 0)
        return { success: false, error: "Sala já está ocupada neste horário." }
    }
  }

  await prisma.appointment.update({
    where: { id },
    data: {
      status,
      dataHora:       novoInicio,
      duracaoMinutos,
      roomId:         roomId ?? null,
      observacoes:    observacoes ?? null,
      valorCobrado:   valorCobrado ?? apt.valorCobrado,
      cancelledAt:    status === "CANCELADO" ? new Date() : (status === "AGENDADO" || status === "PENDENTE" ? null : apt.cancelledAt),
    },
  })

  // Pendente → Agendado: avisa aluno e professor que a aula foi confirmada
  if (apt.status === "PENDENTE" && status === "AGENDADO") {
    await enviarConfirmacao(id)
  }

  if (status === "CONCLUIDO" || status === "CANCELADO") {
    await registrarEvidencia(id, status)
  }

  // Débito automático na conta do aluno ao concluir
  if (status === "CONCLUIDO") {
    const valorAula = Number(valorCobrado ?? apt.valorCobrado ?? 0)
    if (valorAula > 0) {
      const aptFull = await prisma.appointment.findUnique({
        where: { id },
        include: { aluno: { select: { id: true } } },
      })
      if (aptFull) {
        const conta = await prisma.contaAluno.upsert({
          where:  { alunoId: aptFull.aluno.id },
          update: {},
          create: { alunoId: aptFull.aluno.id, saldo: 0 },
        })
        const jaExiste = await prisma.transacaoAluno.findUnique({ where: { appointmentId: id } })
        if (!jaExiste) {
          await prisma.$transaction(async tx => {
            await tx.transacaoAluno.create({
              data: {
                contaId:       conta.id,
                tipo:          "DEBITO",
                valor:         valorAula,
                descricao:     `Aula de ${apt.disciplina}`,
                appointmentId: id,
                registradoPor: BigInt(session.user.id),
              },
            })
            await tx.contaAluno.update({
              where: { id: conta.id },
              data:  { saldo: { decrement: valorAula } },
            })
          })
        }
      }
    }
    revalidatePath("/coordenador/financas/contas-a-receber")
  }

  revalidatePath("/coordenador/agendamentos")
  revalidatePath("/coordenador/calendario")
  return { success: true }
}

async function enviarConfirmacao(id: bigint) {
  const full = await prisma.appointment.findUnique({
    where: { id },
    include: {
      aluno:     { select: { name: true, email: true } },
      professor: { select: { name: true, email: true } },
      subject:   { select: { name: true } },
    },
  })
  if (full) await notificarAula("AGENDADO", full.aluno, full.professor, full.subject?.name ?? full.disciplina, full.dataHora)
}

/** Atalho da lista: marca uma aula Pendente como Agendada (confirmada). */
export async function confirmarAgendamento(appointmentId: string) {
  const session = await auth()
  if (!session?.user) return { success: false, error: "Não autenticado" }
  if ((session.user as any).role !== "COORDENADOR") return { success: false, error: "Acesso negado" }

  const id = BigInt(appointmentId)
  const apt = await prisma.appointment.findUnique({ where: { id } })
  if (!apt) return { success: false, error: "Agendamento não encontrado" }
  if (apt.status !== "PENDENTE") return { success: false, error: "Somente aulas pendentes podem ser confirmadas" }
  if (!apt.valorCobrado || Number(apt.valorCobrado) <= 0)
    return { success: false, error: "Informe o valor da aula (Editar) antes de confirmar" }

  await prisma.appointment.update({ where: { id }, data: { status: "AGENDADO" } })
  await enviarConfirmacao(id)

  revalidatePath("/coordenador/agendamentos")
  revalidatePath("/coordenador/calendario")
  return { success: true }
}
