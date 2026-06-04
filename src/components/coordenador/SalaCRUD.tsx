"use client"

import { useState, useTransition } from "react"
import { atualizarSala, excluirSala, toggleAtivoSala } from "@/app/coordenador/salas/actions"

type HorarioDia = { dia: string; inicio: string; fim: string }

type Sala = {
  id: number
  name: string
  type: "PRESENCIAL" | "VIRTUAL"
  location: string | null
  capacity: number | null
  active: boolean
  horariosDisponiveis?: any
}

const DIAS_SEMANA = [
  { key: "SEG", label: "Segunda" },
  { key: "TER", label: "Terça" },
  { key: "QUA", label: "Quarta" },
  { key: "QUI", label: "Quinta" },
  { key: "SEX", label: "Sexta" },
  { key: "SAB", label: "Sábado" },
  { key: "DOM", label: "Domingo" },
]

function parseHorarios(raw: any): HorarioDia[] {
  if (!raw || !Array.isArray(raw)) return []
  return raw.filter((h: any) => h.dia && h.inicio && h.fim)
}

function HorariosDisplay({ horarios }: { horarios: HorarioDia[] }) {
  if (horarios.length === 0) return <span className="text-neutral-400 italic text-xs">Sem restrição de horário</span>
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {horarios.map(h => (
        <span key={h.dia} className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
          {DIAS_SEMANA.find(d => d.key === h.dia)?.label ?? h.dia}: {h.inicio}–{h.fim}
        </span>
      ))}
    </div>
  )
}

function HorariosEditor({
  value,
  onChange,
}: {
  value: HorarioDia[]
  onChange: (v: HorarioDia[]) => void
}) {
  function toggle(dia: string, checked: boolean) {
    if (checked) {
      onChange([...value, { dia, inicio: "08:00", fim: "18:00" }])
    } else {
      onChange(value.filter(h => h.dia !== dia))
    }
  }

  function update(dia: string, field: "inicio" | "fim", val: string) {
    onChange(value.map(h => (h.dia === dia ? { ...h, [field]: val } : h)))
  }

  return (
    <div className="space-y-2">
      {DIAS_SEMANA.map(({ key, label }) => {
        const horario = value.find(h => h.dia === key)
        const ativo = !!horario
        return (
          <div key={key} className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-neutral-700 w-24 cursor-pointer">
              <input
                type="checkbox"
                checked={ativo}
                onChange={e => toggle(key, e.target.checked)}
                className="rounded"
              />
              {label}
            </label>
            {ativo && (
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="time"
                  value={horario!.inicio}
                  onChange={e => update(key, "inicio", e.target.value)}
                  className="border border-neutral-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="text-neutral-400">até</span>
                <input
                  type="time"
                  value={horario!.fim}
                  onChange={e => update(key, "fim", e.target.value)}
                  className="border border-neutral-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function SalaCRUD({ salas }: { salas: Sala[] }) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Record<string, any>>({})
  const [isPending, startTransition] = useTransition()

  function startEdit(s: Sala) {
    setEditingId(s.id)
    setEditData({
      name: s.name,
      type: s.type,
      location: s.location ?? "",
      capacity: s.capacity?.toString() ?? "",
      horarios: parseHorarios(s.horariosDisponiveis),
    })
  }

  async function handleUpdate(id: number) {
    const fd = new FormData()
    fd.set("name", editData.name)
    fd.set("type", editData.type)
    fd.set("location", editData.location)
    fd.set("capacity", editData.capacity)
    fd.set("horariosDisponiveis", JSON.stringify(editData.horarios))
    startTransition(async () => {
      await atualizarSala(id, fd)
      setEditingId(null)
    })
  }

  async function handleToggleAtivo(id: number, ativo: boolean) {
    startTransition(async () => {
      await toggleAtivoSala(id, !ativo)
    })
  }

  async function handleExcluir(id: number) {
    startTransition(async () => {
      await excluirSala(id)
    })
  }

  if (salas.length === 0)
    return <p className="text-neutral-500 text-center py-8">Nenhuma sala cadastrada.</p>

  return (
    <div className="space-y-3">
      {salas.map(sala => {
        const isEditing = editingId === sala.id
        const horarios = parseHorarios(sala.horariosDisponiveis)

        return (
          <div key={sala.id} className={`bg-white border border-neutral-200 rounded-2xl p-4 ${!sala.active ? "opacity-60" : ""}`}>
            {!isEditing ? (
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{sala.type === "PRESENCIAL" ? "🏫" : "💻"}</span>
                    <p className="font-semibold text-neutral-900">{sala.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sala.type === "PRESENCIAL" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                      {sala.type === "PRESENCIAL" ? "Presencial" : "Virtual"}
                    </span>
                    {!sala.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-neutral-100 text-neutral-500">Inativa</span>
                    )}
                  </div>
                  {sala.location && <p className="text-sm text-neutral-500 mt-0.5 truncate max-w-sm">{sala.location}</p>}
                  {sala.capacity && <p className="text-xs text-neutral-400">Capacidade: {sala.capacity} alunos</p>}
                  <div className="mt-1">
                    <HorariosDisplay horarios={horarios} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(sala)}
                    className="text-xs text-primary-600 border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors font-medium"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleAtivo(sala.id, sala.active)}
                    disabled={isPending}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border disabled:opacity-60 ${
                      sala.active
                        ? "text-amber-600 border-amber-200 hover:bg-amber-50"
                        : "text-green-600 border-green-200 hover:bg-green-50"
                    }`}
                  >
                    {sala.active ? "Desativar" : "Reativar"}
                  </button>
                  <button
                    onClick={() => handleExcluir(sala.id)}
                    disabled={isPending}
                    className="text-xs text-red-500 hover:text-red-700 font-medium border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-neutral-700">Editando sala</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Nome *</label>
                    <input
                      value={editData.name}
                      onChange={e => setEditData(p => ({ ...p, name: e.target.value }))}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Tipo *</label>
                    <select
                      value={editData.type}
                      onChange={e => setEditData(p => ({ ...p, type: e.target.value }))}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="PRESENCIAL">🏫 Presencial</option>
                      <option value="VIRTUAL">💻 Virtual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Endereço / URL</label>
                    <input
                      value={editData.location}
                      onChange={e => setEditData(p => ({ ...p, location: e.target.value }))}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Endereço físico ou link de videoconferência"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Capacidade</label>
                    <input
                      type="number"
                      min="1"
                      value={editData.capacity}
                      onChange={e => setEditData(p => ({ ...p, capacity: e.target.value }))}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Nº máximo de alunos"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-2">Horários disponíveis para agendamento</label>
                  <div className="bg-neutral-50 rounded-xl p-3">
                    <HorariosEditor
                      value={editData.horarios}
                      onChange={horarios => setEditData(p => ({ ...p, horarios }))}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdate(sala.id)}
                    disabled={isPending}
                    className="bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-60"
                  >
                    {isPending ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-sm text-neutral-600 border border-neutral-200 px-4 py-2 rounded-lg hover:bg-neutral-50 transition-colors"
                  >
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
