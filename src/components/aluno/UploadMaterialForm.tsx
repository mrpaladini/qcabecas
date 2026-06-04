"use client"

import { useRef, useState, useTransition } from "react"
import { uploadMaterial } from "@/app/aluno/materiais/actions"

type Material = { id: number; originalName: string; sizeBytes: number; createdAt: string }
type Agendamento = {
  id: number
  disciplina: string
  professor: string
  dataHora: string
  materiais: Material[]
}

const TIPOS_ACEITOS = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
const LIMITE_MB = 300

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function UploadMaterialForm({ agendamentos }: { agendamentos: Agendamento[] }) {
  const [selecionado, setSelecionado] = useState<number | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const agendamentoAtual = agendamentos.find(a => a.id === selecionado)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setSucesso(null)

    const file = fileRef.current?.files?.[0]
    if (!file) { setErro("Selecione um arquivo."); return }
    if (file.size > LIMITE_MB * 1024 * 1024) {
      setErro(`Arquivo muito grande. Limite: ${LIMITE_MB}MB.`)
      return
    }

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await uploadMaterial(formData)
      if (res.success) {
        setSucesso(`"${res.data?.originalName}" enviado com sucesso!`)
        formRef.current?.reset()
        if (fileRef.current) fileRef.current.value = ""
      } else {
        setErro(res.error ?? "Erro ao enviar.")
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Seletor de aula */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
        <div>
          <label htmlFor="appointmentId" className="block text-sm font-medium text-neutral-700 mb-1.5">
            Selecione a aula *
          </label>
          <select
            id="appointmentId"
            value={selecionado ?? ""}
            onChange={e => { setSelecionado(e.target.value ? Number(e.target.value) : null); setSucesso(null); setErro(null) }}
            className="w-full border border-neutral-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Escolha a aula para enviar o material</option>
            {agendamentos.map(a => (
              <option key={a.id} value={a.id}>
                {a.disciplina} — Prof. {a.professor} —{" "}
                {new Date(a.dataHora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </option>
            ))}
          </select>
        </div>

        {/* Materiais já enviados para esta aula */}
        {agendamentoAtual && agendamentoAtual.materiais.length > 0 && (
          <div className="bg-neutral-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-neutral-600 mb-2">
              📎 Arquivos já enviados ({agendamentoAtual.materiais.length})
            </p>
            <ul className="space-y-1">
              {agendamentoAtual.materiais.map(m => (
                <li key={m.id} className="flex items-center justify-between text-xs text-neutral-600">
                  <span className="truncate">{m.originalName}</span>
                  <span className="text-neutral-400 ml-2 whitespace-nowrap">{formatBytes(m.sizeBytes)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Formulário de upload */}
        {selecionado && (
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <input type="hidden" name="appointmentId" value={selecionado} />

            <div>
              <label htmlFor="file" className="block text-sm font-medium text-neutral-700 mb-1.5">
                Arquivo *
              </label>
              <input
                ref={fileRef}
                id="file"
                name="file"
                type="file"
                accept={TIPOS_ACEITOS}
                required
                className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 file:font-medium hover:file:bg-primary-100 transition-colors"
              />
              <p className="text-xs text-neutral-400 mt-1">
                Aceitos: PDF, Word (doc/docx), Excel (xls/xlsx), JPG, PNG, TXT · Limite: {LIMITE_MB}MB
              </p>
            </div>

            {sucesso && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
                ✅ {sucesso}
              </div>
            )}
            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                ❌ {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="bg-primary-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-primary-700 transition-colors text-sm disabled:opacity-60"
            >
              {isPending ? "Enviando..." : "Enviar Arquivo"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
