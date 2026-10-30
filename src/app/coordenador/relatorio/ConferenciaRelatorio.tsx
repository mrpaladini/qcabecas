"use client"

import Image from "next/image"
import { useMemo, useState } from "react"

export type Pessoa = { id: string; name: string }
export type LinhaConferencia = {
  id: string
  pessoaId: string
  dataHora: string
  duracaoMinutos: number
  disciplina: string
  valor: number
  /** só no relatório do professor: aula já incluída em um pagamento */
  pago?: boolean
}

const TZ = "America/Sao_Paulo"

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function fmtDuracao(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`
}
function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" })
}
function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
}
/** "YYYY-MM-DD" no fuso de Brasília (para comparar com <input type="date">) */
function diaLocal(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ })
}
function hojeLocal() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ })
}
function limitesMes(desloc: number) {
  const [y, m] = hojeLocal().split("-").map(Number)
  const ini = new Date(Date.UTC(y, m - 1 + desloc, 1))
  const fim = new Date(Date.UTC(y, m + desloc, 0))
  const f = (d: Date) => d.toISOString().slice(0, 10)
  return { ini: f(ini), fim: f(fim) }
}
function fmtPeriodo(ini: string, fim: string) {
  const br = (s: string) => s.split("-").reverse().join("/")
  if (ini && fim) return `${br(ini)} a ${br(fim)}`
  if (ini) return `a partir de ${br(ini)}`
  if (fim) return `até ${br(fim)}`
  return "todo o período"
}

/**
 * Relatório de conferência (enviado ao professor/aluno ANTES do pagamento/cobrança).
 * - tipo "professor": Data · Tempo · Matéria · Valor (valor a receber pelo professor)
 * - tipo "aluno":     Data e hora · Matéria · Tempo · Valor (valor cobrado do aluno)
 * Só entram aulas CONCLUÍDAS.
 */
export function ConferenciaRelatorio({ tipo, pessoas, linhas, geradoEm }: {
  tipo: "professor" | "aluno"
  pessoas: Pessoa[]
  linhas: LinhaConferencia[]
  geradoEm: string
}) {
  const ehProf = tipo === "professor"
  const mesAtual = limitesMes(0)
  const [pessoaId, setPessoaId] = useState("")
  const [dataInicio, setDataInicio] = useState(mesAtual.ini)
  const [dataFim, setDataFim] = useState(mesAtual.fim)
  const [somenteNaoPagas, setSomenteNaoPagas] = useState(true)
  const [copiado, setCopiado] = useState(false)

  // Só lista no seletor quem tem aula concluída
  const comAulas = useMemo(() => {
    const ids = new Set(linhas.map(l => l.pessoaId))
    return pessoas.filter(p => ids.has(p.id))
  }, [pessoas, linhas])
  const pessoa = pessoas.find(p => p.id === pessoaId)

  const filtradas = useMemo(() => linhas
    .filter(l => l.pessoaId === pessoaId)
    .filter(l => !ehProf || !somenteNaoPagas || !l.pago)
    .filter(l => !dataInicio || diaLocal(l.dataHora) >= dataInicio)
    .filter(l => !dataFim || diaLocal(l.dataHora) <= dataFim)
    .sort((a, b) => a.dataHora.localeCompare(b.dataHora)),
  [linhas, pessoaId, ehProf, somenteNaoPagas, dataInicio, dataFim])

  const totalValor = Math.round(filtradas.reduce((acc, l) => acc + l.valor, 0) * 100) / 100
  const totalMin   = filtradas.reduce((acc, l) => acc + l.duracaoMinutos, 0)

  function periodo(desloc: number | null) {
    if (desloc === null) { setDataInicio(""); setDataFim(""); return }
    const p = limitesMes(desloc)
    setDataInicio(p.ini); setDataFim(p.fim)
  }

  async function copiarTexto() {
    if (!pessoa) return
    const cab = `Conferência de aulas — ${ehProf ? "Prof. " : ""}${pessoa.name}\nPeríodo: ${fmtPeriodo(dataInicio, dataFim)}\n`
    const corpo = filtradas.map(l => ehProf
      ? `${fmtData(l.dataHora)} · ${fmtDuracao(l.duracaoMinutos)} · ${l.disciplina} · ${fmtBRL(l.valor)}`
      : `${fmtData(l.dataHora)} ${fmtHora(l.dataHora)} · ${l.disciplina} · ${fmtDuracao(l.duracaoMinutos)} · ${fmtBRL(l.valor)}`,
    ).join("\n")
    const rod = `\nTotal: ${filtradas.length} aula(s) · ${fmtDuracao(totalMin)} · ${fmtBRL(totalValor)}`
    try {
      await navigator.clipboard.writeText(`${cab}\n${corpo}\n${rod}`)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* navegador sem permissão de área de transferência */ }
  }

  const colunas = ehProf ? ["Data", "Tempo", "Matéria", "Valor"] : ["Data e hora", "Matéria", "Tempo", "Valor"]
  const titulo = ehProf ? "Conferência Professor" : "Conferência Aluno"
  const INPUT = "border border-neutral-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6 print:py-0 print:max-w-none">
      {/* Cabeçalho da tela */}
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{titulo}</h1>
          <p className="text-neutral-500 mt-1 text-sm">
            Aulas concluídas, para o {ehProf ? "professor" : "aluno/responsável"} conferir antes do {ehProf ? "pagamento" : "recebimento"}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={copiarTexto} disabled={!pessoa || filtradas.length === 0}
            className="border border-primary-200 text-primary-700 font-semibold px-4 py-2.5 rounded-xl hover:bg-primary-50 transition-colors text-sm disabled:opacity-50">
            {copiado ? "✓ Copiado" : "Copiar texto"}
          </button>
          <button onClick={() => window.print()} disabled={!pessoa}
            className="bg-primary-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-700 transition-colors text-sm disabled:opacity-50">
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3 print:hidden">
        <div className="flex flex-wrap gap-3 items-center">
          <label htmlFor="pessoa" className="text-xs text-neutral-600 font-medium">{ehProf ? "Professor" : "Aluno"}:</label>
          <select id="pessoa" value={pessoaId} onChange={e => setPessoaId(e.target.value)} className={`${INPUT} flex-1 min-w-56`}>
            <option value="">Selecione…</option>
            {comAulas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-xs text-neutral-600 font-medium">Período:</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={INPUT} aria-label="Data inicial" />
          <span className="text-neutral-400 text-sm">até</span>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className={INPUT} aria-label="Data final" />
          <div className="flex flex-wrap gap-1 text-xs">
            <button type="button" onClick={() => periodo(0)} className="px-2.5 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50">Mês atual</button>
            <button type="button" onClick={() => periodo(-1)} className="px-2.5 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50">Mês anterior</button>
            <button type="button" onClick={() => periodo(null)} className="px-2.5 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50">Tudo</button>
          </div>
        </div>
        {ehProf && (
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={somenteNaoPagas} onChange={e => setSomenteNaoPagas(e.target.checked)}
              className="rounded border-neutral-300" />
            Somente aulas ainda não pagas
          </label>
        )}
      </div>

      {!pessoa ? (
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-8 text-center text-neutral-500 print:hidden">
          Selecione {ehProf ? "um professor" : "um aluno"} para gerar a conferência.
        </div>
      ) : (
        <section className="space-y-4">
          {/* Cabeçalho do documento (tela e PDF) */}
          <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500 font-semibold">Conferência de aulas</p>
              <h2 className="text-xl font-bold text-neutral-900">{ehProf ? "Prof. " : ""}{pessoa.name}</h2>
              <p className="text-sm text-neutral-500">Período: {fmtPeriodo(dataInicio, dataFim)}</p>
            </div>
            <Image src="/images/logo-qc10.png" alt="Quebra Cabeças" width={1001} height={258}
              className="h-9 w-auto hidden print:block" />
          </div>

          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden print:border-neutral-400 print:rounded-none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    {colunas.map(h => (
                      <th key={h} className={`px-4 py-3 text-xs font-semibold text-neutral-600 whitespace-nowrap ${h === "Valor" ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filtradas.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-neutral-400">Nenhuma aula concluída neste período.</td>
                    </tr>
                  ) : filtradas.map(l => (
                    <tr key={l.id}>
                      {ehProf ? (
                        <>
                          <td className="px-4 py-2.5 whitespace-nowrap text-neutral-800">{fmtData(l.dataHora)}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-neutral-700">{fmtDuracao(l.duracaoMinutos)}</td>
                          <td className="px-4 py-2.5 text-neutral-700">{l.disciplina}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2.5 whitespace-nowrap text-neutral-800">{fmtData(l.dataHora)} <span className="text-neutral-500">{fmtHora(l.dataHora)}</span></td>
                          <td className="px-4 py-2.5 text-neutral-700">{l.disciplina}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-neutral-700">{fmtDuracao(l.duracaoMinutos)}</td>
                        </>
                      )}
                      <td className="px-4 py-2.5 whitespace-nowrap text-right font-medium text-neutral-900 tabular-nums">{fmtBRL(l.valor)}</td>
                    </tr>
                  ))}
                </tbody>
                {filtradas.length > 0 && (
                  <tfoot className="border-t-2 border-neutral-200 bg-neutral-50">
                    <tr>
                      <td className="px-4 py-3 font-semibold text-neutral-800" colSpan={ehProf ? 1 : 2}>
                        Total · {filtradas.length} aula(s)
                      </td>
                      <td className="px-4 py-3 font-semibold text-neutral-800 whitespace-nowrap">{fmtDuracao(totalMin)}</td>
                      {ehProf && <td />}
                      <td className="px-4 py-3 text-right font-bold text-neutral-900 whitespace-nowrap tabular-nums">{fmtBRL(totalValor)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <p className="text-xs text-neutral-500">
            Em caso de divergência, favor avisar a coordenação antes do {ehProf ? "pagamento" : "vencimento"}.
          </p>
          <p className="text-xs text-neutral-400 text-center hidden print:block">
            Portal Quebra Cabeças · Gerado em {new Date(geradoEm).toLocaleString("pt-BR", { timeZone: TZ })}
          </p>
        </section>
      )}

      <style>{`
        @media print {
          body { font-size: 12px; }
          @page { margin: 1.5cm; size: A4 portrait; }
        }
      `}</style>
    </main>
  )
}
