"use client"

import { useState, useTransition } from "react"
import { atualizarDisciplina, excluirDisciplina } from "@/app/coordenador/disciplinas/actions"

type Professor = { id: string; name: string }

type Disciplina = {
  id: number
  name: string
  description: string | null
  professores: Professor[]
}

export function DisciplinaCRUD({
  disciplinas,
  todosOsProfessores,
}: {
  disciplinas: Disciplina[]
  todosOsProfessores: Professor[]
}) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Record<string, any>>({})
  const [isPending, startTransition] = useTransition()

  function startEdit(d: Disciplina) {
    setEditingId(d.id)
    setEditData({
      name: d.name,
      description: d.description ?? "",
      professorIds: d.professores.map(p => p.id),
    })
  }

  function toggleProfessor(pid: string) {
    setEditData(prev => {
      const ids: string[] = prev.professorIds
      return {
        ...prev,
        professorIds: ids.includes(pid) ? ids.filter(x => x !== pid) : [...ids, pid],
      }
    })
  }

  async function handleUpdate(id: number) {
    const fd = new FormData()
    fd.set("name", editData.name)
    fd.set("description", editData.description)
    for (const pid of editData.professorIds) fd.append("professorIds", pid)
    startTransition(async () => {
      await atualizarDisciplina(id, fd)
      setEditingId(null)
    })
  }

  async function handleExcluir(id: number) {
    startTransition(async () => {
      await excluirDisciplina(id)
    })
  }

  if (disciplinas.length === 0)
    return <p className="text-neutral-500 text-center py-8">Nenhuma disciplina cadastrada.</p>

  return (
    <div className="space-y-3">
      {disciplinas.map(d => {
        const isEditing = editingId === d.id
        return (
          <div key={d.id} className="bg-white border border-neutral-200 rounded-2xl p-4">
            {!isEditing ? (
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-neutral-900">{d.name}</p>
                  {d.description && <p className="text-sm text-neutral-500 mt-0.5">{d.description}</p>}
                  {d.professores.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {d.professores.map(p => (
                        <span key={p.id} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                          {p.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-400 mt-1 italic">Nenhum professor associado</p>
                  )}
                </div>
                <div className="flex gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => startEdit(d)}
                    className="text-xs text-primary-600 border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors font-medium"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleExcluir(d.id)}
                    disabled={isPending}
                    className="text-xs text-red-500 hover:text-red-700 font-medium border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-neutral-700">Editando disciplina</p>
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
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Descrição</label>
                    <input
                      value={editData.description}
                      onChange={e => setEditData(p => ({ ...p, description: e.target.value }))}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Opcional"
                    />
                  </div>
                </div>
                {todosOsProfessores.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-2">Professores</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {todosOsProfessores.map(p => (
                        <label key={p.id} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editData.professorIds.includes(p.id)}
                            onChange={() => toggleProfessor(p.id)}
                            className="rounded"
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdate(d.id)}
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
