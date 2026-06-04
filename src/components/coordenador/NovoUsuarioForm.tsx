"use client"

import { useRef, useState, useTransition } from "react"
import { criarUsuario } from "@/app/coordenador/usuarios/actions"

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

export function NovoUsuarioForm({ role }: { role: "ALUNO" | "PROFESSOR" | "COORDENADOR" }) {
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null)
  const [erro, setErro]               = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()
  const formRef                       = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setSenhaGerada(null)
    const formData = new FormData(e.currentTarget)
    formData.set("role", role)

    startTransition(async () => {
      const res = await criarUsuario(formData)
      if (res.success) {
        setSenhaGerada(res.data!.senhaGerada)
        formRef.current?.reset()
      } else {
        setErro(res.error ?? "Erro ao cadastrar")
      }
    })
  }

  const label = LABELS[role] ?? role

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6">
      <h3 className="font-semibold text-neutral-900 mb-4">Novo {label}</h3>

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
            <>
              <Campo label="R$/hora presencial" name="precoPresencial" type="number" placeholder="0,00" />
              <Campo label="R$/hora virtual"    name="precoVirtual"    type="number" placeholder="0,00" />
            </>
          )}
        </div>

        {/* Campos exclusivos do aluno */}
        {role === "ALUNO" && (
          <>
            <div>
              <h4 className="text-sm font-semibold text-neutral-700 mb-3 border-t border-neutral-100 pt-4">Responsável</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Campo label="Nome do responsável"  name="responsavelNome" />
                <Campo label="CPF do responsável"   name="cpfResponsavel"  placeholder="000.000.000-00" />
                <Campo label="Telefone do responsável" name="responsavelTelefone" placeholder="(19) 99999-9999" />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-neutral-700 mb-3 border-t border-neutral-100 pt-4">Endereço</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Campo label="Rua / Logradouro" name="rua"    col2 placeholder="Ex: Rua das Flores, 123" />
                <Campo label="Bairro"           name="bairro" placeholder="Ex: Centro" />
                <Campo label="Cidade"           name="cidade" placeholder="Ex: Vinhedo" />
                <Campo label="CEP"              name="cep"    placeholder="00000-000" />
                <Campo label="Referência"       name="referenciaEndereco" col2 placeholder="Ex: Próximo ao colégio X" />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-neutral-700 mb-3 border-t border-neutral-100 pt-4">Dados Educacionais</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Campo label="Escola atual" name="escola" placeholder="Ex: Colégio Estadual…" />
                <Campo label="Série / Ano"  name="serie"  placeholder="Ex: 8º ano, 2º EM" />
                <div className="md:col-span-2">
                  <label htmlFor="observacoes" className="block text-sm font-medium text-neutral-700 mb-1">Observações</label>
                  <textarea id="observacoes" name="observacoes" rows={3}
                    placeholder="Dificuldades, necessidades especiais, informações relevantes…"
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                </div>
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
