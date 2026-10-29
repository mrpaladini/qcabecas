import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { ACOES_AUDITORIA, ROLE_LABEL } from "@/lib/audit"

const POR_PAGINA = 50

const INPUT = "w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"

function txt(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? ""
}

function fmtQuando(d: Date) {
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
}

const TOM_ACAO: Record<string, string> = {
  LOGIN: "bg-neutral-100 text-neutral-600",
  LOGOUT: "bg-neutral-100 text-neutral-600",
  AGENDAMENTO_CANCELADO: "bg-red-100 text-red-700",
  USUARIO_EXCLUIDO: "bg-red-100 text-red-700",
  SALA_EXCLUIDA: "bg-red-100 text-red-700",
  DISCIPLINA_EXCLUIDA: "bg-red-100 text-red-700",
}
function tomAcao(acao: string) {
  if (TOM_ACAO[acao]) return TOM_ACAO[acao]
  if (acao.startsWith("FINANCEIRO")) return "bg-amber-100 text-amber-800"
  if (acao.startsWith("AGENDAMENTO")) return "bg-blue-100 text-blue-700"
  return "bg-primary-50 text-primary-700"
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await auth()
  if ((session?.user as any)?.role !== "COORDENADOR") redirect("/unauthorized")

  const sp       = await searchParams
  const q        = txt(sp.q)
  const operador = txt(sp.operador)
  const acao     = txt(sp.acao)
  const perfil   = txt(sp.perfil)
  const de       = txt(sp.de)
  const ate      = txt(sp.ate)
  const pagina   = Math.max(1, Number(txt(sp.pagina)) || 1)

  const where: Prisma.AuditLogWhereInput = {}
  const and: Prisma.AuditLogWhereInput[] = []
  if (q) {
    // cada palavra precisa aparecer na descrição ou no nome do operador
    for (const termo of q.split(/\s+/).filter(Boolean).slice(0, 6)) {
      and.push({ OR: [{ descricao: { contains: termo } }, { userNome: { contains: termo } }, { entidadeId: termo }] })
    }
  }
  if (operador) {
    try { and.push({ userId: BigInt(operador) }) } catch { /* ignora valor inválido */ }
  }
  if (acao)   and.push({ acao })
  if (perfil) and.push({ userRole: perfil })
  // datas no fuso de Brasília
  if (/^\d{4}-\d{2}-\d{2}$/.test(de))  and.push({ createdAt: { gte: new Date(`${de}T00:00:00-03:00`) } })
  if (/^\d{4}-\d{2}-\d{2}$/.test(ate)) and.push({ createdAt: { lte: new Date(`${ate}T23:59:59.999-03:00`) } })
  if (and.length) where.AND = and

  const [total, registros, operadores] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.auditLog.groupBy({
      by: ["userId", "userNome"],
      where: { userId: { not: null } },
      orderBy: { userNome: "asc" },
    }),
  ])

  // um item por usuário (se mudou de nome, fica o primeiro em ordem alfabética)
  const opcoesOperador = Array.from(
    new Map(operadores.map(o => [String(o.userId), o.userNome])).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]))

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const filtrosAtivos = !!(q || operador || acao || perfil || de || ate)

  function linkPagina(p: number) {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (operador) params.set("operador", operador)
    if (acao) params.set("acao", acao)
    if (perfil) params.set("perfil", perfil)
    if (de) params.set("de", de)
    if (ate) params.set("ate", ate)
    if (p > 1) params.set("pagina", String(p))
    const s = params.toString()
    return `/coordenador/administrativo/auditoria${s ? `?${s}` : ""}`
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Administrativo</p>
        <h1 className="text-2xl font-bold text-neutral-900">Auditoria</h1>
        <p className="text-neutral-500 mt-1 text-sm">
          Registro de todas as atividades executadas pelos operadores no sistema.
        </p>
      </div>

      {/* Busca */}
      <form method="get" className="bg-white border border-neutral-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div className="sm:col-span-2 lg:col-span-2">
          <label htmlFor="q" className="block text-xs font-medium text-neutral-600 mb-1">Buscar</label>
          <input id="q" name="q" type="search" defaultValue={q} className={INPUT}
            placeholder="Ex.: Francisco, cancelou, Matemática…" />
        </div>
        <div>
          <label htmlFor="operador" className="block text-xs font-medium text-neutral-600 mb-1">Operador</label>
          <select id="operador" name="operador" defaultValue={operador} className={INPUT}>
            <option value="">Todos</option>
            {opcoesOperador.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="acao" className="block text-xs font-medium text-neutral-600 mb-1">Ação</label>
          <select id="acao" name="acao" defaultValue={acao} className={INPUT}>
            <option value="">Todas</option>
            {Object.entries(ACOES_AUDITORIA).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="de" className="block text-xs font-medium text-neutral-600 mb-1">De</label>
          <input id="de" name="de" type="date" defaultValue={de} className={INPUT} />
        </div>
        <div>
          <label htmlFor="ate" className="block text-xs font-medium text-neutral-600 mb-1">Até</label>
          <input id="ate" name="ate" type="date" defaultValue={ate} className={INPUT} />
        </div>
        <div>
          <label htmlFor="perfil" className="block text-xs font-medium text-neutral-600 mb-1">Perfil</label>
          <select id="perfil" name="perfil" defaultValue={perfil} className={INPUT}>
            <option value="">Todos</option>
            {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="flex gap-2 sm:col-span-1 lg:col-span-5 lg:justify-end">
          {filtrosAtivos && (
            <Link href="/coordenador/administrativo/auditoria"
              className="flex-1 lg:flex-none text-center text-sm text-neutral-600 border border-neutral-200 px-4 py-2 rounded-lg hover:bg-neutral-50">
              Limpar
            </Link>
          )}
          <button type="submit"
            className="flex-1 lg:flex-none bg-primary-600 text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-primary-700">
            Buscar
          </button>
        </div>
      </form>

      <p className="text-sm text-neutral-500">
        {total === 0 ? "Nenhum registro encontrado." : `${total.toLocaleString("pt-BR")} registro(s)`}
        {total > POR_PAGINA && ` · página ${pagina} de ${totalPaginas}`}
      </p>

      {registros.length > 0 && (
        <>
          {/* Desktop: tabela */}
          <div className="hidden md:block bg-white border border-neutral-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 whitespace-nowrap">Data / hora</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500">Operador</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500">Ação</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {registros.map(r => (
                  <tr key={String(r.id)} className="border-t border-neutral-100 align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-neutral-600 tabular-nums">{fmtQuando(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{r.userNome}</p>
                      <p className="text-xs text-neutral-400">{ROLE_LABEL[r.userRole ?? ""] ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${tomAcao(r.acao)}`}>
                        {ACOES_AUDITORIA[r.acao] ?? r.acao}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{r.descricao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: cartões */}
          <ul className="md:hidden space-y-2">
            {registros.map(r => (
              <li key={String(r.id)} className="bg-white border border-neutral-200 rounded-xl p-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tomAcao(r.acao)}`}>
                    {ACOES_AUDITORIA[r.acao] ?? r.acao}
                  </span>
                  <span className="text-xs text-neutral-400 tabular-nums">{fmtQuando(r.createdAt)}</span>
                </div>
                <p className="text-sm text-neutral-800">{r.descricao}</p>
                <p className="text-xs text-neutral-500">{r.userNome} · {ROLE_LABEL[r.userRole ?? ""] ?? "—"}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      {totalPaginas > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Paginação">
          {pagina > 1 ? (
            <Link href={linkPagina(pagina - 1)} className="text-sm border border-neutral-200 px-4 py-2 rounded-lg hover:bg-neutral-50">← Anterior</Link>
          ) : <span className="text-sm border border-neutral-100 text-neutral-300 px-4 py-2 rounded-lg">← Anterior</span>}
          <span className="text-sm text-neutral-500 px-2">{pagina} / {totalPaginas}</span>
          {pagina < totalPaginas ? (
            <Link href={linkPagina(pagina + 1)} className="text-sm border border-neutral-200 px-4 py-2 rounded-lg hover:bg-neutral-50">Próxima →</Link>
          ) : <span className="text-sm border border-neutral-100 text-neutral-300 px-4 py-2 rounded-lg">Próxima →</span>}
        </nav>
      )}
    </main>
  )
}
