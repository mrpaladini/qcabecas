"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { resend, FROM_EMAIL } from "@/lib/resend"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { registrarAuditoria, quem, primeiroNome, fmtDataHoraAudit, fmtMoeda } from "@/lib/audit"

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
  coordenadorId:  "Coordenador",
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SessionLike = any

function fmtDuracaoTxt(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`
}

/**
 * Procura outra aula ativa (Pendente/Agendada) do mesmo ALUNO com horário
 * sobreposto. `ignorarId` = a própria aula, na edição.
 */
async function conflitoAluno(alunoId: bigint, inicio: Date, fim: Date, ignorarId?: bigint) {
  type Row = { id: bigint; disciplina: string; data_hora: Date; duracao_minutos: number; professor: string }
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT a.id, a.disciplina, a.data_hora, a.duracao_minutos, u.name AS professor
    FROM appointments a
    JOIN users u ON u.id = a.professor_id
    WHERE a.aluno_id = ${alunoId}
      AND a.status IN ('PENDENTE', 'AGENDADO')
      AND a.id != ${ignorarId ?? BigInt(0)}
      AND a.data_hora < ${fim}
      AND DATE_ADD(a.data_hora, INTERVAL a.duracao_minutos MINUTE) > ${inicio}
    LIMIT 1
  `
  if (rows.length === 0) return null
  const r = rows[0]
  const ini = new Date(r.data_hora)
  const fimR = new Date(ini.getTime() + Number(r.duracao_minutos) * 60_000)
  const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
  const dia  = ini.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
  return `${r.disciplina} em ${dia}, das ${hora(ini)} às ${hora(fimR)} (Prof. ${r.professor})`
}

/** Valor que o professor recebe pela aula (preço/hora do cadastro × duração). */
function calcularValorProfessor(apt: {
  duracaoMinutos: number
  room: { type: string } | null
  professor: { precoPresencial: unknown; precoVirtual: unknown }
}) {
  const duracaoHoras    = apt.duracaoMinutos / 60   // ex: 90min → 1.5h
  const isPresencial    = apt.room?.type === "PRESENCIAL"
  // Usa o preço do tipo da sala; se não houver sala, prefere precoPresencial
  const precoPresencial = Number(apt.professor.precoPresencial ?? 0)
  const precoVirtual    = Number(apt.professor.precoVirtual ?? precoPresencial)
  const precoHora       = isPresencial ? precoPresencial : (apt.room ? precoVirtual : precoPresencial)
  return Math.round(duracaoHoras * precoHora * 100) / 100
}

/**
 * Mantém o financeiro coerente com o status da aula.
 *
 * REGRA: só aula CONCLUÍDA gera cobrança ao aluno (débito na conta) e
 * pagamento ao professor (evidência em Contas a Pagar). Aula CANCELADA não
 * gera nenhum dos dois — e, se a aula já estava concluída, tudo é estornado:
 *  - débito do aluno → removido e saldo devolvido;
 *  - evidência ainda não paga → zerada (sai de Contas a Pagar);
 *  - evidência já paga ao professor → lança um DÉBITO de ajuste para o
 *    próximo pagamento (o dinheiro já saiu, então desconta depois).
 */
