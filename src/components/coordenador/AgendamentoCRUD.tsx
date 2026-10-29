"use client"

import { useState, useTransition } from "react"
import { atualizarAgendamento, confirmarAgendamento } from "@/app/coordenador/agendamentos/actions"
import { CurrencyInput } from "@/components/ui/CurrencyInput"

type Sala = { id: number; name: string; type: string }
type Coordenador = { id: string; name: string }

type Agendamento = {
  id: string
  disciplina: string
  aluno: string
  professor: string
  dataHora: string
  duracaoMinutos: number
  status: string
  sala: string | null
  salaTipo: string | null
  salaId: number | null
  observacoes: string | null
  valorCobrado: string | null
  coordenadorId: string
  coordenador: string
}

const STATUS_BADGE: Record<string, string> = {
  PENDENTE:  "bg-amber-100 text-amber-700",
  AGENDADO:  "bg-green-100 text-green-700",
  CANCELADO: "bg-red-100 text-red-700",
  CONCLUIDO: "bg-blue-100 text-blue-700",
}

const STATUS_LABEL: Record<string, string> = {
  PENDENTE:  "Pendente",
  AGENDADO:  "Agendado",
  CANCELADO: "Cancelado",
  CONCLUIDO: "Concluído",
}

function toLocalDatetimeInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const INPUT_CLS = "w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
const INPUT_ERR = "w-full border border-red-400 ring-2 ring-red-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-red-400"

function fieldCls(camposErro: Record<string, string>, field: string) {
  return camposErro[field] ? INPUT_ERR : INPUT_CLS
}

function FieldError({ camposErro, field }: { camposErro: Record<string, string>; field: string }) {
  if (!camposErro[field]) return null
  return <p className="text-xs text-red-600 mt-1">{camposErro[field]}</p>
}

