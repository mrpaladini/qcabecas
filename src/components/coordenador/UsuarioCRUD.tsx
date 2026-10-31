"use client"

import { useState, useTransition } from "react"
import { atualizarUsuario, desativarUsuario, reativarUsuario, regerarSenha, excluirUsuario } from "@/app/coordenador/usuarios/actions"
import { lancarAjusteProfessor, estornarAjusteProfessor } from "@/app/coordenador/professores/actions"
import { CurrencyInput } from "@/components/ui/CurrencyInput"
import { ProfessorCampos, appendProfessorExtras, type ProfessorExtras } from "./ProfessorCampos"
import { resumoDisponibilidade, serieLabel, pixTipoLabel, type Disponibilidade, type SerieKey } from "@/lib/professor"
import { PixCurriculoCampos, PIX_CURRICULO_VAZIO, appendPixCurriculo, erroPixCurriculo, LinksCurriculo,
  type PixCurriculoValor, type CurriculoAtual } from "./PixCurriculoCampos"

export type AjusteItem = {
  id: string
  tipo: "CREDITO" | "DEBITO"
  valor: number
  descricao: string
  createdAt: string
  pagamentoId: string | null
}

export type Usuario = {
  id: string
  name: string
  email: string
  phone: string | null
  tempPassword: string | null
  deletedAt: Date | null
  createdAt?: string | null
  role: string
  precoPresencial?: string | null
  precoVirtual?: string | null
  observacoes?: string | null
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
  // professor
  phone2?: string | null
  escolaAtuacao?: string | null
  seriesAtendidas?: SerieKey[]
  atendePresencial?: boolean
  atendeOnline?: boolean
  disponibilidade?: Disponibilidade[]
  pixTipo?: string | null
  pixChave?: string | null
  curriculo?: CurriculoAtual | null
  ajustes?: AjusteItem[]
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" })
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

function ValorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      <CurrencyInput value={value} onChange={onChange} className="rounded-lg py-2" />
    </div>
  )
}

function ObservacoesField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="md:col-span-2">
      <label className="block text-xs font-medium text-neutral-600 mb-1">Observações</label>
      <textarea rows={3} value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        placeholder={placeholder} />
    </div>
  )
}

