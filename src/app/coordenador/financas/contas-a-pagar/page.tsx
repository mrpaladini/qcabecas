import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { ContasPagarDashboard } from "./ContasPagarDashboard"

export default async function ContasPagarPage() {
  const session = await auth()
  if ((session?.user as any)?.role !== "COORDENADOR") redirect("/unauthorized")

  const [evidencias, pagamentos, ajustesPendentes, professoresPix] = await Promise.all([
    prisma.evidencia.findMany({
      where: { status: "CONCLUIDO" },
      include: {
        appointment: {
          include: {
            professor: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { dataAula: "asc" },
    }),
    prisma.pagamentoProfessor.findMany({
      orderBy: { geradoEm: "desc" },
      include: {
        gerador: { select: { name: true } },
      },
    }),
    prisma.ajusteProfessor.findMany({
      where: { pagamentoId: null },
      orderBy: { createdAt: "asc" },
      select: { professorId: true, tipo: true, valor: true },
    }),
    prisma.user.findMany({
      where: { role: "PROFESSOR", pixChave: { not: null } },
      select: { id: true, pixTipo: true, pixChave: true },
    }),
  ])

  // Chave PIX de cada professor (para pagar)
  const pix: Record<string, { tipo: string | null; chave: string }> = {}
  for (const p of professoresPix) if (p.pixChave) pix[String(p.id)] = { tipo: p.pixTipo, chave: p.pixChave }

  // Saldo de débitos/créditos manuais pendentes, por professor
  const ajustes: Record<string, number> = {}
  for (const a of ajustesPendentes) {
    const k = String(a.professorId)
    ajustes[k] = Math.round(((ajustes[k] ?? 0) + (a.tipo === "CREDITO" ? 1 : -1) * Number(a.valor)) * 100) / 100
  }

  type AulaItem = {
    evidenciaId: string
    appointmentId: string
    professorId: string
    professorNome: string
    dataAula: string
    disciplina: string
    alunoNome: string
    duracaoMinutos: number
    salaTipo: string | null
    valorProfessor: number
    pago: boolean
    pagamentoId: string | null
  }

  const aulas: AulaItem[] = evidencias.map(e => ({
    evidenciaId:    String(e.id),
    appointmentId:  String(e.appointmentId),
    professorId:    String(e.appointment.professor.id),
    professorNome:  e.professorNome,
    dataAula:       e.dataAula.toISOString(),
    disciplina:     e.disciplina,
    alunoNome:      e.alunoNome,
    duracaoMinutos: e.duracaoMinutos,
    salaTipo:       e.salaTipo,
    valorProfessor: Number(e.valorProfessor),
    pago:           e.pagoProfessor,
    pagamentoId:    e.pagamentoId ? String(e.pagamentoId) : null,
  }))

  const historico = pagamentos.map(p => ({
    id:            String(p.id),
    professorNome: p.professorNome,
    totalValor:    Number(p.totalValor),
    aulaCount:     p.aulaCount,
    periodoInicio: p.periodoInicio?.toISOString() ?? null,
    periodoFim:    p.periodoFim?.toISOString() ?? null,
    geradoEm:      p.geradoEm.toISOString(),
    geradoPor:     p.gerador.name,
  }))

  return <ContasPagarDashboard aulas={aulas} historico={historico} ajustes={ajustes} pix={pix} />
}
