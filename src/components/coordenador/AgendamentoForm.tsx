"use client"

import { useState, useTransition } from "react"
import { criarAgendamento } from "@/app/coordenador/agendamentos/actions"
import { CurrencyInput } from "@/components/ui/CurrencyInput"

type Aluno = { id: string; name: string }
type Professor = { id: string; name: string }
type Disciplina = { id: number; name: string; professores: Professor[] }
type Sala = { id: number; name: string; type: string }

const INPUT_CLS = "w-full border border-neutral-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
const INPUT_ERR = "w-full border border-red-400 ring-2 ring-red-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-red-400"

export function AgendamentoForm({ alunos, todasDisciplinas, salas }: {
  alunos: Aluno[]
  todasDisciplinas: Disciplina[]
  salas: Sala[]
}) {
  const [disciplinaId, setDisciplinaId] = useState<number | null>(null)
  const [valorCobrado, setValorCobrado]  = useState("")
  const [sucesso, setSucesso]           = useState(false)
  const [erroGeral, setErroGeral]       = useState<string | null>(null)
  const [camposErro, setCamposErro]     = useState<Record<string, string>>({})
  const [isPending, startTransition]    = useTransition()

  const professoresDaDisciplina = disciplinaId
    ? (todasDisciplinas.find(d => d.id === disciplinaId)?.professores ?? [])
    : []

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErroGeral(null)
    setCamposErro({})
    setSucesso(false)

    const formData = new FormData(e.currentTarget)
    formData.set("valorCobrado", valorCobrado)

    startTransition(async () => {
      const res = await criarAgendamento(formData)
      if (res.success) {
        setSucesso(true)
        setValorCobrado("")
        setDisciplinaId(null)
        ;(e.target as HTMLFormElement).reset()
      } else {
        if ("fieldErrors" in res && res.fieldErrors) setCamposErro(res.fieldErrors as Record<string, string>)
        setErroGeral(res.error ?? "Erro ao agendar")
      }
    })
  }

  function fieldCls(field: string) { return camposErro[field] ? INPUT_ERR : INPUT_CLS }
  function FieldError({ field }: { field: string }) {
    if (!camposErro[field]) return null
    return <p className="text-xs text-red-600 mt-1">{camposErro[field]}</p>
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-neutral-900 mb-5">Nova Aula</h2>

      {sucesso && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800 font-medium">
          ✅ Aula agendada com sucesso! Notificações enviadas por e-mail.
        </div>
      )}

      {erroGeral && !Object.keys(camposErro).length && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{erroGeral}</div>
      )}

      {Object.keys(camposErro).length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
          <p className="text-sm font-semibold text-red-700">Corrija os campos abaixo:</p>
          {Object.values(camposErro).map((msg, i) => (
            <p key={i} className="text-xs text-red-600">• {msg}</p>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div>
          <label htmlFor="alunoId" className="block text-sm font-medium text-neutral-700 mb-1.5">Aluno <span className="text-red-500">*</span></label>
          <select id="alunoId" name="alunoId" required className={fieldCls("alunoId")}>
            <option value="">Selecione o aluno</option>
            {alunos.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <FieldError field="alunoId" />
        </div>

        <div>
          <label htmlFor="subjectId" className="block text-sm font-medium text-neutral-700 mb-1.5">Disciplina <span className="text-red-500">*</span></label>
          <select id="subjectId" name="subjectId" required value={disciplinaId ?? ""}
            onChange={e => setDisciplinaId(e.target.value ? Number(e.target.value) : null)}
            className={fieldCls("subjectId")}>
            <option value="">Selecione a disciplina</option>
            {todasDisciplinas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <FieldError field="subjectId" />
        </div>

        <div>
          <label htmlFor="professorId" className="block text-sm font-medium text-neutral-700 mb-1.5">Professor <span className="text-red-500">*</span></label>
          <select id="professorId" name="professorId" required disabled={!disciplinaId}
            className={`${fieldCls("professorId")} disabled:bg-neutral-50 disabled:text-neutral-400`}>
            <option value="">{!disciplinaId ? "Selecione a disciplina primeiro" : "Selecione o professor"}</option>
            {professoresDaDisciplina.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {disciplinaId && professoresDaDisciplina.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">⚠ Nenhum professor associado a esta disciplina.</p>
          )}
          <FieldError field="professorId" />
        </div>

        <div>
          <label htmlFor="roomId" className="block text-sm font-medium text-neutral-700 mb-1.5">Sala de Aula</label>
          <select id="roomId" name="roomId" className={fieldCls("roomId")}>
            <option value="">Sem sala definida</option>
            {salas.map(s => <option key={s.id} value={s.id}>{s.type === "VIRTUAL" ? "💻" : "🏫"} {s.name}</option>)}
          </select>
          <FieldError field="roomId" />
        </div>

        <div>
          <label htmlFor="dataHora" className="block text-sm font-medium text-neutral-700 mb-1.5">Data e Hora <span className="text-red-500">*</span></label>
          <input id="dataHora" name="dataHora" type="datetime-local" required className={fieldCls("dataHora")} />
          <FieldError field="dataHora" />
        </div>

        <div>
          <label htmlFor="duracaoMinutos" className="block text-sm font-medium text-neutral-700 mb-1.5">Duração</label>
          <select id="duracaoMinutos" name="duracaoMinutos" className={fieldCls("duracaoMinutos")}>
            <option value="60">1 hora</option>
            <option value="90">1h30min</option>
            <option value="120">2 horas</option>
            <option value="150">2h30min</option>
            <option value="180">3 horas</option>
          </select>
          <FieldError field="duracaoMinutos" />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Valor cobrado ao aluno</label>
          <CurrencyInput
            value={valorCobrado}
            onChange={setValorCobrado}
            placeholder="0,00"
            hasError={!!camposErro.valorCobrado}
          />
          <FieldError field="valorCobrado" />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="observacoes" className="block text-sm font-medium text-neutral-700 mb-1.5">Observações</label>
          <textarea id="observacoes" name="observacoes" rows={2}
            placeholder="Instruções especiais para esta aula..."
            className="w-full border border-neutral-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
        </div>

        <div className="md:col-span-2">
          <button type="submit" disabled={isPending}
            className="bg-primary-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-primary-700 transition-colors text-sm disabled:opacity-60">
            {isPending ? "Agendando..." : "Agendar Aula + Notificar por E-mail"}
          </button>
        </div>
      </form>
    </div>
  )
}
