"use client"

import { useState, useTransition } from "react"
import { atualizarUsuario, desativarUsuario, reativarUsuario, regerarSenha } from "@/app/coordenador/usuarios/actions"

type Usuario = {
  id: string
  name: string
  email: string
  phone: string | null
  tempPassword: string | null
  deletedAt: Date | null
  role: string
  precoPresencial?: string | null
  precoVirtual?: string | null
  // aluno
  responsavelNome?: string | null
  cpfResponsavel?: string | null
  responsavelTelefone?: string | null
  rua?: string | null
  bairro?: string | null
  cidade?: string | null
  cep?: string | null
  referenciaEndereco?: string | null
  escola?: string | null
  serie?: string | null
  observacoes?: string | null
}

function InputField({ label, value, onChange, type = "text", placeholder, span2 }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; span2?: boolean
}) {
  return (
    <div className={span2 ? "md:col-span-2" : ""}>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
    </div>
  )
}

export function UsuarioCRUD({ usuarios, role }: { usuarios: Usuario[]; role: "ALUNO" | "PROFESSOR" | "COORDENADOR" }) {
  const [editingId, setEditingId]      = useState<string | null>(null)
  const [senhaVisivel, setSenhaVisivel] = useState<Record<string, string>>({})
  const [isPending, startTransition]   = useTransition()
  const [editData, setEditData]        = useState<Record<string, any>>({})

  function set(field: string) {
    return (v: string) => setEditData(p => ({ ...p, [field]: v }))
  }

  function startEdit(u: Usuario) {
    setEditingId(u.id)
    setEditData({
      name: u.name, email: u.email, phone: u.phone ?? "",
      precoPresencial: u.precoPresencial ?? "", precoVirtual: u.precoVirtual ?? "",
      responsavelNome: u.responsavelNome ?? "", cpfResponsavel: u.cpfResponsavel ?? "",
      responsavelTelefone: u.responsavelTelefone ?? "",
      rua: u.rua ?? "", bairro: u.bairro ?? "", cidade: u.cidade ?? "",
      cep: u.cep ?? "", referenciaEndereco: u.referenciaEndereco ?? "",
      escola: u.escola ?? "", serie: u.serie ?? "", observacoes: u.observacoes ?? "",
    })
  }

  async function handleUpdate(id: string) {
    const fd = new FormData()
    Object.entries(editData).forEach(([k, v]) => fd.set(k, v))
    startTransition(async () => {
      await atualizarUsuario(id, fd)
      setEditingId(null)
    })
  }

  async function handleRegerarSenha(id: string) {
    const res = await regerarSenha(id)
    if (res.success) setSenhaVisivel(prev => ({ ...prev, [id]: res.data!.senhaGerada }))
  }

  async function handleToggleAtivo(id: string, ativo: boolean) {
    startTransition(async () => {
      if (ativo) await desativarUsuario(id)
      else await reativarUsuario(id)
    })
  }

  if (usuarios.length === 0)
    return <p className="text-neutral-500 text-center py-10">Nenhum registro cadastrado.</p>

  return (
    <div className="space-y-3">
      {usuarios.map(u => {
        const ativo    = !u.deletedAt
        const senha    = senhaVisivel[u.id] ?? u.tempPassword
        const isEditing = editingId === u.id

        return (
          <div key={u.id} className={`bg-white border rounded-2xl p-4 ${!ativo ? "opacity-60" : ""}`}>
            {!isEditing ? (
              /* ─── Modo visualização ─── */
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-neutral-900">{u.name}</p>
                  <p className="text-sm text-neutral-500">{u.email}</p>
                  {u.phone && <p className="text-xs text-neutral-400">{u.phone}</p>}

                  {role === "PROFESSOR" && (u.precoPresencial || u.precoVirtual) && (
                    <div className="flex gap-3 mt-1 text-xs text-neutral-500">
                      {u.precoPresencial && <span>🏫 R$ {Number(u.precoPresencial).toFixed(2)}/h</span>}
                      {u.precoVirtual    && <span>💻 R$ {Number(u.precoVirtual).toFixed(2)}/h</span>}
                    </div>
                  )}

                  {role === "ALUNO" && (
                    <div className="mt-1.5 space-y-0.5 text-xs text-neutral-400">
                      {u.responsavelNome && <p>Resp.: {u.responsavelNome}{u.cpfResponsavel ? ` · CPF: ${u.cpfResponsavel}` : ""}</p>}
                      {u.escola && <p>Escola: {u.escola}{u.serie ? ` · ${u.serie}` : ""}</p>}
                      {(u.rua || u.cidade) && (
                        <p>{[u.rua, u.bairro, u.cidade, u.cep].filter(Boolean).join(", ")}</p>
                      )}
                    </div>
                  )}

                  {senha && (
                    <div className="flex items-center gap-2 mt-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 w-fit">
                      <span className="text-xs text-amber-700">Senha:</span>
                      <code className="text-xs font-mono font-bold text-amber-900">{senha}</code>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => startEdit(u)}
                    className="text-xs text-primary-600 border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors font-medium">
                    Editar
                  </button>
                  <button onClick={() => handleRegerarSenha(u.id)}
                    className="text-xs text-neutral-600 border border-neutral-200 px-3 py-1.5 rounded-lg hover:bg-neutral-50 transition-colors font-medium">
                    Nova senha
                  </button>
                  <button onClick={() => handleToggleAtivo(u.id, ativo)} disabled={isPending}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border ${
                      ativo ? "text-red-600 border-red-200 hover:bg-red-50" : "text-green-600 border-green-200 hover:bg-green-50"
                    }`}>
                    {ativo ? "Desativar" : "Reativar"}
                  </button>
                </div>
              </div>
            ) : (
              /* ─── Modo edição ─── */
              <div className="space-y-5">
                <p className="text-sm font-semibold text-neutral-700">Editando: {u.email}</p>

                {/* Dados básicos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <InputField label="Nome"    value={editData.name}  onChange={set("name")} />
                  <InputField label="E-mail"  value={editData.email} onChange={set("email")} type="email" />
                  <InputField label="Telefone" value={editData.phone} onChange={set("phone")} placeholder="(19) 99999-9999" />
                  {role === "PROFESSOR" && (
                    <>
                      <InputField label="🏫 R$/hora presencial" value={editData.precoPresencial} onChange={set("precoPresencial")} type="number" placeholder="0,00" />
                      <InputField label="💻 R$/hora virtual"    value={editData.precoVirtual}    onChange={set("precoVirtual")}    type="number" placeholder="0,00" />
                    </>
                  )}
                </div>

                {/* Campos exclusivos do aluno */}
                {role === "ALUNO" && (
                  <>
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Responsável</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <InputField label="Nome do responsável"     value={editData.responsavelNome}    onChange={set("responsavelNome")} />
                        <InputField label="CPF do responsável"      value={editData.cpfResponsavel}     onChange={set("cpfResponsavel")} placeholder="000.000.000-00" />
                        <InputField label="Telefone do responsável" value={editData.responsavelTelefone} onChange={set("responsavelTelefone")} placeholder="(19) 99999-9999" />
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Endereço</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <InputField label="Rua / Logradouro" value={editData.rua}    onChange={set("rua")}    span2 placeholder="Ex: Rua das Flores, 123" />
                        <InputField label="Bairro"           value={editData.bairro} onChange={set("bairro")} placeholder="Ex: Centro" />
                        <InputField label="Cidade"           value={editData.cidade} onChange={set("cidade")} placeholder="Ex: Vinhedo" />
                        <InputField label="CEP"              value={editData.cep}    onChange={set("cep")}    placeholder="00000-000" />
                        <InputField label="Referência"       value={editData.referenciaEndereco} onChange={set("referenciaEndereco")} span2 placeholder="Ex: Próximo ao colégio X" />
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Dados Educacionais</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <InputField label="Escola atual" value={editData.escola} onChange={set("escola")} placeholder="Ex: Colégio Estadual…" />
                        <InputField label="Série / Ano"  value={editData.serie}  onChange={set("serie")}  placeholder="Ex: 8º ano, 2º EM" />
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-neutral-600 mb-1">Observações</label>
                          <textarea rows={3} value={editData.observacoes}
                            onChange={e => setEditData(p => ({ ...p, observacoes: e.target.value }))}
                            className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                            placeholder="Dificuldades, necessidades especiais, informações relevantes…" />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <button onClick={() => handleUpdate(u.id)} disabled={isPending}
                    className="bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-60">
                    {isPending ? "Salvando..." : "Salvar"}
                  </button>
                  <button onClick={() => setEditingId(null)}
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
