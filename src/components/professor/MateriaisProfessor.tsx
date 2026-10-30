"use client"

import { useRef, useState, useTransition } from "react"
import { enviarMaterialProfessor, excluirMaterialProfessor } from "@/app/professor/actions"

type Material = { id: string; originalName: string; mimetype: string; sizeBytes: number; podeExcluir?: boolean }

const TIPOS_ACEITOS = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
const LIMITE_MB = 300

function fmtTamanho(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}
function urlMaterial(m: Material, ver = false) {
  return `/api/materiais/${m.id}/${encodeURIComponent(m.originalName)}${ver ? "?ver=1" : ""}`
}
const VISUALIZAVEL = ["application/pdf", "image/jpeg", "image/png"]

/** Lista de arquivos com Abrir / Baixar (e Excluir, quando permitido). */
export function ListaArquivos({ materiais, onExcluir, excluindo }: {
  materiais: Material[]
  onExcluir?: (m: Material) => void
  excluindo?: string | null
}) {
  return (
    <ul className="space-y-1.5">
      {materiais.map(m => (
        <li key={m.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-600">
          <span aria-hidden="true">📄</span>
          <a href={urlMaterial(m)} className="font-medium text-primary-700 hover:underline break-all">{m.originalName}</a>
          <span className="text-neutral-400">({fmtTamanho(m.sizeBytes)})</span>
          <span className="flex gap-1.5 ml-auto">
            {VISUALIZAVEL.includes(m.mimetype) && (
              <a href={urlMaterial(m, true)} target="_blank" rel="noopener noreferrer"
                className="border border-neutral-200 bg-white px-2 py-1 rounded-md hover:bg-neutral-100">Abrir</a>
            )}
            <a href={urlMaterial(m)}
              className="border border-primary-200 bg-white text-primary-700 px-2 py-1 rounded-md hover:bg-primary-50 font-medium">⬇ Baixar</a>
            {onExcluir && m.podeExcluir && (
              <button type="button" onClick={() => onExcluir(m)} disabled={excluindo === m.id}
                className="border border-red-200 bg-white text-red-600 px-2 py-1 rounded-md hover:bg-red-50 disabled:opacity-50">
                {excluindo === m.id ? "…" : "Excluir"}
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Bloco "Materiais para o aluno": envio de arquivo + lista do que o professor já enviou. */
export function MateriaisParaAluno({ appointmentId, alunoNome, enviados }: {
  appointmentId: string
  alunoNome: string
  enviados: Material[]
}) {
  const [aberto, setAberto] = useState(false)
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const primeiro = alunoNome.split(" ")[0]

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    const file = fileRef.current?.files?.[0]
    if (!file) { setMsg({ tipo: "erro", texto: "Selecione um arquivo." }); return }
    if (file.size > LIMITE_MB * 1024 * 1024) { setMsg({ tipo: "erro", texto: `Arquivo muito grande. Limite: ${LIMITE_MB}MB.` }); return }
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await enviarMaterialProfessor(fd)
      if (res.success) {
        setMsg({ tipo: "ok", texto: `"${res.data.originalName}" enviado para ${primeiro}.` })
        if (fileRef.current) fileRef.current.value = ""
        setAberto(false)
      } else {
        setMsg({ tipo: "erro", texto: res.error })
      }
    })
  }

  function excluir(m: Material) {
    if (!window.confirm(`Excluir "${m.originalName}"? O aluno deixará de ver este arquivo.`)) return
    setExcluindo(m.id)
    startTransition(async () => {
      const res = await excluirMaterialProfessor(m.id)
      setExcluindo(null)
      if (!res.success) setMsg({ tipo: "erro", texto: res.error })
    })
  }

  return (
    <div className="bg-primary-50/60 border border-primary-100 rounded-xl p-3 mt-2 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-primary-800">
          📚 Materiais para {primeiro} ({enviados.length})
        </p>
        {!aberto && (
          <button type="button" onClick={() => { setAberto(true); setMsg(null) }}
            className="text-xs font-semibold bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700">
            + Enviar material
          </button>
        )}
      </div>

      {enviados.length > 0 && <ListaArquivos materiais={enviados} onExcluir={excluir} excluindo={excluindo} />}

      {aberto && (
        <form onSubmit={enviar} className="space-y-2 pt-1">
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <input ref={fileRef} name="file" type="file" accept={TIPOS_ACEITOS} required
            aria-label={`Arquivo para ${primeiro}`}
            className="w-full border border-neutral-300 bg-white rounded-lg px-2 py-1.5 text-xs file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-primary-50 file:text-primary-700 file:font-medium" />
          <p className="text-[11px] text-neutral-500">PDF, Word, Excel, JPG, PNG ou TXT · até {LIMITE_MB}MB. Só {primeiro} (e a coordenação) terá acesso.</p>
          <div className="flex gap-2">
            <button type="submit" disabled={isPending}
              className="text-xs font-semibold bg-primary-600 text-white px-4 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-60">
              {isPending ? "Enviando..." : "Enviar"}
            </button>
            <button type="button" onClick={() => setAberto(false)}
              className="text-xs text-neutral-600 border border-neutral-200 bg-white px-3 py-1.5 rounded-lg hover:bg-neutral-50">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {msg && (
        <p className={`text-xs ${msg.tipo === "ok" ? "text-green-700" : "text-red-600"}`}>
          {msg.tipo === "ok" ? "✅ " : "❌ "}{msg.texto}
        </p>
      )}
    </div>
  )
}