async function sincronizarFinanceiro(
  id: bigint,
  statusAnterior: string,
  novoStatus: string,
  session: SessionLike,
): Promise<string[]> {
  const notas: string[] = []
  const apt = await prisma.appointment.findUnique({
    where: { id },
    include: {
      aluno:     { select: { id: true, name: true } },
      professor: { select: { id: true, name: true, precoPresencial: true, precoVirtual: true } },
      room:      { select: { type: true } },
    },
  })
  if (!apt) return notas

  const registradoPor = BigInt((session?.user as any).id)
  const evid = await prisma.evidencia.findUnique({ where: { appointmentId: id } })
  const dataCurta = apt.dataHora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })

  if (novoStatus === "CONCLUIDO") {
    // ── Professor: cria/atualiza a evidência ──────────────────────────
    const valorAluno = Number(apt.valorCobrado ?? 0)
    if (!evid) {
      await prisma.evidencia.create({
        data: {
          appointmentId:  id,
          alunoNome:      apt.aluno.name,
          professorNome:  apt.professor.name,
          dataAula:       apt.dataHora,
          duracaoMinutos: apt.duracaoMinutos,
          disciplina:     apt.disciplina,
          salaTipo:       apt.room?.type ?? null,
          valorProfessor: calcularValorProfessor(apt),
          valorAluno,
          status:         "CONCLUIDO",
        },
      })
    } else if (evid.pagoProfessor) {
      // Já paga: se havia sido cancelada (e descontada), devolve o valor ao professor
      if (evid.status !== "CONCLUIDO") {
        await prisma.ajusteProfessor.create({
          data: {
            professorId: apt.professor.id,
            tipo:        "CREDITO",
            valor:       Number(evid.valorProfessor),
            descricao:   `Reversão: aula de ${apt.disciplina} em ${dataCurta} voltou a ser concluída`,
            registradoPor,
          },
        })
        notas.push("crédito de ajuste lançado ao professor")
      }
      await prisma.evidencia.update({ where: { id: evid.id }, data: { status: "CONCLUIDO", valorAluno } })
    } else {
      // Não paga: recalcula o valor do professor só se for (re)conclusão
      // ou se mudou duração/sala — preserva ajustes manuais feitos em Finanças.
      const mudou = evid.status !== "CONCLUIDO"
        || evid.duracaoMinutos !== apt.duracaoMinutos
        || (evid.salaTipo ?? null) !== (apt.room?.type ?? null)
      await prisma.evidencia.update({
        where: { id: evid.id },
        data: {
          status:         "CONCLUIDO",
          dataAula:       apt.dataHora,
          duracaoMinutos: apt.duracaoMinutos,
          salaTipo:       apt.room?.type ?? null,
          valorAluno,
          ...(mudou ? { valorProfessor: calcularValorProfessor(apt) } : {}),
        },
      })
    }

    // ── Aluno: débito na conta (cria ou corrige o valor) ──────────────
    if (valorAluno > 0) {
      const conta = await prisma.contaAluno.upsert({
        where:  { alunoId: apt.aluno.id },
        update: {},
        create: { alunoId: apt.aluno.id, saldo: 0 },
      })
      const existente = await prisma.transacaoAluno.findUnique({ where: { appointmentId: id } })
      if (!existente) {
        await prisma.$transaction(async tx => {
          await tx.transacaoAluno.create({
            data: {
              contaId: conta.id, tipo: "DEBITO", valor: valorAluno,
              descricao: `Aula de ${apt.disciplina} (${fmtDuracaoTxt(apt.duracaoMinutos)})`, appointmentId: id, registradoPor,
            },
          })
          await tx.contaAluno.update({ where: { id: conta.id }, data: { saldo: { decrement: valorAluno } } })
        })
      } else if (Number(existente.valor) !== valorAluno) {
        const diff = valorAluno - Number(existente.valor)
        await prisma.$transaction(async tx => {
          await tx.transacaoAluno.update({
            where: { id: existente.id },
            data:  { valor: valorAluno, descricao: `Aula de ${apt.disciplina} (${fmtDuracaoTxt(apt.duracaoMinutos)})` },
          })
          await tx.contaAluno.update({ where: { id: existente.contaId }, data: { saldo: { decrement: diff } } })
        })
      }
    }
    return notas
  }

  // ── Status diferente de CONCLUÍDO: não pode haver cobrança nem pagamento ──
  const transacao = await prisma.transacaoAluno.findUnique({ where: { appointmentId: id } })
  if (transacao) {
    await prisma.$transaction(async tx => {
      await tx.transacaoAluno.delete({ where: { id: transacao.id } })
      await tx.contaAluno.update({
        where: { id: transacao.contaId },
        data:  { saldo: transacao.tipo === "DEBITO" ? { increment: transacao.valor } : { decrement: transacao.valor } },
      })
    })
    notas.push(`cobrança de ${fmtMoeda(Number(transacao.valor))} estornada da conta do aluno`)
  }

  if (evid) {
    if (evid.pagoProfessor) {
      if (evid.status === "CONCLUIDO") {
        await prisma.ajusteProfessor.create({
          data: {
            professorId: apt.professor.id,
            tipo:        "DEBITO",
            valor:       Number(evid.valorProfessor),
            descricao:   `Estorno: aula de ${apt.disciplina} (${apt.aluno.name}) em ${dataCurta} ${novoStatus === "CANCELADO" ? "cancelada" : "reaberta"} após pagamento`,
            registradoPor,
          },
        })
        notas.push(`débito de ${fmtMoeda(Number(evid.valorProfessor))} lançado ao professor (aula já havia sido paga)`)
      }
      // mantém valores (histórico do pagamento), só muda o status
      await prisma.evidencia.update({ where: { id: evid.id }, data: { status: novoStatus } })
    } else if (novoStatus === "CANCELADO") {
      await prisma.evidencia.update({
        where: { id: evid.id },
        data:  { status: "CANCELADO", valorProfessor: 0, valorAluno: 0 },
      })
      if (evid.status === "CONCLUIDO") notas.push("aula removida de Contas a Pagar")
    } else {
      // voltou a Pendente/Agendado: remove a evidência (será recriada ao concluir)
      await prisma.evidencia.delete({ where: { id: evid.id } })
      if (evid.status === "CONCLUIDO") notas.push("aula removida de Contas a Pagar")
    }
  }
  void statusAnterior
  return notas
}

