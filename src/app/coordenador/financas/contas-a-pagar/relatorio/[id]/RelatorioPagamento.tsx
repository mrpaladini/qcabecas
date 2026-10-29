"use client"

type EvidenciaItem = {
  id: string
  dataAula: string
  disciplina: string
  alunoNome: string
  duracaoMinutos: number
  salaTipo: string | null
  valorProfessor: number
}

type AjusteItem = {
  id: string
  tipo: "CREDITO" | "DEBITO"
  valor: number
  descricao: string
  createdAt: string
}

type Pagamento = {
  id: string
  professorNome: string
  professorEmail: string
  totalValor: number
  aulaCount: number
  periodoInicio: string | null
  periodoFim: string | null
  observacoes: string | null
  geradoEm: string
  geradoPor: string
  evidencias: EvidenciaItem[]
  ajustes?: AjusteItem[]
}

function fmt(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}
function fmtDataLonga(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
}
function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

export function RelatorioPagamento({ pagamento }: { pagamento: Pagamento }) {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Ações — ocultas na impressão */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <a href="/coordenador/financas/contas-a-pagar"
          className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1.5">
          ← Voltar
        </a>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 bg-primary-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-700 transition-colors text-sm">
          Exportar / Imprimir PDF
        </button>
      </div>

      {/* Cabeçalho do relatório */}
      <div className="border border-neutral-200 rounded-2xl p-6 print:border-0 print:rounded-none print:p-0">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6 pb-4 border-b border-neutral-200">
          <div>
            <h1 className="text-2xl font-extrabold text-primary-700">Quebra Cabeças</h1>
            <p className="text-xs text-neutral-400 mt-0.5">Inteligência se Aprende · Vinhedo, SP</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-neutral-700">Comprovante de Pagamento</p>
            <p className="text-xs text-neutral-400">Nº {pagamento.id.padStart(6, "0")}</p>
            <p className="text-xs text-neutral-400">Gerado em {fmtDataLonga(pagamento.geradoEm)}</p>
          </div>
        </div>

        {/* Dados do professor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Professor</p>
            <p className="text-lg font-bold text-neutral-900">{pagamento.professorNome}</p>
            <p className="text-sm text-neutral-500">{pagamento.professorEmail}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Período das Aulas</p>
            {pagamento.periodoInicio && pagamento.periodoFim ? (
              <p className="text-sm font-medium text-neutral-700">
                {fmtData(pagamento.periodoInicio)} a {fmtData(pagamento.periodoFim)}
              </p>
            ) : (
              <p className="text-sm text-neutral-400">—</p>
            )}
            <p className="text-sm text-neutral-500">{pagamento.aulaCount} aula(s) concluída(s)</p>
          </div>
        </div>

        {pagamento.observacoes && (
          <div className="bg-neutral-50 rounded-xl p-3 mb-6">
            <p className="text-xs font-semibold text-neutral-500 mb-1">Observações</p>
            <p className="text-sm text-neutral-700">{pagamento.observacoes}</p>
          </div>
        )}

        {/* Tabela de aulas */}
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600">Data</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600">Disciplina</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600">Aluno</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600">Duração</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600">Modalidade</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-600">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {pagamento.evidencias.map((e, i) => (
                <tr key={e.id} className={i % 2 === 0 ? "bg-white" : "bg-neutral-50/50"}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="font-medium text-neutral-800">{fmtData(e.dataAula)}</p>
                    <p className="text-xs text-neutral-400">{fmtHora(e.dataAula)}</p>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{e.disciplina}</td>
                  <td className="px-4 py-3 text-neutral-700">{e.alunoNome}</td>
                  <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">{e.duracaoMinutos}min</td>
                  <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                    {e.salaTipo === "PRESENCIAL" ? "🏫 Presencial" : e.salaTipo === "VIRTUAL" ? "💻 Virtual" : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-neutral-800 whitespace-nowrap">
                    {fmt(e.valorProfessor)}
                  </td>
                </tr>
              ))}
            </tbody>
            {(pagamento.ajustes?.length ?? 0) > 0 && (
              <tbody className="divide-y divide-neutral-100 border-t border-neutral-200">
                <tr className="bg-neutral-50">
                  <td colSpan={6} className="px-4 py-2 text-xs font-semibold text-neutral-600">Ajustes (débito/crédito)</td>
                </tr>
                {pagamento.ajustes!.map(a => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-neutral-700">{fmtData(a.createdAt)}</td>
                    <td colSpan={4} className="px-4 py-2 text-neutral-700">
                      {a.tipo === "CREDITO" ? "Crédito" : "Débito"} — {a.descricao}
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold whitespace-nowrap ${a.tipo === "CREDITO" ? "text-green-700" : "text-red-700"}`}>
                      {a.tipo === "CREDITO" ? "+" : "−"}{fmt(a.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
            <tfoot className="border-t-2 border-neutral-300 bg-neutral-50">
              <tr>
                <td colSpan={5} className="px-4 py-4 text-sm font-bold text-neutral-700 text-right">
                  Total a pagar ({pagamento.aulaCount} aulas):
                </td>
                <td className="px-4 py-4 text-right text-xl font-extrabold text-primary-700 whitespace-nowrap">
                  {fmt(pagamento.totalValor)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Rodapé do comprovante */}
        <div className="mt-6 pt-4 border-t border-neutral-200 flex flex-wrap justify-between gap-4 text-xs text-neutral-400">
          <p>Gerado por: {pagamento.geradoPor}</p>
          <p>Portal Quebra Cabeças · {fmtDataLonga(pagamento.geradoEm)}</p>
        </div>

        {/* Área de assinatura — apenas na impressão */}
        <div className="hidden print:grid grid-cols-2 gap-8 mt-12">
          <div className="border-t border-neutral-400 pt-2 text-center text-xs text-neutral-500">
            Assinatura do Professor
          </div>
          <div className="border-t border-neutral-400 pt-2 text-center text-xs text-neutral-500">
            Assinatura do Coordenador
          </div>
        </div>
      </div>

      {/* CSS de impressão */}
      <style>{`
        @media print {
          body { font-size: 11px; }
          @page { margin: 1.5cm; size: A4 portrait; }
          .print\\:hidden { display: none !important; }
          .hidden.print\\:grid { display: grid !important; }
        }
      `}</style>
    </main>
  )
}
