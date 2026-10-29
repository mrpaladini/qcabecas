import { prisma } from "@/lib/db"

/**
 * Trilha de auditoria do portal.
 *
 * Cada ação de um operador vira uma linha em `audit_logs` com uma frase
 * legível, ex.: "Coordenador Debora agendou aula para aluno Francisco em 26/10/26 às 15h".
 *
 * A gravação NUNCA interrompe a ação principal: se falhar, só registra no console.
 */

export const ROLE_LABEL: Record<string, string> = {
  COORDENADOR: "Coordenador",
  PROFESSOR:   "Professor",
  ALUNO:       "Aluno",
}

/** Ações registradas — usadas também no filtro da tela de Auditoria. */
export const ACOES_AUDITORIA: Record<string, string> = {
  LOGIN:                     "Login",
  LOGOUT:                    "Logout",
  AGENDAMENTO_CRIADO:        "Agendamento criado",
  AGENDAMENTO_ALTERADO:      "Agendamento alterado",
  AGENDAMENTO_CONFIRMADO:    "Agendamento confirmado",
  AGENDAMENTO_CONCLUIDO:     "Aula concluída",
  AGENDAMENTO_CANCELADO:     "Aula cancelada",
  USUARIO_CRIADO:            "Usuário criado",
  USUARIO_ALTERADO:          "Usuário alterado",
  USUARIO_DESATIVADO:        "Usuário desativado",
  USUARIO_REATIVADO:         "Usuário reativado",
  USUARIO_EXCLUIDO:          "Usuário excluído",
  SENHA_REGERADA:            "Senha regerada",
  DISCIPLINA_CRIADA:         "Disciplina criada",
  DISCIPLINA_ALTERADA:       "Disciplina alterada",
  DISCIPLINA_EXCLUIDA:       "Disciplina excluída",
  SALA_CRIADA:               "Sala criada",
  SALA_ALTERADA:             "Sala alterada",
  SALA_EXCLUIDA:             "Sala excluída",
  FINANCEIRO_CREDITO_ALUNO:  "Crédito na conta do aluno",
  FINANCEIRO_DEBITO_ALUNO:   "Débito na conta do aluno",
  FINANCEIRO_ESTORNO_ALUNO:  "Estorno na conta do aluno",
  FINANCEIRO_AJUSTE_PROF:    "Ajuste do professor",
  FINANCEIRO_ESTORNO_PROF:   "Estorno de ajuste do professor",
  FINANCEIRO_VALOR_AULA:     "Valor de aula ajustado",
  FINANCEIRO_PAGAMENTO:      "Pagamento gerado",
  MATERIAL_ENVIADO:          "Material enviado",
  MATERIAL_BAIXADO:          "Material baixado",
}

type SessionUser = { id?: string | null; name?: string | null; role?: string }
type SessionLike = { user?: SessionUser | null } | null

/** "Coordenador Debora" — prefixo padrão das frases de auditoria. */
export function quem(session: SessionLike): string {
  const u = session?.user as SessionUser | null | undefined
  const papel = ROLE_LABEL[u?.role ?? ""] ?? "Usuário"
  return `${papel} ${primeiroNome(u?.name ?? "desconhecido")}`
}

export function primeiroNome(nome: string): string {
  return (nome ?? "").trim().split(/\s+/)[0] || nome
}

/** 26/10/26 às 15h  |  26/10/26 às 15h30 (horário de Brasília) */
export function fmtDataHoraAudit(d: Date): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d)
  const p = (t: string) => partes.find(x => x.type === t)?.value ?? ""
  const min = p("minute")
  return `${p("day")}/${p("month")}/${p("year")} às ${p("hour")}h${min === "00" ? "" : min}`
}

export function fmtMoeda(v: number | string | null | undefined): string {
  return Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export async function registrarAuditoria(
  session: SessionLike,
  acao: keyof typeof ACOES_AUDITORIA | string,
  entidade: string,
  entidadeId: string | number | bigint | null | undefined,
  descricao: string,
) {
  try {
    const u = session?.user as SessionUser | null | undefined
    let userId: bigint | null = null
    try { userId = u?.id ? BigInt(u.id) : null } catch { userId = null }
    await prisma.auditLog.create({
      data: {
        userId,
        userNome:   (u?.name ?? "desconhecido").slice(0, 150),
        userRole:   u?.role ?? null,
        acao:       String(acao).slice(0, 60),
        entidade:   entidade.slice(0, 40),
        entidadeId: entidadeId == null ? null : String(entidadeId).slice(0, 40),
        descricao,
      },
    })
  } catch (e) {
    console.error("[auditoria] falha ao registrar:", e)
  }
}
