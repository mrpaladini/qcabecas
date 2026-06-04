"use client"

import { useState, useTransition } from "react"
import { atualizarAgendamento } from "@/app/coordenador/agendamentos/actions"
import { CurrencyInput } from "@/components/ui/CurrencyInput"

type Sala = { id: number; name: string; type: string }

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
}

const STATUS_BADGE: Record<string, string> = {
  AGENDADO:  "bg-green-100 text-green-700",
  CANCELADO: "bg-red-100 text-red-700",
  CONCLUIDO: "bg-blue-100 text-blue-700",
}

const STATUS_LABEL: Record<string, string> = {
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

export function AgendamentoCRUD({ agendamentos, salas }: { agendamentos: Agendamento[]; salas: Sala[] }) {
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editData, setEditData]         = useState<Record<string, any>>({})
  const [camposErro, setCamposErro]     = useState<Record<string, string>>({})
  const [erroGeral, setErroGeral]       = useState<string | null>(null)
  const [isPending, startTransition]    = useTransition()

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
      {agendamentos.map(apt => {
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
                  <p className="text-sm text-neutral-500">
                    {new Date(apt.dataHora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    {" · "}{apt.duracaoMinutos}min
                    {apt.sala && (
                      <span className="ml-2 text-xs text-neutral-400">
                        · {apt.salaTipo === "VIRTUAL" ? "💻" : "🏫"} {apt.sala}
                      </span>
                    )}
                  </p>
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
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_BADGE[apt.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                    {STATUS_LABEL[apt.status] ?? apt.status}
                  </span>
                  <button onClick={() => startEdit(apt)}
                    className="text-xs text-primary-600 border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors font-medium">
                    Editar
                  </button>
                </div>
              </div>
            ) : (
              /* ─── Edição ─── */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
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
                      <option value="AGENDADO">Agendado</option>
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
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Valor cobrado ao aluno</label>
                    <CurrencyInput
                      value={editData.valorCobrado}
                      onChange={v => setEditData(p => ({ ...p, valorCobrado: v }))}
                      placeholder="0,00"
                      hasError={!!camposErro.valorCobrado}
                      className="rounded-lg py-2"
                    />
                    <FieldError camposErro={camposErro} field="valorCobrado" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Observações</label>
                    <textarea rows={2} value={editData.observacoes}
                      onChange={e => setEditData(p => ({ ...p, observacoes: e.target.value }))}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      placeholder="Instruções especiais para esta aula..." />
                  </div>
                </div>

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
