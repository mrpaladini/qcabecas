"use client"

import { useId, useRef } from "react"
import { PIX_TIPOS, validarPix, CURRICULO_ACCEPT, CURRICULO_MAX_BYTES, urlCurriculo } from "@/lib/professor"

export type CurriculoAtual = {
  nome: string
  mime: string | null
  tamanho: number | null
  enviadoEm: string | null
}

export type PixCurriculoValor = {
  pixTipo: string
  pixChave: string
  curriculo: File | null
  removerCurriculo: boolean
}

export const PIX_CURRICULO_VAZIO: PixCurriculoValor = { pixTipo: "", pixChave: "", curriculo: null, removerCurriculo: false }

/** Escreve os campos no FormData no formato esperado pelas server actions. */
export function appendPixCurriculo(fd: FormData, v: PixCurriculoValor) {
  fd.set("pixTipo", v.pixChave.trim() ? v.pixTipo : "")
  fd.set("pixChave", v.pixChave.trim())
  if (v.curriculo) fd.set("curriculo", v.curriculo)
  else fd.delete("curriculo")
  fd.set("removerCurriculo", v.removerCurriculo ? "true" : "false")
}

/** Erro de validação do lado do navegador (o servidor confere de novo). */
export function erroPixCurriculo(v: PixCurriculoValor): string | null {
  if (v.pixChave.trim()) {
    const e = validarPix(v.pixTipo, v.pixChave)
    if (e) return e
  }
  if (v.curriculo && v.curriculo.size > CURRICULO_MAX_BYTES) return "Currículo: o arquivo excede o limite de 10MB"
  return null
}

function fmtTamanho(b: number | null) {
  if (!b) return ""
  return b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`
}

/** Link "Ver" (PDF/imagem abrem no navegador) + "Baixar" do currículo — só coordenadores acessam. */
export function LinksCurriculo({ professorId, atual, className = "" }: { professorId: string; atual: CurriculoAtual; className?: string }) {
  const abre = ["application/pdf", "image/jpeg", "image/png"].includes(atual.mime ?? "")
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <span aria-hidden="true">📄</span>
      <span className="truncate max-w-52" title={atual.nome}>{atual.nome}</span>
      {abre && (
        <a href={urlCurriculo(professorId, atual.nome, true)} target="_blank" rel="noopener noreferrer"
          className="text-primary-600 hover:underline font-medium">Ver</a>
      )}
      <a href={urlCurriculo(professorId, atual.nome)} className="text-primary-600 hover:underline font-medium">Baixar</a>
    </span>
  )
}

const INPUT = "w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"

export function PixCurriculoCampos({ value, onChange, professorId, atual, compact }: {
  value: PixCurriculoValor
  onChange: (v: PixCurriculoValor) => void
  /** na edição: id do professor e currículo já salvo */
  professorId?: string
  atual?: CurriculoAtual | null
  compact?: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const uid = useId()
  const labelCls = compact ? "block text-xs font-medium text-neutral-600 mb-1" : "block text-sm font-medium text-neutral-700 mb-1"
  const tipoSel = PIX_TIPOS.find(t => t.key === value.pixTipo)
  const erroPix = value.pixChave.trim() && value.pixTipo ? validarPix(value.pixTipo, value.pixChave) : null

  function limparArquivo() {
    onChange({ ...value, curriculo: null })
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* PIX */}
      <div>
        <label htmlFor={`${uid}-tipo`} className={labelCls}>Tipo da chave PIX</label>
        <select id={`${uid}-tipo`} value={value.pixTipo} onChange={e => onChange({ ...value, pixTipo: e.target.value })} className={INPUT}>
          <option value="">Selecione…</option>
          {PIX_TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${uid}-chave`} className={labelCls}>Chave PIX</label>
        <input id={`${uid}-chave`} value={value.pixChave} maxLength={150}
          onChange={e => onChange({ ...value, pixChave: e.target.value })}
          placeholder={tipoSel?.placeholder ?? "Selecione o tipo da chave"}
          className={`${INPUT} ${erroPix ? "border-red-400 ring-2 ring-red-200" : ""}`} />
        {erroPix
          ? <p className="text-xs text-red-600 mt-1">{erroPix}</p>
          : value.pixChave.trim() && !value.pixTipo
            ? <p className="text-xs text-amber-600 mt-1">Selecione o tipo da chave.</p>
            : <p className="text-xs text-neutral-400 mt-1">Usada para pagar o professor (aparece em Contas a Pagar).</p>}
      </div>

      {/* Currículo */}
      <div className="md:col-span-2">
        <span className={labelCls}>Currículo</span>
        {atual && !value.removerCurriculo && !value.curriculo && professorId && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 mb-2">
            <LinksCurriculo professorId={professorId} atual={atual} />
            <span className="text-xs text-neutral-400">
              {fmtTamanho(atual.tamanho)}
              {atual.enviadoEm ? ` · enviado em ${new Date(atual.enviadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}
            </span>
            <button type="button" onClick={() => onChange({ ...value, removerCurriculo: true })}
              className="ml-auto text-xs text-red-600 hover:underline font-medium">Remover</button>
          </div>
        )}
        {atual && value.removerCurriculo && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-2">
            O currículo atual ({atual.nome}) será removido ao salvar.
            <button type="button" onClick={() => onChange({ ...value, removerCurriculo: false })}
              className="font-semibold hover:underline">Desfazer</button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept={CURRICULO_ACCEPT}
            onChange={e => onChange({ ...value, curriculo: e.target.files?.[0] ?? null, removerCurriculo: false })}
            className="block w-full sm:w-auto text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100" />
          {value.curriculo && (
            <button type="button" onClick={limparArquivo} className="text-xs text-neutral-500 hover:text-neutral-700 underline">limpar</button>
          )}
        </div>
        <p className="text-xs text-neutral-400 mt-1">
          PDF, Word (doc/docx), JPG ou PNG, até 10 MB. {atual && !value.removerCurriculo ? "Enviar outro arquivo substitui o atual. " : ""}
          Visível somente para coordenadores.
        </p>
      </div>
    </div>
  )
}
