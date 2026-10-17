"use client"

import { useRef, useState, useTransition } from "react"
import { criarUsuario } from "@/app/coordenador/usuarios/actions"
import { CurrencyInput } from "@/components/ui/CurrencyInput"
import { ProfessorCampos, PROFESSOR_EXTRAS_VAZIO, appendProfessorExtras, type ProfessorExtras } from "./ProfessorCampos"

const LABELS: Record<string, string> = {
  ALUNO: "Aluno",
  PROFESSOR: "Professor",
  COORDENADOR: "Coordenador",
}

function Campo({ label, name, type = "text", placeholder, required, col2 }: {
  label: string; name: string; type?: string; placeholder?: string; required?: boolean; col2?: boolean
}) {
  return (
    <div className={col2 ? "md:col-span-2" : ""}>
      <label htmlFor={name} className="block text-sm font-medium text-neutral-700 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input id={name} name={name} type={type} required={required} placeholder={placeholder}
        className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
    </div>
  )
}

function CampoValor({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-1">{label}</label>
      <CurrencyInput value={value} onChange={onChange} />
      {hint && <p className="text-xs text-neutral-400 mt-1">{hint}</p>}
    </div>
  )
}

function Observacoes({ placeholder }: { placeholder: string }) {
  return (
    <div className="md:col-span-2">
      <label htmlFor="observacoes" className="block text-sm font-medium text-neutral-700 mb-1">Observações</label>
      <textarea id="observacoes" name="observacoes" rows={3} placeholder={placeholder}
        className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
    </div>
  )
}

export function NovoUsuarioForm({ role }: { role: "ALUNO" | "PROFESSOR" | "COORDENADOR" }) {
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null)
  const [erro, setErro]               = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()
  const [precoPresencial, setPrecoPresencial] = useState("")
  const [precoVirtual, setPrecoVirtual]       = useState("")
  const [extras, setExtras] = useState<ProfessorExtras>(PROFESSOR_EXTRAS_VAZIO)
  const formRef                       = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setSenhaGerada(null)
    const formData = new FormData(e.currentTarget)
    formData.set("role", role)
    formData.set("precoPresencial", precoPresencial)
    formData.set("precoVirtual", precoVirtual)
    if (role === "PROFESSOR") appendProfessorExtras(formData, extras)

    startTransition(async () => {
      const res = await criarUsuario(formData)
      if (res.success) {
        setSenhaGerada(res.data!.senhaGerada)
        formRef.current?.reset()
        setPrecoPresencial("")
        setPrecoVirtual("")
        setExtras(PROFESSOR_EXTRAS_VAZIO)
      } else {
        setErro(res.error ?? "Erro ao cadastrar")
      }
    })
  }

  const label = LABELS[role] ?? role
  const secao = "text-sm font-semibold text-neutral-700 mb-3 border-t border-neutral-100 pt-4"

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6">
      <h3 className="font-semibold text-neutral-900 mb-1">Novo {label}</h3>
      <p className="text-xs text-neutral-400 mb-4">A data de cadastro é registrada automaticamente.</p>

      {senhaGerada && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-800 font-medium">✅ Cadastrado com sucesso!</p>
          <p className="text-sm text-green-700 mt-1">Senha gerada: <code className="font-mono font-bold bg-green-100 px-2 py-0.5 rounded">{senhaGerada}</code></p>
          <p className="text-xs text-green-600 mt-1">Anote a senha — ela aparece apenas uma vez.</p>
        </div>
      )}
      {erro && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{erro}</div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        {/* Dados básicos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo label="Nome completo" name="name" required />
          <Campo label="E-mail" name="email" type="email" required />
          <Campo label="Telefone" name="phone" placeholder="(19) 99999-9999" />
          {role === "PROFESSOR" && (
            <Campo label="Telefone 2" name="phone2" placeholder="(19) 99999-9999" />
          )}
        </div>

        {/* Valores */}
        {role === "ALUNO" && (
          <div>
            <h4 className={secao}>Valor combinado por aula</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CampoValor label="🏫 Aula presencial" value={precoPresencial} onChange={setPrecoPresencial} />
              <CampoValor label="💻 Aula online (remota)" value={precoVirtual} onChange={setPrecoVirtual} />
            </div>
            <p className="text-xs text-neutral-400 mt-2">Esse valor é preenchido automaticamente no agendamento (pode ser alterado lá).</p>
          </div>
        )}

        {role === "PROFESSOR" && (
          <>
            <div>
              <h4 className={secao}>Valor pago ao professor (por hora)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CampoValor label="🏫 Presencial" value={precoPresencial} onChange={setPrecoPresencial} />
                <CampoValor label="💻 Online" value={precoVirtual} onChange={setPrecoVirtual} />
              </div>
            </div>

            <div>
              <h4 className={secao}>Atuação</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <Campo label="Escola em que atua como professor" name="escolaAtuacao" col2 placeholder="Ex: Colégio Objetivo Vinhedo" />
              </div>
              <ProfessorCampos value={extras} onChange={setExtras} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Observacoes placeholder="Formação, especialidades, preferências, informações relevantes…" />
            </div>
          </>
        )}

        {/* Campos exclusivos do aluno */}
        {role === "ALUNO" && (
          <>
            <div>
              <h4 className={secao}>Responsável</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Campo label="Nome do responsável"  name="responsavelNome" />
                <Campo label="CPF do responsável"   name="cpfResponsavel"  placeholder="000.000.000-00" />
                <Campo label="Telefone do responsável" name="responsavelTelefone" placeholder="(19) 99999-9999" />
              </div>
            </div>

            <div>
              <h4 className={secao}>Endereço</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Campo label="Rua / Logradouro" name="rua"    col2 placeholder="Ex: Rua das Flores, 123" />
                <Campo label="Bairro"           name="bairro" placeholder="Ex: Centro" />
                <Campo label="Cidade"           name="cidade" placeholder="Ex: Vinhedo" />
                <Campo label="CEP"              name="cep"    placeholder="00000-000" />
                <Campo label="Referência"       name="referenciaEndereco" col2 placeholder="Ex: Próximo ao colégio X" />
              </div>
            </div>

            <div>
              <h4 className={secao}>Dados Educacionais</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Campo label="Escola atual" name="escola" placeholder="Ex: Colégio Estadual…" />
                <Campo label="Série / Ano"  name="serie"  placeholder="Ex: 8º ano, 2º EM" />
                <Observacoes placeholder="Dificuldades, necessidades especiais, informações relevantes…" />
              </div>
            </div>
          </>
        )}

        <button type="submit" disabled={isPending}
          className="w-full md:w-auto bg-primary-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-primary-700 transition-colors text-sm disabled:opacity-60">
          {isPending ? "Cadastrando..." : `Cadastrar ${label}`}
        </button>
      </form>
    </div>
  )
}
