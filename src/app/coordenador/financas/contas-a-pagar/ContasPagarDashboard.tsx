"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { gerarPagamento } from "./actions"

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

type HistoricoItem = {
  id: string
  professorNome: string
  totalValor: number
  aulaCount: number
  periodoInicio: string | null
  periodoFim: string | null
  geradoEm: string
  geradoPor: string
}

function fmt(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}
function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

export function ContasPagarDashboard({
  aulas,
  historico,
  ajustes = {},
}: {
  aulas: AulaItem[]
  historico: HistoricoItem[]
  /** Saldo de débitos/créditos manuais pendentes por professorId */
  ajustes?: Record<string, number>
}) {
  const router = useRouter()
  const [aba, setAba] = useState<"pendentes" | "historico">("pendentes")
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [expandido, setExpandido] = useState<Set<string>>(new Set())
  const [filtroPago, setFiltroPago] = useState<"pendentes" | "pagos" | "todos">("pendentes")
  const [filtroProfessor, setFiltroProfessor] = useState("")
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  const [modalAberto, setModalAberto] = useState(false)
  const [obs, setObs] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const professores = useMemo(() => {
    const map = new Map<string, string>()
    aulas.forEach(a => map.set(a.professorId, a.professorNome))
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [aulas])

  const aulasFiltradas = useMemo(() => {
    let lista = aulas
    if (filtroPago === "pendentes") lista = lista.filter(a => !a.pago)
    if (filtroPago === "pagos")     lista = lista.filter(a => a.pago)
    if (filtroProfessor)            lista = lista.filter(a => a.professorId === filtroProfessor)
    if (dataInicio) {
      const d = new Date(dataInicio + "T00:00:00")
      lista = lista.filter(a => new Date(a.dataAula) >= d)
    }
    if (dataFim) {
      const d = new Date(dataFim + "T23:59:59")
      lista = lista.filter(a => new Date(a.dataAula) <= d)
    }
    return lista
  }, [aulas, filtroPago, filtroProfessor, dataInicio, dataFim])

  // Agrupar por professor
  const porProfessor = useMemo(() => {
    const map = new Map<string, { nome: string; aulas: AulaItem[] }>()
    aulasFiltradas.forEach(a => {
      if (!map.has(a.professorId)) map.set(a.professorId, { nome: a.professorNome, aulas: [] })
      map.get(a.professorId)!.aulas.push(a)
    })
    return Array.from(map.entries()).sort((a, b) => a[1].nome.localeCompare(b[1].nome))
  }, [aulasFiltradas])

  const aulasSelecionadas = aulasFiltradas.filter(a => selecionados.has(a.evidenciaId))
  const totalSelecionado  = aulasSelecionadas.reduce((acc, a) => acc + a.valorProfessor, 0)

  // Verifica se a seleção é de um único professor (obrigatório para gerar pagamento)
  const professorSelecionado = useMemo(() => {
    const ids = new Set(aulasSelecionadas.map(a => a.professorId))
    if (ids.size === 1) return aulasSelecionadas[0].professorId
    return null
  }, [aulasSelecionadas])

  function toggleAula(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleProfessor(profId: string) {
    const aulasProf = aulasFiltradas.filter(a => a.professorId === profId && !a.pago)
    const ids = aulasProf.map(a => a.evidenciaId)
    const todosSel = ids.every(id => selecionados.has(id))
    setSelecionados(prev => {
      const next = new Set(prev)
      ids.forEach(id => todosSel ? next.delete(id) : next.add(id))
      return next
    })
  }

  function toggleExpandido(profId: string) {
    setExpandido(prev => {
      const next = new Set(prev)
      next.has(profId) ? next.delete(profId) : next.add(profId)
      return next
    })
  }

  function handleGerar() {
    if (!professorSelecionado) {
      setErro("Selecione aulas de apenas um professor por vez.")
      return
    }
    setErro(null)
    setModalAberto(true)
  }

  function handleConfirmar() {
    if (!professorSelecionado) return
    setErro(null)
    startTransition(async () => {
      const res = await gerarPagamento(
        professorSelecionado,
        Array.from(selecionados),
        obs.trim() || undefined,
      )
      if (res.success && res.pagamentoId) {
        setModalAberto(false)
        setSelecionados(new Set())
        setObs("")
        router.push(`/coordenador/financas/contas-a-pagar/relatorio/${res.pagamentoId}`)
      } else {
        setErro(res.error ?? "Erro ao gerar pagamento")
      }
    })
  }

  const totalPendente = aulas.filter(a => !a.pago).reduce((acc, a) => acc + a.valorProfessor, 0)
  const totalPago     = aulas.filter(a => a.pago).reduce((acc, a) => acc + a.valorProfessor, 0)

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Contas a Pagar</h1>
        <p className="text-neutral-500 mt-1 text-sm">Gerencie o pagamento dos professores por aulas concluídas.</p>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 text-center">
          <p className="text-2xl font-bold text-orange-700">{fmt(totalPendente)}</p>
          <p className="text-xs font-medium text-orange-500 mt-1">Pendente de Pagamento</p>
          <p className="text-xs text-orange-400">{aulas.filter(a => !a.pago).length} aula(s)</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-2xl p-5 text-center">
          <p className="text-2xl font-bold text-green-700">{fmt(totalPago)}</p>
          <p className="text-xs font-medium text-green-500 mt-1">Total Pago</p>
          <p className="text-xs text-green-400">{historico.length} lote(s)</p>
        </div>
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 text-center">
          <p className="text-2xl font-bold text-neutral-700">{professores.length}</p>
          <p className="text-xs font-medium text-neutral-500 mt-1">Professores com aulas</p>
          <p className="text-xs text-neutral-400">{aulas.filter(a => !a.pago).length > 0 ? "há pendências" : "tudo em dia"}</p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 w-fit">
        {([["pendentes", "Aulas por Pagar"], ["historico", "Histórico de Pagamentos"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setAba(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${aba === v ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}>
            {l}
          </button>
        ))}
      </div>

      {aba === "pendentes" && (
        <>
          {/* Filtros */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
            <select value={filtroProfessor} onChange={e => setFiltroProfessor(e.target.value)}
              className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Todos os professores</option>
              {professores.map(([id, nome]) => (
                <option key={id} value={id}>{nome}</option>
              ))}
            </select>
            <div className="flex rounded-lg overflow-hidden border border-neutral-200 text-xs font-medium">
              {([["pendentes","Pendentes"],["pagos","Pagos"],["todos","Todos"]] as const).map(([v,l]) => (
                <button key={v} onClick={() => setFiltroPago(v)}
                  className={`px-3 py-1.5 transition-colors ${filtroPago === v ? "bg-primary-600 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}>
                  {l}
                </button>
              ))}
            </div>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <span className="text-neutral-400 text-sm">até</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            {(filtroProfessor || dataInicio || dataFim || filtroPago !== "pendentes") && (
              <button onClick={() => { setFiltroProfessor(""); setDataInicio(""); setDataFim(""); setFiltroPago("pendentes") }}
                className="text-xs text-neutral-500 hover:text-neutral-700 underline">
                Limpar
              </button>
            )}
          </div>

          {/* Barra de seleção — aparece quando há itens selecionados */}
          {selecionados.size > 0 && (
            <div className="bg-neutral-900 text-white rounded-2xl px-5 py-3 flex flex-wrap items-center gap-4">
              <div>
                <p className="font-semibold text-sm">{selecionados.size} aula(s) selecionada(s)</p>
                <p className="text-xs text-neutral-300">Total: {fmt(totalSelecionado)}</p>
                {!professorSelecionado && (
                  <p className="text-xs text-yellow-400 mt-0.5">Selecione aulas de apenas 1 professor</p>
                )}
              </div>
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setSelecionados(new Set())}
                  className="text-sm text-neutral-400 border border-neutral-600 hover:text-white hover:border-neutral-400 px-4 py-1.5 rounded-lg transition-colors">
                  Limpar
                </button>
                <button onClick={handleGerar} disabled={!professorSelecionado}
                  className="bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm px-5 py-1.5 rounded-lg transition-colors">
                  Gerar Pagamento
                </button>
              </div>
            </div>
          )}

          {erro && !modalAberto && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{erro}</div>
          )}

          {/* Lista por professor */}
          <div className="space-y-3">
            {porProfessor.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center text-neutral-500">
                Nenhuma aula encontrada com os filtros aplicados.
              </div>
            ) : porProfessor.map(([profId, { nome, aulas: aulasProf }]) => {
              const pendentes   = aulasProf.filter(a => !a.pago)
              const totalProf   = aulasProf.reduce((acc, a) => acc + a.valorProfessor, 0)
              const selProf     = pendentes.filter(a => selecionados.has(a.evidenciaId)).length
              const todosSelProf = pendentes.length > 0 && selProf === pendentes.length
              const aberto      = expandido.has(profId)

              return (
                <div key={profId} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3 cursor-pointer hover:bg-neutral-50 transition-colors"
                    onClick={() => toggleExpandido(profId)}>
                    {/* Checkbox para selecionar todos do professor */}
                    {filtroPago !== "pagos" && pendentes.length > 0 && (
                      <input type="checkbox" checked={todosSelProf}
                        onChange={e => { e.stopPropagation(); toggleProfessor(profId) }}
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 cursor-pointer" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-neutral-900">{nome}</p>
                      <p className="text-xs text-neutral-500">
                        {aulasProf.length} aula(s) · {pendentes.length} pendente(s)
                      </p>
                      {(ajustes[profId] ?? 0) !== 0 && (
                        <p className={`text-xs font-medium ${ajustes[profId] > 0 ? "text-green-700" : "text-red-700"}`}>
                          Ajustes pendentes (débito/crédito): {ajustes[profId] > 0 ? "+" : "−"}{fmt(Math.abs(ajustes[profId]))}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-neutral-900">{fmt(totalProf)}</p>
                      {pendentes.length > 0 && (
                        <p className="text-xs text-orange-600 font-medium">
                          {fmt(pendentes.reduce((acc, a) => acc + a.valorProfessor, 0))} pendente
                        </p>
                      )}
                    </div>
                    <span className="text-neutral-400 text-xs ml-1">{aberto ? "▲" : "▼"}</span>
                  </div>

                  {aberto && (
                    <div className="border-t border-neutral-100">
                      <table className="w-full text-xs">
                        <thead className="bg-neutral-50">
                          <tr>
                            <th className="w-8 px-3 py-2" />
                            <th className="text-left px-3 py-2 text-neutral-500 font-semibold">Data</th>
                            <th className="text-left px-3 py-2 text-neutral-500 font-semibold">Disciplina</th>
                            <th className="text-left px-3 py-2 text-neutral-500 font-semibold">Aluno</th>
                            <th className="text-left px-3 py-2 text-neutral-500 font-semibold">Duração</th>
                            <th className="text-left px-3 py-2 text-neutral-500 font-semibold">Sala</th>
                            <th className="text-right px-3 py-2 text-neutral-500 font-semibold">Valor</th>
                            <th className="text-center px-3 py-2 text-neutral-500 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aulasProf.map(aula => (
                            <tr key={aula.evidenciaId}
                              className={`border-t border-neutral-50 ${!aula.pago ? "hover:bg-neutral-50 cursor-pointer" : "opacity-60"}`}
                              onClick={() => !aula.pago && toggleAula(aula.evidenciaId)}>
                              <td className="px-3 py-2 text-center">
                                {!aula.pago ? (
                                  <input type="checkbox" checked={selecionados.has(aula.evidenciaId)}
                                    onChange={() => toggleAula(aula.evidenciaId)}
                                    onClick={e => e.stopPropagation()}
                                    className="w-3.5 h-3.5 rounded border-neutral-300 text-primary-600 cursor-pointer" />
                                ) : (
                                  <span className="text-green-500">✓</span>
                                )}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <p className="font-medium">{fmtData(aula.dataAula)}</p>
                                <p className="text-neutral-400">{fmtHora(aula.dataAula)}</p>
                              </td>
                              <td className="px-3 py-2 text-neutral-700">{aula.disciplina}</td>
                              <td className="px-3 py-2 text-neutral-600">{aula.alunoNome}</td>
                              <td className="px-3 py-2 text-neutral-500">{aula.duracaoMinutos}min</td>
                              <td className="px-3 py-2 text-neutral-400">
                                {aula.salaTipo === "PRESENCIAL" ? "🏫" : aula.salaTipo === "VIRTUAL" ? "💻" : "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-neutral-800">
                                {fmt(aula.valorProfessor)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {aula.pago ? (
                                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Pago</span>
                                ) : (
                                  <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">Pendente</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-neutral-200 bg-neutral-50">
                          <tr>
                            <td colSpan={6} className="px-3 py-2 text-xs text-neutral-500 font-semibold">
                              Total ({aulasProf.length} aulas)
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-bold text-neutral-900">{fmt(totalProf)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        </>
      )}

      {aba === "historico" && (
        <div className="space-y-3">
          {historico.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center text-neutral-500">
              Nenhum pagamento gerado ainda.
            </div>
          ) : historico.map(h => (
            <div key={h.id} className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="font-semibold text-neutral-900">{h.professorNome}</p>
                <p className="text-xs text-neutral-500">
                  {h.aulaCount} aulas ·{" "}
                  {h.periodoInicio && h.periodoFim
                    ? `${fmtData(h.periodoInicio)} a ${fmtData(h.periodoFim)}`
                    : "período não definido"}
                </p>
                <p className="text-xs text-neutral-400">
                  Gerado em {fmtData(h.geradoEm)} por {h.geradoPor}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-green-700">{fmt(h.totalValor)}</p>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Pago</span>
              </div>
              <a href={`/coordenador/financas/contas-a-pagar/relatorio/${h.id}`}
                className="flex items-center gap-1.5 text-sm font-medium text-primary-600 border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors whitespace-nowrap">
                Ver Relatório
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Modal de confirmação */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-neutral-900">Confirmar Pagamento</h2>

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">{erro}</div>
            )}

            <div className="bg-neutral-50 rounded-xl p-4 space-y-1 text-sm">
              <p className="font-semibold text-neutral-800">
                {aulasSelecionadas[0]?.professorNome}
              </p>
              <p className="text-neutral-600">{selecionados.size} aula(s) selecionada(s): {fmt(totalSelecionado)}</p>
              {professorSelecionado && (ajustes[professorSelecionado] ?? 0) !== 0 && (
                <p className={ajustes[professorSelecionado] > 0 ? "text-green-700" : "text-red-700"}>
                  Ajustes pendentes (débito/crédito): {ajustes[professorSelecionado] > 0 ? "+" : "−"}{fmt(Math.abs(ajustes[professorSelecionado]))}
                </p>
              )}
              <p className="text-2xl font-bold text-green-700 mt-2">
                {fmt(totalSelecionado + (professorSelecionado ? (ajustes[professorSelecionado] ?? 0) : 0))}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Observações (opcional)</label>
              <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                placeholder="Ex: Pagamento referente ao mês de maio/2026..." />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={handleConfirmar} disabled={isPending}
                className="flex-1 bg-primary-600 text-white font-semibold py-2.5 rounded-xl hover:bg-primary-700 transition-colors text-sm disabled:opacity-60">
                {isPending ? "Gerando..." : "Confirmar e Ver Relatório"}
              </button>
              <button onClick={() => { setModalAberto(false); setErro(null) }}
                className="px-4 text-sm text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
