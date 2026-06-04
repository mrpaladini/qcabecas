"use client"

import { useState, useTransition, useMemo } from "react"
import { adicionarCredito, estornarTransacao } from "./actions"

type Transacao = {
  id: string
  tipo: "CREDITO" | "DEBITO"
  valor: number
  descricao: string
  createdAt: string
  disciplina: string | null
  aula: string | null
  temAppointment: boolean
}

type AlunoFinanceiro = {
  id: string
  name: string
  email: string
  responsavelNome: string | null
  saldo: number
  contaId: number | null
  transacoes: Transacao[]
}

function fmt(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function SaldoBadge({ saldo }: { saldo: number }) {
  if (saldo > 0)  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Crédito {fmt(saldo)}</span>
  if (saldo < 0)  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Débito {fmt(Math.abs(saldo))}</span>
  return              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">Zerado</span>
}

function AdicionarCreditoForm({ alunoId, onClose }: { alunoId: string; onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const fd = new FormData(e.currentTarget)
    fd.set("alunoId", alunoId)
    startTransition(async () => {
      const res = await adicionarCredito(fd)
      if (res.success) onClose()
      else setErro(res.error ?? "Erro")
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-green-800">Adicionar crédito</p>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Valor (R$) *</label>
          <input name="valor" type="number" step="0.01" min="0.01" required
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="0,00" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-neutral-600 mb-1">Descrição</label>
          <input name="descricao" defaultValue="Crédito adiantado"
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={isPending}
          className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60">
          {isPending ? "Salvando..." : "Confirmar Crédito"}
        </button>
        <button type="button" onClick={onClose}
          className="text-sm text-neutral-600 border border-neutral-200 px-4 py-2 rounded-lg hover:bg-neutral-50 transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  )
}

function HistoricoAluno({ transacoes, alunoId }: { transacoes: Transacao[]; alunoId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleEstorno(id: string) {
    if (!confirm("Estornar esta transação?")) return
    startTransition(async () => { await estornarTransacao(id) })
  }

  if (transacoes.length === 0)
    return <p className="text-xs text-neutral-400 italic px-1 py-2">Nenhuma movimentação registrada.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs mt-2">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="text-left py-1.5 px-2 text-neutral-500 font-semibold">Data</th>
            <th className="text-left py-1.5 px-2 text-neutral-500 font-semibold">Tipo</th>
            <th className="text-left py-1.5 px-2 text-neutral-500 font-semibold">Descrição</th>
            <th className="text-right py-1.5 px-2 text-neutral-500 font-semibold">Valor</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {transacoes.map(t => (
            <tr key={t.id} className="border-b border-neutral-100 hover:bg-neutral-50">
              <td className="py-1.5 px-2 whitespace-nowrap">{fmtData(t.createdAt)}</td>
              <td className="py-1.5 px-2">
                <span className={`px-1.5 py-0.5 rounded-full font-semibold ${t.tipo === "CREDITO" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {t.tipo === "CREDITO" ? "Crédito" : "Débito"}
                </span>
              </td>
              <td className="py-1.5 px-2 text-neutral-600">
                {t.descricao}
                {t.disciplina && <span className="text-neutral-400"> · {t.disciplina}</span>}
                {t.aula && <span className="text-neutral-400"> ({fmtData(t.aula)})</span>}
              </td>
              <td className={`py-1.5 px-2 text-right font-semibold whitespace-nowrap ${t.tipo === "CREDITO" ? "text-green-700" : "text-red-700"}`}>
                {t.tipo === "CREDITO" ? "+" : "-"}{fmt(t.valor)}
              </td>
              <td className="py-1.5 px-1">
                {!t.temAppointment && (
                  <button onClick={() => handleEstorno(t.id)} disabled={isPending}
                    title="Estornar"
                    className="text-neutral-400 hover:text-red-500 transition-colors text-xs font-medium px-1">
                    ✕
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ContasReceberDashboard({ alunos, totalAReceber, totalCredito }: {
  alunos: AlunoFinanceiro[]
  totalAReceber: number
  totalCredito: number
}) {
  const [busca, setBusca]         = useState("")
  const [filtro, setFiltro]       = useState<"todos" | "debito" | "credito" | "zerado">("todos")
  const [expandido, setExpandido] = useState<string | null>(null)
  const [addCredito, setAddCredito] = useState<string | null>(null)

  const lista = useMemo(() => {
    let l = alunos
    if (busca) {
      const q = busca.toLowerCase()
      l = l.filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || (a.responsavelNome?.toLowerCase().includes(q) ?? false))
    }
    if (filtro === "debito")  l = l.filter(a => a.saldo < 0)
    if (filtro === "credito") l = l.filter(a => a.saldo > 0)
    if (filtro === "zerado")  l = l.filter(a => a.saldo === 0)
    return l.sort((a, b) => a.saldo - b.saldo) // devedores primeiro
  }, [alunos, busca, filtro])

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Contas a Receber</h1>
        <p className="text-neutral-500 mt-1 text-sm">Gerencie o saldo financeiro dos alunos e adicione créditos antecipados.</p>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-center">
          <p className="text-2xl font-bold text-red-700">{fmt(totalAReceber)}</p>
          <p className="text-xs font-medium text-red-500 mt-1">Total a Receber</p>
          <p className="text-xs text-red-400">{alunos.filter(a => a.saldo < 0).length} aluno(s) com débito</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-2xl p-5 text-center">
          <p className="text-2xl font-bold text-green-700">{fmt(totalCredito)}</p>
          <p className="text-xs font-medium text-green-500 mt-1">Total em Crédito</p>
          <p className="text-xs text-green-400">{alunos.filter(a => a.saldo > 0).length} aluno(s) com saldo</p>
        </div>
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 text-center">
          <p className="text-2xl font-bold text-neutral-700">{alunos.length}</p>
          <p className="text-xs font-medium text-neutral-500 mt-1">Total de Alunos</p>
          <p className="text-xs text-neutral-400">{alunos.filter(a => a.saldo === 0).length} zerado(s)</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <input type="search" placeholder="Buscar aluno ou responsável..." value={busca}
          onChange={e => setBusca(e.target.value)}
          className="flex-1 min-w-48 border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <div className="flex rounded-lg overflow-hidden border border-neutral-200 text-xs font-medium">
          {([["todos","Todos"],["debito","Com débito"],["credito","Com crédito"],["zerado","Zerados"]] as const).map(([v,l]) => (
            <button key={v} onClick={() => setFiltro(v)}
              className={`px-3 py-1.5 transition-colors ${filtro === v ? "bg-primary-600 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}>
              {l}
            </button>
          ))}
        </div>
        <span className="text-xs text-neutral-400">{lista.length} aluno(s)</span>
      </div>

      {/* Lista de alunos */}
      <div className="space-y-3">
        {lista.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center text-neutral-500">
            Nenhum aluno encontrado.
          </div>
        ) : lista.map(aluno => (
          <div key={aluno.id} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            {/* Cabeçalho do aluno */}
            <div className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-neutral-900">{aluno.name}</p>
                <p className="text-xs text-neutral-400">{aluno.email}{aluno.responsavelNome ? ` · Resp: ${aluno.responsavelNome}` : ""}</p>
              </div>
              <SaldoBadge saldo={aluno.saldo} />
              <div className="flex gap-2">
                <button
                  onClick={() => { setAddCredito(addCredito === aluno.id ? null : aluno.id); setExpandido(null) }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors">
                  + Crédito
                </button>
                <button
                  onClick={() => { setExpandido(expandido === aluno.id ? null : aluno.id); setAddCredito(null) }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors">
                  {expandido === aluno.id ? "Fechar" : `Histórico (${aluno.transacoes.length})`}
                </button>
              </div>
            </div>

            {/* Formulário de crédito */}
            {addCredito === aluno.id && (
              <div className="px-4 pb-4">
                <AdicionarCreditoForm alunoId={aluno.id} onClose={() => setAddCredito(null)} />
              </div>
            )}

            {/* Histórico de transações */}
            {expandido === aluno.id && (
              <div className="px-4 pb-4 border-t border-neutral-100">
                <HistoricoAluno transacoes={aluno.transacoes} alunoId={aluno.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}