/** Garante que o coordenador informado existe e está ativo. */
async function validarCoordenador(raw: FormDataEntryValue | null, fallback: bigint | null) {
  const txt = raw ? String(raw).trim() : ""
  if (!txt) return fallback ? { id: fallback } : null
  let id: bigint
  try { id = BigInt(txt) } catch { return null }
  const c = await prisma.user.findFirst({ where: { id, role: "COORDENADOR", deletedAt: null }, select: { id: true, name: true } })
  return c
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

  // Coordenador que acompanha a aula (padrão: quem está agendando)
  const coordenador = await validarCoordenador(formData.get("coordenadorId"), BigInt(session.user.id))
  if (!coordenador) {
    const msg = "Coordenador: selecione um coordenador ativo"
    return { success: false as const, error: msg, fieldErrors: { coordenadorId: msg } }
  }

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

  // Verificar conflito de aluno (mesmo aluno, horário sobreposto)
  const choqueAluno = await conflitoAluno(alunoId, novoInicio, novoFim)
  if (choqueAluno) {
    return {
      success: false,
      error: `Aluno ${aluno.name} já tem uma aula marcada neste horário: ${choqueAluno}. Escolha outro horário.`,
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

  const appointment = await prisma.appointment.create({
    data: {
      coordenadorId: coordenador.id,
      alunoId,
      professorId,
      subjectId: subjectId ?? null,
      roomId:    roomId ?? null,
      disciplina:   disciplinaNome,
      dataHora:     novoInicio,
      duracaoMinutos,
      observacoes:  observacoes ?? null,
      valorCobrado,
      status,
    },
  })

  const coordNome = "name" in coordenador ? coordenador.name : session.user.name ?? ""
  await registrarAuditoria(session, "AGENDAMENTO_CRIADO", "Agendamento", appointment.id,
    `${quem(session)} ${status === "PENDENTE" ? "pré-agendou" : "agendou"} aula de ${disciplinaNome} para aluno ${primeiroNome(aluno.name)} ` +
    `em ${fmtDataHoraAudit(novoInicio)} com professor ${primeiroNome(professor.name)} ` +
    `(${fmtMoeda(valorCobrado)}; coordenador ${primeiroNome(coordNome)})`)

  await notificarAula(status, aluno, professor, disciplinaNome, novoInicio)

  revalidatePath("/coordenador/agendamentos")
  return { success: true, data: { appointmentId: String(appointment.id) } }
}

export async function cancelarAgendamento(appointmentId: bigint) {
  const session = await auth()
  if (!session?.user) return { success: false, error: "Não autenticado" }
  if (session.user.role !== "COORDENADOR") return { success: false, error: "Acesso negado" }

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, status: { in: [...STATUS_ATIVOS] } },
    include: { aluno: { select: { name: true } } },
  })
  if (!appointment) return { success: false, error: "Agendamento não encontrado ou já cancelado" }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CANCELADO", cancelledAt: new Date() },
  })
  await sincronizarFinanceiro(appointmentId, appointment.status, "CANCELADO", session)

  await registrarAuditoria(session, "AGENDAMENTO_CANCELADO", "Agendamento", appointmentId,
    `${quem(session)} cancelou aula de ${appointment.disciplina} do aluno ${primeiroNome(appointment.aluno.name)} ` +
    `marcada para ${fmtDataHoraAudit(appointment.dataHora)}`)

  revalidatePath("/coordenador/agendamentos")
  revalidatePath("/coordenador/financas/contas-a-pagar")
  revalidatePath("/coordenador/financas/contas-a-receber")
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