/* ─── Débito / Crédito do professor ─────────────────────────────────────── */
function AjustesProfessor({ professorId, ajustes, onClose }: { professorId: string; ajustes: AjusteItem[]; onClose: () => void }) {
  const [tipo, setTipo]           = useState<"CREDITO" | "DEBITO">("CREDITO")
  const [valor, setValor]         = useState("")
  const [descricao, setDescricao] = useState("")
  const [erro, setErro]           = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const pendentes = ajustes.filter(a => !a.pagamentoId)
  const saldoPendente = pendentes.reduce((acc, a) => acc + (a.tipo === "CREDITO" ? a.valor : -a.valor), 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!valor) { setErro("Informe o valor"); return }
    const fd = new FormData()
    fd.set("professorId", professorId)
    fd.set("tipo", tipo)
    fd.set("valor", valor)
    fd.set("descricao", descricao || (tipo === "CREDITO" ? "Crédito manual" : "Débito manual"))
    startTransition(async () => {
      const res = await lancarAjusteProfessor(fd)
      if (res.success) { setValor(""); setDescricao("") }
      else setErro(res.error ?? "Erro ao lançar")
    })
  }

  function handleEstorno(id: string) {
    if (!confirm("Estornar este lançamento?")) return
    startTransition(async () => {
      const res = await estornarAjusteProfessor(id)
      if (!res.success) setErro(res.error ?? "Erro ao estornar")
    })
  }

  const cor = tipo === "CREDITO" ? "green" : "red"

  return (
    <div className="mt-3 border border-neutral-200 rounded-xl p-4 space-y-4 bg-neutral-50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-800">Débito / Crédito do professor</p>
        <p className="text-xs text-neutral-500">
          Ajustes pendentes (entram no próximo pagamento):{" "}
          <span className={`font-bold ${saldoPendente > 0 ? "text-green-700" : saldoPendente < 0 ? "text-red-700" : "text-neutral-600"}`}>
            {saldoPendente >= 0 ? "+" : "−"}{fmt(Math.abs(saldoPendente))}
          </span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex rounded-lg overflow-hidden border border-neutral-200 w-fit text-xs font-semibold">
          <button type="button" onClick={() => setTipo("CREDITO")}
            className={`px-4 py-1.5 ${tipo === "CREDITO" ? "bg-green-600 text-white" : "bg-white text-neutral-600"}`}>
            + Crédito
          </button>
          <button type="button" onClick={() => setTipo("DEBITO")}
            className={`px-4 py-1.5 ${tipo === "DEBITO" ? "bg-red-600 text-white" : "bg-white text-neutral-600"}`}>
            − Débito
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          {tipo === "CREDITO"
            ? "Crédito: valor a favor do professor (ex.: bônus, aula extra). Soma no próximo pagamento."
            : "Débito: desconto do professor (ex.: adiantamento, correção). Subtrai do próximo pagamento."}
        </p>
        {erro && <p className="text-xs text-red-600">{erro}</p>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Valor *</label>
            <CurrencyInput value={valor} onChange={setValor} className="rounded-lg py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-neutral-600 mb-1">Descrição</label>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={255}
              placeholder={tipo === "CREDITO" ? "Ex: Bônus de outubro" : "Ex: Adiantamento em 10/10"}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={isPending}
            className={`text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60 ${cor === "green" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>
            {isPending ? "Salvando..." : tipo === "CREDITO" ? "Lançar crédito" : "Lançar débito"}
          </button>
          <button type="button" onClick={onClose}
            className="text-sm text-neutral-600 border border-neutral-200 bg-white px-4 py-2 rounded-lg hover:bg-neutral-50">
            Fechar
          </button>
        </div>
      </form>

      {ajustes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="text-left py-1.5 px-2 font-semibold">Data</th>
                <th className="text-left py-1.5 px-2 font-semibold">Tipo</th>
                <th className="text-left py-1.5 px-2 font-semibold">Descrição</th>
                <th className="text-right py-1.5 px-2 font-semibold">Valor</th>
                <th className="text-left py-1.5 px-2 font-semibold">Situação</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {ajustes.map(a => (
                <tr key={a.id} className="border-b border-neutral-100">
                  <td className="py-1.5 px-2 whitespace-nowrap">{fmtData(a.createdAt)}</td>
                  <td className="py-1.5 px-2">
                    <span className={`px-1.5 py-0.5 rounded-full font-semibold ${a.tipo === "CREDITO" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {a.tipo === "CREDITO" ? "Crédito" : "Débito"}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-neutral-600">{a.descricao}</td>
                  <td className={`py-1.5 px-2 text-right font-semibold whitespace-nowrap ${a.tipo === "CREDITO" ? "text-green-700" : "text-red-700"}`}>
                    {a.tipo === "CREDITO" ? "+" : "−"}{fmt(a.valor)}
                  </td>
                  <td className="py-1.5 px-2 text-neutral-500">{a.pagamentoId ? "Pago" : "Pendente"}</td>
                  <td className="py-1.5 px-1">
                    {!a.pagamentoId && (
                      <button onClick={() => handleEstorno(a.id)} disabled={isPending} title="Estornar"
                        className="text-neutral-400 hover:text-red-500 font-medium px-1">✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ─── Lista ──────────────────────────────────────────────────────────────── */
export function UsuarioCRUD({ usuarios, role }: { usuarios: Usuario[]; role: "ALUNO" | "PROFESSOR" | "COORDENADOR" }) {
  const [editingId, setEditingId]      = useState<string | null>(null)
  const [ajustesId, setAjustesId]      = useState<string | null>(null)
  const [senhaVisivel, setSenhaVisivel] = useState<Record<string, string>>({})
  const [erros, setErros]              = useState<Record<string, string>>({})
  const [isPending, startTransition]   = useTransition()
  const [editData, setEditData]        = useState<Record<string, any>>({})
  const [extras, setExtras]            = useState<ProfessorExtras | null>(null)
  const [pixCv, setPixCv]              = useState<PixCurriculoValor>(PIX_CURRICULO_VAZIO)

  function set(field: string) {
    return (v: string) => setEditData(p => ({ ...p, [field]: v }))
  }

  function setErro(id: string, msg: string | null) {
    setErros(p => { const n = { ...p }; if (msg) n[id] = msg; else delete n[id]; return n })
  }

  function startEdit(u: Usuario) {
    setEditingId(u.id)
    setAjustesId(null)
    setErro(u.id, null)
    setEditData({
      name: u.name, email: u.email, phone: u.phone ?? "",
      precoPresencial: u.precoPresencial ?? "", precoVirtual: u.precoVirtual ?? "",
      observacoes: u.observacoes ?? "",
      responsavelNome: u.responsavelNome ?? "", cpfResponsavel: u.cpfResponsavel ?? "",
      responsavelTelefone: u.responsavelTelefone ?? "",
      rua: u.rua ?? "", bairro: u.bairro ?? "", cidade: u.cidade ?? "",
      cep: u.cep ?? "", referenciaEndereco: u.referenciaEndereco ?? "",
      escola: u.escola ?? "", serie: u.serie ?? "",
      phone2: u.phone2 ?? "", escolaAtuacao: u.escolaAtuacao ?? "",
    })
    setExtras({
      seriesAtendidas:  u.seriesAtendidas ?? [],
      atendePresencial: u.atendePresencial ?? false,
      atendeOnline:     u.atendeOnline ?? false,
      disponibilidade:  u.disponibilidade ?? [],
    })
    setPixCv({ pixTipo: u.pixTipo ?? "", pixChave: u.pixChave ?? "", curriculo: null, removerCurriculo: false })
  }

  async function handleUpdate(id: string) {
    const fd = new FormData()
    Object.entries(editData).forEach(([k, v]) => fd.set(k, v))
    if (role === "PROFESSOR") {
      const e = erroPixCurriculo(pixCv)
      if (e) { setErro(id, e); return }
      if (extras) appendProfessorExtras(fd, extras)
      appendPixCurriculo(fd, pixCv)
    }
    startTransition(async () => {
      const res = await atualizarUsuario(id, fd)
      if (res.success) { setEditingId(null); setErro(id, null) }
      else setErro(id, res.error ?? "Erro ao salvar")
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

  function handleExcluir(u: Usuario) {
    if (!confirm(`Excluir definitivamente ${u.name}?\n\nSó é possível excluir quem não tem aulas nem lançamentos financeiros. Essa ação não pode ser desfeita.`)) return
    setErro(u.id, null)
    startTransition(async () => {
      const res = await excluirUsuario(u.id)
      if (!res.success) setErro(u.id, res.error ?? "Erro ao excluir")
    })
  }

  if (usuarios.length === 0)
    return <p className="text-neutral-500 text-center py-10">Nenhum registro encontrado.</p>

  return (
    <div className="space-y-3">
      {usuarios.map(u => {
        const ativo    = !u.deletedAt
        const senha    = senhaVisivel[u.id] ?? u.tempPassword
        const isEditing = editingId === u.id
        const disp     = u.disponibilidade ?? []
        const pendAjuste = (u.ajustes ?? []).filter(a => !a.pagamentoId)
          .reduce((acc, a) => acc + (a.tipo === "CREDITO" ? a.valor : -a.valor), 0)

        return (
          <div key={u.id} className={`bg-white border rounded-2xl p-4 ${!ativo ? "opacity-60" : ""}`}>
            {erros[u.id] && !isEditing && (
              <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{erros[u.id]}</div>
            )}

            {!isEditing ? (
              /* ─── Modo visualização ─── */
              <>
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-neutral-900">{u.name}</p>
                  <p className="text-sm text-neutral-500">{u.email}</p>
                  {(u.phone || u.phone2) && (
                    <p className="text-xs text-neutral-400">{[u.phone, u.phone2].filter(Boolean).join(" · ")}</p>
                  )}

                  {role === "PROFESSOR" && (
                    <div className="mt-1.5 space-y-1 text-xs text-neutral-500">
                      {(u.precoPresencial || u.precoVirtual) && (
                        <div className="flex flex-wrap gap-3">
                          {u.precoPresencial && <span>🏫 {fmt(Number(u.precoPresencial))}/h</span>}
                          {u.precoVirtual    && <span>💻 {fmt(Number(u.precoVirtual))}/h</span>}
                        </div>
                      )}
                      {u.escolaAtuacao && <p>Leciona em: {u.escolaAtuacao}</p>}
                      <p>
                        <span className="text-neutral-400">PIX: </span>
                        {u.pixChave
                          ? <span className="text-neutral-700 font-medium">{pixTipoLabel(u.pixTipo)} · <span className="font-mono select-all">{u.pixChave}</span></span>
                          : <span className="italic text-amber-600">não cadastrado</span>}
                      </p>
                      <p>
                        <span className="text-neutral-400">Currículo: </span>
                        {u.curriculo
                          ? <LinksCurriculo professorId={u.id} atual={u.curriculo} className="text-neutral-700" />
                          : <span className="italic text-neutral-400">não enviado</span>}
                      </p>
                      {((u.seriesAtendidas?.length ?? 0) > 0 || u.atendePresencial || u.atendeOnline) && (
                        <div className="flex flex-wrap gap-1.5">
                          {u.atendePresencial && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">🏫 Presencial</span>}
                          {u.atendeOnline && <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">💻 Online</span>}
                          {u.seriesAtendidas?.map(s => (
                            <span key={s} className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">{serieLabel(s)}</span>
                          ))}
                        </div>
                      )}
                      <p>
                        <span className="text-neutral-400">Disponibilidade: </span>
                        {disp.length > 0 ? resumoDisponibilidade(disp) : <span className="italic text-neutral-400">não cadastrada</span>}
                      </p>
                      {u.observacoes && <p className="italic text-neutral-400">{u.observacoes}</p>}
                      {pendAjuste !== 0 && (
                        <p>
                          Ajustes pendentes:{" "}
                          <span className={`font-semibold ${pendAjuste > 0 ? "text-green-700" : "text-red-700"}`}>
                            {pendAjuste > 0 ? "+" : "−"}{fmt(Math.abs(pendAjuste))}
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  {role === "ALUNO" && (
                    <div className="mt-1.5 space-y-0.5 text-xs text-neutral-400">
                      {(u.precoPresencial || u.precoVirtual) ? (
                        <p className="text-neutral-600">
                          Valor por aula:{" "}
                          {u.precoPresencial && <span className="mr-2">🏫 {fmt(Number(u.precoPresencial))}</span>}
                          {u.precoVirtual && <span>💻 {fmt(Number(u.precoVirtual))}</span>}
                        </p>
                      ) : (
                        <p className="text-amber-600">⚠ Sem valor por aula cadastrado</p>
                      )}
                      {u.responsavelNome && <p>Resp.: {u.responsavelNome}{u.cpfResponsavel ? ` · CPF: ${u.cpfResponsavel}` : ""}{u.responsavelTelefone ? ` · ${u.responsavelTelefone}` : ""}</p>}
                      {u.escola && <p>Escola: {u.escola}{u.serie ? ` · ${u.serie}` : ""}</p>}
                      {(u.rua || u.cidade) && (
                        <p>{[u.rua, u.bairro, u.cidade, u.cep].filter(Boolean).join(", ")}</p>
                      )}
                    </div>
                  )}

                  {u.createdAt && (
                    <p className="text-[11px] text-neutral-400 mt-1">Cadastrado em {fmtData(u.createdAt)}</p>
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
                  {role === "PROFESSOR" && (
                    <button onClick={() => setAjustesId(ajustesId === u.id ? null : u.id)}
                      className="text-xs text-neutral-700 border border-neutral-200 px-3 py-1.5 rounded-lg hover:bg-neutral-50 transition-colors font-medium">
                      Débito/Crédito
                    </button>
                  )}
                  <button onClick={() => handleRegerarSenha(u.id)}
                    className="text-xs text-neutral-600 border border-neutral-200 px-3 py-1.5 rounded-lg hover:bg-neutral-50 transition-colors font-medium">
                    Nova senha
                  </button>
                  <button onClick={() => handleToggleAtivo(u.id, ativo)} disabled={isPending}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border ${
                      ativo ? "text-amber-700 border-amber-200 hover:bg-amber-50" : "text-green-600 border-green-200 hover:bg-green-50"
                    }`}>
                    {ativo ? "Desativar" : "Reativar"}
                  </button>
                  {role === "PROFESSOR" && (
                    <button onClick={() => handleExcluir(u)} disabled={isPending}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border text-red-600 border-red-200 hover:bg-red-50">
                      Excluir
                    </button>
                  )}
                </div>
              </div>

              {role === "PROFESSOR" && ajustesId === u.id && (
                <AjustesProfessor professorId={u.id} ajustes={u.ajustes ?? []} onClose={() => setAjustesId(null)} />
              )}
              </>
            ) : (
              /* ─── Modo edição ─── */
              <div className="space-y-5">
                <p className="text-sm font-semibold text-neutral-700">Editando: {u.email}</p>

                {erros[u.id] && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{erros[u.id]}</div>
                )}

                {/* Dados básicos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <InputField label="Nome"    value={editData.name}  onChange={set("name")} />
                  <InputField label="E-mail"  value={editData.email} onChange={set("email")} type="email" />
                  <InputField label="Telefone" value={editData.phone} onChange={set("phone")} placeholder="(19) 99999-9999" />
                  {role === "PROFESSOR" && (
                    <InputField label="Telefone 2" value={editData.phone2} onChange={set("phone2")} placeholder="(19) 99999-9999" />
                  )}
                  {role === "PROFESSOR" && (
                    <>
                      <ValorField label="🏫 Valor/hora presencial" value={editData.precoPresencial} onChange={set("precoPresencial")} />
                      <ValorField label="💻 Valor/hora online"    value={editData.precoVirtual}    onChange={set("precoVirtual")} />
                      <InputField label="Escola em que atua como professor" value={editData.escolaAtuacao} onChange={set("escolaAtuacao")} span2 placeholder="Ex: Colégio Objetivo Vinhedo" />
                    </>
                  )}
                  {role === "ALUNO" && (
                    <>
                      <ValorField label="🏫 Valor por aula presencial" value={editData.precoPresencial} onChange={set("precoPresencial")} />
                      <ValorField label="💻 Valor por aula online"     value={editData.precoVirtual}    onChange={set("precoVirtual")} />
                    </>
                  )}
                </div>

                {role === "PROFESSOR" && (
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Pagamento (PIX) e currículo</p>
                    <PixCurriculoCampos value={pixCv} onChange={setPixCv} professorId={u.id} atual={u.curriculo ?? null} compact />
                  </div>
                )}

                {role === "PROFESSOR" && extras && (
                  <>
                    <ProfessorCampos value={extras} onChange={setExtras} compact />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <ObservacoesField value={editData.observacoes} onChange={set("observacoes")}
                        placeholder="Formação, especialidades, preferências, informações relevantes…" />
                    </div>
                  </>
                )}

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
                        <ObservacoesField value={editData.observacoes} onChange={set("observacoes")}
                          placeholder="Dificuldades, necessidades especiais, informações relevantes…" />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <button onClick={() => handleUpdate(u.id)} disabled={isPending}
                    className="bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-60">
                    {isPending ? "Salvando..." : "Salvar"}
                  </button>
                  <button onClick={() => { setEditingId(null); setErro(u.id, null) }}
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
