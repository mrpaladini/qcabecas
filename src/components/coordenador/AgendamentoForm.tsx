"use client"

import { useMemo, useState, useTransition } from "react"
import { criarAgendamento } from "@/app/coordenador/agendamentos/actions"
import { CurrencyInput } from "@/components/ui/CurrencyInput"
import { BuscaSelect, type BuscaOpcao } from "@/components/ui/BuscaSelect"
import { resumoDisponibilidade, verificarDisponibilidade, type Disponibilidade } from "@/lib/professor"

type Aluno = {
  id: string
  name: string
  email?: string | null
  responsavelNome?: string | null
  precoPresencial: string | null
  precoVirtual: string | null
}
type Professor = {
  id: string
  name: string
  disponibilidade: Disponibilidade[]
  atendePresencial: boolean
  atendeOnline: boolean
}
type Disciplina = { id: number; name: string; professores: Professor[] }
type Sala = { id: number; name: string; type: string }
type Coordenador = { id: string; name: string }

const INPUT_CLS = "w-full border border-neutral-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
const INPUT_ERR = "w-full border border-red-400 ring-2 ring-red-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-red-400"

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function fmtDuracao(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`
}

/**
 * Valor da aula a partir do cadastro do aluno: o preço cadastrado é por HORA,
 * conforme a sala (online x presencial), multiplicado pela duração da aula.
 * Ex.: R$ 80/h × 1h30 = R$ 120,00.
 */
function valorSugerido(aluno: Aluno | undefined, sala: Sala | undefined, duracaoMin: number) {
  const vazio = { valor: "", precoHora: 0, origem: null as string | null }
  if (!aluno) return vazio
  const online = sala?.type === "VIRTUAL"
  const principal = online ? aluno.precoVirtual : aluno.precoPresencial
  const precoHora = Number(principal ?? 0)
  if (precoHora > 0) {
    const total = Math.round(precoHora * (duracaoMin / 60) * 100) / 100
    return { valor: total.toFixed(2), precoHora, origem: online ? "online" : "presencial" }
  }
  return vazio
}

export function AgendamentoForm({ alunos, todasDisciplinas, salas, coordenadores = [], coordenadorPadrao = "" }: {
  alunos: Aluno[]
  todasDisciplinas: Disciplina[]
  salas: Sala[]
  coordenadores?: Coordenador[]
  /** Coordenador logado — pré-selecionado como responsável pela aula */
  coordenadorPadrao?: string
}) {
  const [alunoId, setAlunoId]           = useState("")
  const [disciplinaId, setDisciplinaId] = useState<number | null>(null)
  const [professorId, setProfessorId]   = useState("")
  const [roomId, setRoomId]             = useState("")
  const [dataHora, setDataHora]         = useState("")
  const [duracao, setDuracao]           = useState("60")
  const [status, setStatus]             = useState<"PENDENTE" | "AGENDADO">("PENDENTE")
  const [valorCobrado, setValorCobrado] = useState("")
  const [valorAuto, setValorAuto]       = useState("")
  const [coordenadorId, setCoordenadorId] = useState(coordenadorPadrao)
  const [sucesso, setSucesso]           = useState<string | null>(null)
  const [erroGeral, setErroGeral]       = useState<string | null>(null)
  const [camposErro, setCamposErro]     = useState<Record<string, string>>({})
  const [isPending, startTransition]    = useTransition()

  const aluno = alunos.find(a => a.id === alunoId)
  const sala  = salas.find(s => String(s.id) === roomId)
  const sugestao = valorSugerido(aluno, sala, Number(duracao))

  const professoresDaDisciplina = disciplinaId
    ? (todasDisciplinas.find(d => d.id === disciplinaId)?.professores ?? [])
    : []

  /** Atualiza o valor com o do cadastro. `forcar` = troca de aluno (sempre sobrescreve);
   *  troca de sala/duração só sobrescreve se o valor ainda for o sugerido (não foi editado à mão). */
  function aplicarValor(novoAluno: Aluno | undefined, novaSala: Sala | undefined, forcar: boolean, novaDuracao = Number(duracao)) {
    const s = valorSugerido(novoAluno, novaSala, novaDuracao)
    if (forcar || valorCobrado === "" || valorCobrado === valorAuto) setValorCobrado(s.valor)
    setValorAuto(s.valor)
  }

  const alunoOpcoes: BuscaOpcao[] = useMemo(() => alunos.map(a => ({
    id: a.id,
    label: a.name,
    sublabel: [a.responsavelNome ? `Resp.: ${a.responsavelNome}` : null, a.email].filter(Boolean).join(" · ") || undefined,
    badge: !a.precoPresencial && !a.precoVirtual ? { text: "sem valor", tone: "amber" as const } : undefined,
  })), [alunos])

  const duracaoMin = Number(duracao)
  const salaOnline = sala?.type === "VIRTUAL"

  function situacao(p: Professor) {
    const modalidadeDefinida = p.atendeOnline || p.atendePresencial
    if (sala && modalidadeDefinida && (salaOnline ? !p.atendeOnline : !p.atendePresencial))
      return { text: salaOnline ? "Não atende online" : "Não atende presencial", tone: "amber" as const, ordem: 2 }
    if (!dataHora) return null
    const r = verificarDisponibilidade(p.disponibilidade, dataHora, duracaoMin)
    if (r === "DISPONIVEL")   return { text: "✓ Disponível", tone: "green" as const, ordem: 0 }
    if (r === "INDISPONIVEL") return { text: "Fora do horário", tone: "red" as const, ordem: 3 }
    return { text: "Sem disponibilidade cadastrada", tone: "neutral" as const, ordem: 1 }
  }

  const professorOpcoes: BuscaOpcao[] = useMemo(() => {
    return professoresDaDisciplina
      .map(p => ({ p, s: situacao(p) }))
      .sort((a, b) => (a.s?.ordem ?? 1) - (b.s?.ordem ?? 1) || a.p.name.localeCompare(b.p.name))
      .map(({ p, s }) => ({
        id: p.id,
        label: p.name,
        sublabel: p.disponibilidade.length ? resumoDisponibilidade(p.disponibilidade) : undefined,
        badge: s ? { text: s.text, tone: s.tone } : undefined,
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professoresDaDisciplina, dataHora, duracaoMin, roomId])

  const professorEscolhido = professoresDaDisciplina.find(p => p.id === professorId)
  const situacaoEscolhido = professorEscolhido ? situacao(professorEscolhido) : null
  const disponiveisAgora = dataHora
    ? professoresDaDisciplina.filter(p => verificarDisponibilidade(p.disponibilidade, dataHora, duracaoMin) === "DISPONIVEL").length
    : null

  function resetar() {
    setAlunoId(""); setDisciplinaId(null); setProfessorId(""); setRoomId("")
    setDataHora(""); setDuracao("60"); setStatus("PENDENTE")
    setValorCobrado(""); setValorAuto(""); setCoordenadorId(coordenadorPadrao)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErroGeral(null)
    setCamposErro({})
    setSucesso(null)

    const erros: Record<string, string> = {}
    if (!alunoId) erros.alunoId = "Aluno: selecione um aluno da lista"
    if (!professorId) erros.professorId = "Professor: selecione um professor da lista"
    if (!valorCobrado || Number(valorCobrado) <= 0) erros.valorCobrado = "Valor cobrado: informe o valor da aula"
    if (Object.keys(erros).length) {
      setCamposErro(erros)
      setErroGeral(Object.values(erros)[0])
      return
    }

    const formData = new FormData(e.currentTarget)
    formData.set("valorCobrado", valorCobrado)
    formData.set("status", status)
    if (coordenadorId) formData.set("coordenadorId", coordenadorId)

    startTransition(async () => {
      const res = await criarAgendamento(formData)
      if (res.success) {
        setSucesso(status === "PENDENTE"
          ? "⏳ Aula registrada como Pendente. Confirme na lista abaixo quando aluno e professor confirmarem."
          : "✅ Aula agendada com sucesso! Notificações enviadas por e-mail.")
        resetar()
        ;(e.target as HTMLFormElement).reset()
      } else {
        if ("fieldErrors" in res && res.fieldErrors) setCamposErro(res.fieldErrors as Record<string, string>)
        setErroGeral(res.error ?? "Erro ao agendar")
      }
    })
  }

  function fieldCls(field: string) { return camposErro[field] ? INPUT_ERR : INPUT_CLS }
  function FieldError({ field }: { field: string }) {
    if (!camposErro[field]) return null
    return <p className="text-xs text-red-600 mt-1">{camposErro[field]}</p>
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-neutral-900 mb-5">Nova Aula</h2>

      {sucesso && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800 font-medium">{sucesso}</div>
      )}

      {erroGeral && !Object.keys(camposErro).length && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{erroGeral}</div>
      )}

      {Object.keys(camposErro).length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
          <p className="text-sm font-semibold text-red-700">Corrija os campos abaixo:</p>
          {Object.values(camposErro).map((msg, i) => (
            <p key={i} className="text-xs text-red-600">• {msg}</p>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div>
          <label htmlFor="alunoBusca" className="block text-sm font-medium text-neutral-700 mb-1.5">Aluno <span className="text-red-500">*</span></label>
          <BuscaSelect id="alunoBusca" name="alunoId" opcoes={alunoOpcoes} value={alunoId}
            onChange={id => { setAlunoId(id); aplicarValor(alunos.find(a => a.id === id), sala, true) }}
            placeholder="Digite o nome do aluno…" hasError={!!camposErro.alunoId}
            vazioTexto="Nenhum aluno encontrado" />
          <FieldError field="alunoId" />
        </div>

        <div>
          <label htmlFor="subjectId" className="block text-sm font-medium text-neutral-700 mb-1.5">Disciplina <span className="text-red-500">*</span></label>
          <select id="subjectId" name="subjectId" required value={disciplinaId ?? ""}
            onChange={e => {
              const novo = e.target.value ? Number(e.target.value) : null
              setDisciplinaId(novo)
              const profs = novo ? (todasDisciplinas.find(d => d.id === novo)?.professores ?? []) : []
              if (!profs.some(p => p.id === professorId)) setProfessorId("")
            }}
            className={fieldCls("subjectId")}>
            <option value="">Selecione a disciplina</option>
            {todasDisciplinas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <FieldError field="subjectId" />
        </div>

        <div>
          <label htmlFor="dataHora" className="block text-sm font-medium text-neutral-700 mb-1.5">Data e Hora <span className="text-red-500">*</span></label>
          <input id="dataHora" name="dataHora" type="datetime-local" required value={dataHora}
            onChange={e => setDataHora(e.target.value)} className={fieldCls("dataHora")} />
          <FieldError field="dataHora" />
        </div>

        <div>
          <label htmlFor="duracaoMinutos" className="block text-sm font-medium text-neutral-700 mb-1.5">Duração</label>
          <select id="duracaoMinutos" name="duracaoMinutos" value={duracao}
            onChange={e => { setDuracao(e.target.value); aplicarValor(aluno, sala, false, Number(e.target.value)) }}
            className={fieldCls("duracaoMinutos")}>
            <option value="60">1 hora</option>
            <option value="90">1h30min</option>
            <option value="120">2 horas</option>
            <option value="150">2h30min</option>
            <option value="180">3 horas</option>
          </select>
          <FieldError field="duracaoMinutos" />
        </div>

        <div>
          <label htmlFor="roomId" className="block text-sm font-medium text-neutral-700 mb-1.5">Sala de Aula</label>
          <select id="roomId" name="roomId" value={roomId}
            onChange={e => { setRoomId(e.target.value); aplicarValor(aluno, salas.find(s => String(s.id) === e.target.value), false) }}
            className={fieldCls("roomId")}>
            <option value="">Sem sala definida</option>
            {salas.map(s => <option key={s.id} value={s.id}>{s.type === "VIRTUAL" ? "💻" : "🏫"} {s.name}</option>)}
          </select>
          <FieldError field="roomId" />
        </div>

        <div>
          <label htmlFor="profBusca" className="block text-sm font-medium text-neutral-700 mb-1.5">Professor <span className="text-red-500">*</span></label>
          <BuscaSelect id="profBusca" name="professorId" opcoes={professorOpcoes} value={professorId}
            onChange={setProfessorId} disabled={!disciplinaId} hasError={!!camposErro.professorId}
            placeholder={!disciplinaId ? "Selecione a disciplina primeiro" : "Digite o nome do professor…"}
            vazioTexto="Nenhum professor encontrado" />
          {disciplinaId && professoresDaDisciplina.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">⚠ Nenhum professor associado a esta disciplina.</p>
          )}
          {disciplinaId && professoresDaDisciplina.length > 0 && disponiveisAgora !== null && !professorId && (
            <p className={`text-xs mt-1 ${disponiveisAgora > 0 ? "text-green-700" : "text-amber-600"}`}>
              {disponiveisAgora > 0
                ? `${disponiveisAgora} professor(es) disponível(is) neste horário — aparecem primeiro na lista.`
                : "⚠ Nenhum professor desta disciplina tem disponibilidade cadastrada para este horário."}
            </p>
          )}
          {situacaoEscolhido && (
            <p className={`text-xs mt-1 ${
              situacaoEscolhido.tone === "green" ? "text-green-700" : situacaoEscolhido.tone === "neutral" ? "text-neutral-500" : "text-amber-600"
            }`}>
              {situacaoEscolhido.tone === "green"
                ? "✓ Professor disponível neste horário."
                : situacaoEscolhido.tone === "neutral"
                  ? "Professor sem disponibilidade cadastrada — confirme com ele."
                  : `⚠ ${situacaoEscolhido.text}. Você ainda pode agendar, mas confirme com o professor.`}
            </p>
          )}
          <FieldError field="professorId" />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Valor total da aula (aluno) <span className="text-red-500">*</span></label>
          <CurrencyInput
            value={valorCobrado}
            onChange={setValorCobrado}
            placeholder="0,00"
            hasError={!!camposErro.valorCobrado}
          />
          {aluno && (
            sugestao.origem ? (
              <p className="text-xs text-neutral-500 mt-1">
                Cadastro do aluno ({sugestao.origem}): {fmt(sugestao.precoHora)}/h × {fmtDuracao(duracaoMin)} = <strong>{fmt(Number(sugestao.valor))}</strong>
                {valorCobrado && valorCobrado !== sugestao.valor && (
                  <button type="button" onClick={() => setValorCobrado(sugestao.valor)}
                    className="ml-2 text-primary-600 hover:underline font-medium">usar este</button>
                )}
              </p>
            ) : (
              <p className="text-xs text-amber-600 mt-1">
                ⚠ Aluno sem valor {salaOnline ? "online" : "presencial"} cadastrado — informe o valor.
              </p>
            )
          )}
          <FieldError field="valorCobrado" />
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-neutral-700 mb-1.5">Situação</label>
          <select id="status" value={status} onChange={e => setStatus(e.target.value as any)} className={INPUT_CLS}>
            <option value="PENDENTE">⏳ Pendente — aguardando confirmação</option>
            <option value="AGENDADO">✅ Agendado — aluno e professor confirmaram</option>
          </select>
        </div>

        <div>
          <label htmlFor="coordenadorId" className="block text-sm font-medium text-neutral-700 mb-1.5">Coordenador que acompanha</label>
          <select id="coordenadorId" value={coordenadorId} onChange={e => setCoordenadorId(e.target.value)}
            className={fieldCls("coordenadorId")}>
            {coordenadores.length === 0 && <option value="">—</option>}
            {coordenadores.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <p className="text-xs text-neutral-500 mt-1">Pode ser alterado depois, em Editar.</p>
          <FieldError field="coordenadorId" />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="observacoes" className="block text-sm font-medium text-neutral-700 mb-1.5">Observações</label>
          <textarea id="observacoes" name="observacoes" rows={2}
            placeholder="Instruções especiais para esta aula..."
            className="w-full border border-neutral-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
        </div>

        <div className="md:col-span-2">
          <button type="submit" disabled={isPending}
            className="w-full sm:w-auto bg-primary-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-primary-700 transition-colors text-sm disabled:opacity-60">
            {isPending ? "Salvando..." : status === "PENDENTE" ? "Registrar como Pendente + Notificar" : "Agendar Aula + Notificar por E-mail"}
          </button>
        </div>
      </form>
    </div>
  )
}