export function AgendamentoCRUD({ agendamentos, salas, coordenadores = [] }: {
  agendamentos: Agendamento[]
  salas: Sala[]
  coordenadores?: Coordenador[]
}) {
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editData, setEditData]         = useState<Record<string, any>>({})
  const [camposErro, setCamposErro]     = useState<Record<string, string>>({})
  const [erroGeral, setErroGeral]       = useState<string | null>(null)
  const [isPending, startTransition]    = useTransition()
  const [erroLista, setErroLista]       = useState<Record<string, string>>({})
  const [filtro, setFiltro]             = useState<"TODOS" | "PENDENTE" | "AGENDADO" | "CONCLUIDO" | "CANCELADO">("TODOS")
  const [busca, setBusca]               = useState("")

  const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const lista = agendamentos.filter(a =>
    (filtro === "TODOS" || a.status === filtro) &&
    (!busca || norm(`${a.aluno} ${a.professor} ${a.disciplina} ${a.coordenador}`).includes(norm(busca))))

  function handleConfirmar(id: string) {
    setErroLista(p => { const n = { ...p }; delete n[id]; return n })
    startTransition(async () => {
      const res = await confirmarAgendamento(id)
      if (!res.success) setErroLista(p => ({ ...p, [id]: res.error ?? "Erro ao confirmar" }))
    })
  }

  function startEdit(apt: Agendamento) {
    setEditingId(apt.id)
    setCamposErro({})
    setErroGeral(null)
    setEditData({
      status:         apt.status,
      dataHora:       toLocalDatetimeInput(apt.dataHora),
      duracaoMinutos: String(apt.duracaoMinutos),
      roomId:         apt.salaId ? String(apt.salaId) : "",
      observacoes:    apt.observacoes ?? "",
      valorCobrado:   apt.valorCobrado ?? "",
      coordenadorId:  apt.coordenadorId,
    })
  }

  async function handleSalvar(id: string) {
    setCamposErro({})
    setErroGeral(null)
    const fd = new FormData()
    fd.set("status",         editData.status)
    fd.set("dataHora",       editData.dataHora)
    fd.set("duracaoMinutos", editData.duracaoMinutos)
    fd.set("roomId",         editData.roomId)
    fd.set("observacoes",    editData.observacoes)
    fd.set("valorCobrado",   editData.valorCobrado)
    fd.set("coordenadorId",  editData.coordenadorId ?? "")

    startTransition(async () => {
      const res = await atualizarAgendamento(id, fd)
      if (res.success) {
        setEditingId(null)
      } else {
        if ("fieldErrors" in res && res.fieldErrors) setCamposErro(res.fieldErrors as Record<string, string>)
        setErroGeral(res.error ?? "Erro ao salvar")
      }
    })
  }

  if (agendamentos.length === 0)
    return (
      <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-8 text-center text-neutral-500">
        Nenhum agendamento ainda. Use o formulário acima.
      </div>
    )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por aluno, professor, disciplina ou coordenador…" aria-label="Buscar agendamento"
          className="flex-1 min-w-0 w-full sm:w-auto sm:min-w-56 border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <div className="flex flex-wrap rounded-lg overflow-hidden border border-neutral-200 text-xs font-medium">
          {([["TODOS", "Todos"], ["PENDENTE", "Pendentes"], ["AGENDADO", "Agendados"], ["CONCLUIDO", "Concluídos"], ["CANCELADO", "Cancelados"]] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setFiltro(v)}
              className={`px-3 py-1.5 transition-colors ${filtro === v ? "bg-primary-600 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {lista.length === 0 && (
        <p className="text-sm text-neutral-500 text-center py-6">Nenhum agendamento com esse filtro.</p>
      )}
      {lista.map(apt => {
        const isEditing = editingId === apt.id

        return (
          <div key={apt.id} className={`bg-white border border-neutral-200 rounded-2xl p-4 transition-all ${isEditing ? "ring-2 ring-primary-300" : ""}`}>
            {!isEditing ? (
              /* ─── Visualização ─── */
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="font-medium text-neutral-900">
                    {apt.disciplina} — <span className="text-neutral-700">{apt.aluno}</span>
                  </p>
                  <p className="text-sm text-neutral-500">Prof. {apt.professor}</p>
                  <p className="text-xs text-neutral-500">Coordenador: <span className="font-medium text-neutral-700">{apt.coordenador}</span></p>
                  <p className="text-sm text-neutral-500">
                    {new Date(apt.dataHora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    {" · "}{apt.duracaoMinutos}min
                    {apt.sala && (
                      <span className="ml-2 text-xs text-neutral-400">
                        · {apt.salaTipo === "VIRTUAL" ? "💻" : "🏫"} {apt.sala}
                      </span>
                    )}
                  </p>
                  {erroLista[apt.id] && (
                    <p className="text-xs text-red-600 mt-1">{erroLista[apt.id]}</p>
                  )}
                  {!apt.valorCobrado && apt.status !== "CANCELADO" && (
                    <p className="text-xs text-amber-600 mt-0.5">⚠ Sem valor cobrado — edite para informar</p>
                  )}
                  {apt.valorCobrado && (
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Valor aluno: <span className="font-semibold">
                        {Number(apt.valorCobrado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </p>
                  )}
                  {apt.observacoes && (
                    <p className="text-xs text-neutral-400 italic mt-0.5">{apt.observacoes}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_BADGE[apt.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                    {STATUS_LABEL[apt.status] ?? apt.status}
                  </span>
                  {apt.status === "PENDENTE" && (
                    <button onClick={() => handleConfirmar(apt.id)} disabled={isPending}
                      title="Aluno e professor confirmaram"
                      className="text-xs text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors font-medium disabled:opacity-60">
                      ✓ Confirmar
                    </button>
                  )}
                  <button onClick={() => startEdit(apt)}
                    className="text-xs text-primary-600 border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors font-medium">
                    Editar
                  </button>
                </div>
              </div>
            ) : (
              /* ─── Edição ─── */
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <p className="text-sm font-semibold text-neutral-700">
                    Editando: <span className="text-neutral-900">{apt.disciplina} — {apt.aluno}</span>
                  </p>
                  <p className="text-xs text-neutral-400">Prof. {apt.professor}</p>
                </div>

                {/* Erros por campo */}
                {Object.keys(camposErro).length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 space-y-0.5">
                    {Object.values(camposErro).map((msg, i) => (
                      <p key={i} className="text-xs text-red-600">• {msg}</p>
                    ))}
                  </div>
                )}
                {erroGeral && !Object.keys(camposErro).length && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">{erroGeral}</div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Status</label>
                    <select value={editData.status} onChange={e => setEditData(p => ({ ...p, status: e.target.value }))}
                      className={fieldCls(camposErro, "status")}>
                      <option value="PENDENTE">Pendente (aguardando confirmação)</option>
                      <option value="AGENDADO">Agendado (confirmado)</option>
                      <option value="CONCLUIDO">Concluído</option>
                      <option value="CANCELADO">Cancelado</option>
                    </select>
                    <FieldError camposErro={camposErro} field="status" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Sala</label>
                    <select value={editData.roomId} onChange={e => setEditData(p => ({ ...p, roomId: e.target.value }))}
                      className={fieldCls(camposErro, "roomId")}>
                      <option value="">Sem sala definida</option>
                      {salas.map(s => (
                        <option key={s.id} value={String(s.id)}>{s.type === "VIRTUAL" ? "💻" : "🏫"} {s.name}</option>
                      ))}
                    </select>
                    <FieldError camposErro={camposErro} field="roomId" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Data e Hora</label>
                    <input type="datetime-local" value={editData.dataHora}
                      onChange={e => setEditData(p => ({ ...p, dataHora: e.target.value }))}
                      className={fieldCls(camposErro, "dataHora")} />
                    <FieldError camposErro={camposErro} field="dataHora" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Duração</label>
                    <select value={editData.duracaoMinutos}
                      onChange={e => setEditData(p => ({ ...p, duracaoMinutos: e.target.value }))}
                      className={fieldCls(camposErro, "duracaoMinutos")}>
                      <option value="60">1 hora</option>
                      <option value="90">1h30min</option>
                      <option value="120">2 horas</option>
                      <option value="150">2h30min</option>
                      <option value="180">3 horas</option>
                    </select>
                    <FieldError camposErro={camposErro} field="duracaoMinutos" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Valor cobrado ao aluno <span className="text-red-500">*</span></label>
                    <CurrencyInput
                      value={editData.valorCobrado}
                      onChange={v => setEditData(p => ({ ...p, valorCobrado: v }))}
                      placeholder="0,00"
                      hasError={!!camposErro.valorCobrado}
                      className="rounded-lg py-2"
                    />
                    <FieldError camposErro={camposErro} field="valorCobrado" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Coordenador que acompanha</label>
                    <select value={editData.coordenadorId} onChange={e => setEditData(p => ({ ...p, coordenadorId: e.target.value }))}
                      className={fieldCls(camposErro, "coordenadorId")}>
                      {/* garante que o atual apareça mesmo se estiver inativo */}
                      {!coordenadores.some(c => c.id === apt.coordenadorId) && (
                        <option value={apt.coordenadorId}>{apt.coordenador}</option>
                      )}
                      {coordenadores.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <FieldError camposErro={camposErro} field="coordenadorId" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Observações</label>
                    <textarea rows={2} value={editData.observacoes}
                      onChange={e => setEditData(p => ({ ...p, observacoes: e.target.value }))}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      placeholder="Instruções especiais para esta aula..." />
                  </div>
                </div>

                {editData.status === "CANCELADO" && apt.status !== "CANCELADO" && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    Aula cancelada não gera cobrança ao aluno nem pagamento ao professor.
                    {apt.status === "CONCLUIDO" && " O débito já lançado na conta do aluno será estornado automaticamente."}
                  </p>
                )}

                <div className="flex gap-2">
                  <button onClick={() => handleSalvar(apt.id)} disabled={isPending}
                    className="bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-60">
                    {isPending ? "Salvando..." : "Salvar alterações"}
                  </button>
                  <button onClick={() => { setEditingId(null); setCamposErro({}); setErroGeral(null) }}
                    className="text-sm text-neutral-600 border border-neutral-200 px-4 py-2 rounded-lg hover:bg-neutral-50 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