const STATUS_TXT: Record<string, string> = {
  PENDENTE: "Pendente", AGENDADO: "Agendado", CONCLUIDO: "Concluído", CANCELADO: "Cancelado",
}

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

  const id  = BigInt(appointmentId)
  const apt = await prisma.appointment.findUnique({
    where: { id },
    include: {
      aluno:       { select: { name: true, email: true } },
      professor:   { select: { id: true, name: true, email: true } },
      coordenador: { select: { id: true, name: true } },
      room:        { select: { name: true } },
    },
  })
  if (!apt) return { success: false, error: "Agendamento não encontrado" }

  const { status, dataHora, duracaoMinutos, roomId, observacoes, valorCobrado } = parsed.data

  const coordenador = await validarCoordenador(formData.get("coordenadorId"), apt.coordenadorId)
  if (!coordenador) {
    const msg = "Coordenador: selecione um coordenador ativo"
    return { success: false as const, error: msg, fieldErrors: { coordenadorId: msg } }
  }

  // ── Troca de professor (só em aulas Pendentes/Agendadas) ──
  const profRaw = String(formData.get("professorId") ?? "").trim()
  let novoProfessor: { id: bigint; name: string; email: string } = apt.professor
  if (profRaw && profRaw !== String(apt.professorId)) {
    const ativa = (s: string) => s === "PENDENTE" || s === "AGENDADO"
    if (!ativa(apt.status) || !ativa(status)) {
      const msg = "Professor: só é possível trocar o professor de aulas pendentes ou agendadas"
      return { success: false as const, error: msg, fieldErrors: { professorId: msg } }
    }
    let profId: bigint
    try { profId = BigInt(profRaw) } catch {
      return { success: false as const, error: "Professor inválido", fieldErrors: { professorId: "Professor inválido" } }
    }
    const prof = await prisma.user.findFirst({
      where: { id: profId, role: "PROFESSOR", deletedAt: null },
      select: { id: true, name: true, email: true },
    })
    if (!prof) {
      const msg = "Professor: selecione um professor ativo"
      return { success: false as const, error: msg, fieldErrors: { professorId: msg } }
    }
    if (apt.subjectId) {
      const vinculado = await prisma.subjectTeacher.findUnique({
        where: { subjectId_userId: { subjectId: apt.subjectId, userId: profId } },
      })
      if (!vinculado) {
        const msg = `Professor: ${prof.name} não está vinculado à disciplina ${apt.disciplina} (ajuste em Disciplinas)`
        return { success: false as const, error: msg, fieldErrors: { professorId: msg } }
      }
    }
    novoProfessor = prof
  }
  const trocouProfessor = novoProfessor.id !== apt.professorId

  // Valor obrigatório (só dispensado ao cancelar a aula)
  const valorFinal = valorCobrado ?? (apt.valorCobrado ? Number(apt.valorCobrado) : undefined)
  if (status !== "CANCELADO" && !(valorFinal && valorFinal > 0)) {
    const msg = "Valor cobrado: informe o valor da aula"
    return { success: false as const, error: msg, fieldErrors: { valorCobrado: msg } }
  }

  const novoInicio = new Date(dataHora)
  const novoFim    = new Date(novoInicio.getTime() + duracaoMinutos * 60_000)

  // Verificar conflito de professor somente se a aula continuará ativa
  if (status === "AGENDADO" || status === "PENDENTE") {
    type ConflictRow = { id: bigint }
    const conflitoProfessor = await prisma.$queryRaw<ConflictRow[]>`
      SELECT id FROM appointments
      WHERE professor_id = ${novoProfessor.id}
        AND status IN ('PENDENTE', 'AGENDADO')
        AND id != ${id}
        AND data_hora < ${novoFim}
        AND DATE_ADD(data_hora, INTERVAL duracao_minutos MINUTE) > ${novoInicio}
      LIMIT 1
    `
    if (conflitoProfessor.length > 0)
      return { success: false, error: `Professor ${novoProfessor.name} já tem outra aula agendada neste horário.` }

    const choqueAluno = await conflitoAluno(apt.alunoId, novoInicio, novoFim, id)
    if (choqueAluno)
      return { success: false, error: `Aluno ${apt.aluno.name} já tem outra aula neste horário: ${choqueAluno}.` }

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

  const atualizado = await prisma.appointment.update({
    where: { id },
    data: {
      status,
      professorId:    novoProfessor.id,
      coordenadorId:  coordenador.id,
      dataHora:       novoInicio,
      duracaoMinutos,
      roomId:         roomId ?? null,
      observacoes:    observacoes ?? null,
      valorCobrado:   valorCobrado ?? apt.valorCobrado,
      cancelledAt:    status === "CANCELADO" ? (apt.cancelledAt ?? new Date()) : null,
    },
    include: { coordenador: { select: { name: true } }, room: { select: { name: true } } },
  })

  if (trocouProfessor) {
    // Avisa o novo professor e o aluno; e o professor anterior de que não dará mais esta aula
    await notificarAula(status === "PENDENTE" ? "PENDENTE" : "AGENDADO",
      { name: apt.aluno.name, email: apt.aluno.email }, novoProfessor, apt.disciplina, novoInicio)
    const quando = novoInicio.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" })
    await resend.emails.send({
      from: FROM_EMAIL, to: apt.professor.email,
      subject: `Aula reatribuída: ${apt.disciplina} com ${apt.aluno.name}`,
      html: `<p>Olá <strong>${apt.professor.name}</strong>,<br>A aula de <strong>${apt.disciplina}</strong> com ${apt.aluno.name} ` +
        `em <strong>${quando}</strong> foi passada para outro professor. Ela não está mais na sua agenda.</p>`,
    }).catch(e => console.error("[agendamento] falha ao avisar professor anterior:", e))
  } else if (apt.status === "PENDENTE" && status === "AGENDADO") {
    // Pendente → Agendado: avisa aluno e professor que a aula foi confirmada
    await enviarConfirmacao(id)
  }

  // Cobrança do aluno / pagamento do professor seguem o status
  const notasFin = (status === "CONCLUIDO" || apt.status === "CONCLUIDO" || status === "CANCELADO")
    ? await sincronizarFinanceiro(id, apt.status, status, session)
    : []

  // ── Auditoria: descreve o que mudou ──
  const mudancas: string[] = []
  if (apt.status !== status) mudancas.push(`status ${STATUS_TXT[apt.status]} → ${STATUS_TXT[status]}`)
  if (apt.dataHora.getTime() !== novoInicio.getTime()) mudancas.push(`data ${fmtDataHoraAudit(apt.dataHora)} → ${fmtDataHoraAudit(novoInicio)}`)
  if (apt.duracaoMinutos !== duracaoMinutos) mudancas.push(`duração ${apt.duracaoMinutos}min → ${duracaoMinutos}min`)
  if ((apt.roomId ?? null) !== (roomId ?? null)) mudancas.push(`sala ${apt.room?.name ?? "—"} → ${atualizado.room?.name ?? "—"}`)
  if (Number(apt.valorCobrado ?? 0) !== Number(atualizado.valorCobrado ?? 0))
    mudancas.push(`valor ${fmtMoeda(Number(apt.valorCobrado ?? 0))} → ${fmtMoeda(Number(atualizado.valorCobrado ?? 0))}`)
  if (trocouProfessor) mudancas.push(`professor ${primeiroNome(apt.professor.name)} → ${primeiroNome(novoProfessor.name)}`)
  if (apt.coordenadorId !== coordenador.id) mudancas.push(`coordenador ${primeiroNome(apt.coordenador.name)} → ${primeiroNome(atualizado.coordenador.name)}`)
  if ((apt.observacoes ?? "") !== (observacoes ?? "")) mudancas.push("observações")

  if (mudancas.length || notasFin.length) {
    const acao = apt.status !== status && status === "CANCELADO" ? "AGENDAMENTO_CANCELADO"
      : apt.status !== status && status === "CONCLUIDO" ? "AGENDAMENTO_CONCLUIDO"
      : trocouProfessor ? "AGENDAMENTO_PROFESSOR"
      : "AGENDAMENTO_ALTERADO"
    const verbo = acao === "AGENDAMENTO_CANCELADO" ? "cancelou" : acao === "AGENDAMENTO_CONCLUIDO" ? "concluiu" : "alterou"
    await registrarAuditoria(session, acao, "Agendamento", id,
      `${quem(session)} ${verbo} aula de ${apt.disciplina} do aluno ${primeiroNome(apt.aluno.name)} ` +
      `(${fmtDataHoraAudit(novoInicio)})` +
      (mudancas.length ? `: ${mudancas.join("; ")}` : "") +
      (notasFin.length ? `. Financeiro: ${notasFin.join("; ")}` : ""))
  }

  revalidatePath("/coordenador/agendamentos")
  revalidatePath("/coordenador/calendario")
  revalidatePath("/professor")
  revalidatePath("/coordenador/financas/contas-a-pagar")
  revalidatePath("/coordenador/financas/contas-a-receber")
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
  const apt = await prisma.appointment.findUnique({ where: { id }, include: { aluno: { select: { name: true } } } })
  if (!apt) return { success: false, error: "Agendamento não encontrado" }
  if (apt.status !== "PENDENTE") return { success: false, error: "Somente aulas pendentes podem ser confirmadas" }
  if (!apt.valorCobrado || Number(apt.valorCobrado) <= 0)
    return { success: false, error: "Informe o valor da aula (Editar) antes de confirmar" }

  await prisma.appointment.update({ where: { id }, data: { status: "AGENDADO" } })
  await enviarConfirmacao(id)

  await registrarAuditoria(session, "AGENDAMENTO_CONFIRMADO", "Agendamento", id,
    `${quem(session)} confirmou aula de ${apt.disciplina} do aluno ${primeiroNome(apt.aluno.name)} em ${fmtDataHoraAudit(apt.dataHora)}`)

  revalidatePath("/coordenador/agendamentos")
  revalidatePath("/coordenador/calendario")
  return { success: true }
}
