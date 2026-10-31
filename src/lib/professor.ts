// Constantes e utilitários compartilhados (client + server) para os dados
// do professor: séries atendidas e disponibilidade semanal.

export const SERIES_OPCOES = [
  { key: "FUNDAMENTAL_I",  label: "Fundamental I" },
  { key: "FUNDAMENTAL_II", label: "Fundamental II" },
  { key: "ENSINO_MEDIO",   label: "Ensino Médio" },
  { key: "SUPERIOR",       label: "Superior" },
  { key: "CONCURSO",       label: "Concurso" },
] as const

export type SerieKey = (typeof SERIES_OPCOES)[number]["key"]

// Mesmo formato usado em salas (horarios_disponiveis): dia SEG..DOM, HH:MM
export const DIAS_SEMANA = [
  { key: "SEG", label: "Segunda", js: 1 },
  { key: "TER", label: "Terça",   js: 2 },
  { key: "QUA", label: "Quarta",  js: 3 },
  { key: "QUI", label: "Quinta",  js: 4 },
  { key: "SEX", label: "Sexta",   js: 5 },
  { key: "SAB", label: "Sábado",  js: 6 },
  { key: "DOM", label: "Domingo", js: 0 },
] as const

export type DiaKey = (typeof DIAS_SEMANA)[number]["key"]
export type Disponibilidade = { dia: DiaKey; inicio: string; fim: string }

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DIA_KEYS = DIAS_SEMANA.map(d => d.key) as readonly string[]
const SERIE_KEYS = SERIES_OPCOES.map(s => s.key) as readonly string[]

export function serieLabel(key: string) {
  return SERIES_OPCOES.find(s => s.key === key)?.label ?? key
}

export function diaLabel(key: string) {
  return DIAS_SEMANA.find(d => d.key === key)?.label ?? key
}

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

/** Lê o JSON salvo no banco (ou vindo do formulário) e devolve só itens válidos. */
export function parseSeries(raw: unknown): SerieKey[] {
  let v = raw
  if (typeof v === "string") { try { v = JSON.parse(v) } catch { return [] } }
  if (!Array.isArray(v)) return []
  return Array.from(new Set(v.filter((s): s is SerieKey => typeof s === "string" && SERIE_KEYS.includes(s))))
}

/** Lê o JSON de disponibilidade e devolve só faixas válidas (início < fim), ordenadas. */
export function parseDisponibilidade(raw: unknown): Disponibilidade[] {
  let v = raw
  if (typeof v === "string") { try { v = JSON.parse(v) } catch { return [] } }
  if (!Array.isArray(v)) return []
  const ordemDia = (d: string) => DIA_KEYS.indexOf(d)
  return v
    .filter((h: any) =>
      h && DIA_KEYS.includes(h.dia) && HORA_RE.test(h.inicio ?? "") && HORA_RE.test(h.fim ?? "") &&
      toMin(h.inicio) < toMin(h.fim))
    .map((h: any) => ({ dia: h.dia as DiaKey, inicio: h.inicio as string, fim: h.fim as string }))
    .sort((a, b) => ordemDia(a.dia) - ordemDia(b.dia) || toMin(a.inicio) - toMin(b.inicio))
}

/** Texto curto: "Segunda 14:00–18:00 · Terça 13:00–15:00, 18:00–20:00" */
export function resumoDisponibilidade(disp: Disponibilidade[]) {
  return DIAS_SEMANA
    .map(d => {
      const faixas = disp.filter(h => h.dia === d.key)
      if (faixas.length === 0) return null
      return `${d.label} ${faixas.map(f => `${f.inicio}–${f.fim}`).join(", ")}`
    })
    .filter(Boolean)
    .join(" · ")
}

export type ResultadoDisponibilidade = "DISPONIVEL" | "INDISPONIVEL" | "SEM_CADASTRO"

/**
 * Verifica se a aula cabe inteira numa faixa de disponibilidade do professor.
 * `dataHoraLocal` é o valor do <input type="datetime-local"> ("2026-10-20T14:00"),
 * lido como horário local de Brasília sem conversão de fuso.
 */
export function verificarDisponibilidade(
  disp: Disponibilidade[],
  dataHoraLocal: string,
  duracaoMinutos: number,
): ResultadoDisponibilidade {
  if (disp.length === 0) return "SEM_CADASTRO"
  const m = dataHoraLocal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return "SEM_CADASTRO"
  const [, y, mo, d, h, mi] = m.map(Number)
  const diaJs = new Date(Date.UTC(y, mo - 1, d)).getUTCDay()
  const dia = DIAS_SEMANA.find(x => x.js === diaJs)!.key
  const inicio = h * 60 + mi
  const fim = inicio + duracaoMinutos
  const cabe = disp.some(f => f.dia === dia && toMin(f.inicio) <= inicio && toMin(f.fim) >= fim)
  return cabe ? "DISPONIVEL" : "INDISPONIVEL"
}

/* ─── Pagamento por PIX ─────────────────────────────────────────────────── */

export const PIX_TIPOS = [
  { key: "CPF",       label: "CPF",            placeholder: "000.000.000-00" },
  { key: "CNPJ",      label: "CNPJ",           placeholder: "00.000.000/0000-00" },
  { key: "EMAIL",     label: "E-mail",         placeholder: "professor@email.com" },
  { key: "TELEFONE",  label: "Telefone",       placeholder: "(19) 99999-9999" },
  { key: "ALEATORIA", label: "Chave aleatória", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
] as const

export type PixTipo = (typeof PIX_TIPOS)[number]["key"]

export function pixTipoLabel(key: string | null | undefined) {
  return PIX_TIPOS.find(t => t.key === key)?.label ?? ""
}

/** Valida a chave conforme o tipo. Retorna a mensagem de erro, ou null se estiver ok. */
export function validarPix(tipo: string, chave: string): string | null {
  const c = chave.trim()
  const dig = c.replace(/\D/g, "")
  switch (tipo) {
    case "CPF":       return dig.length === 11 ? null : "Chave PIX: CPF deve ter 11 dígitos"
    case "CNPJ":      return dig.length === 14 ? null : "Chave PIX: CNPJ deve ter 14 dígitos"
    case "EMAIL":     return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? null : "Chave PIX: e-mail inválido"
    case "TELEFONE":  return dig.length >= 10 && dig.length <= 13 ? null : "Chave PIX: telefone deve ter DDD + número"
    case "ALEATORIA": return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(c) ? null : "Chave PIX: chave aleatória inválida (32 caracteres)"
    default:          return "Chave PIX: selecione o tipo da chave"
  }
}

/* ─── Currículo ──────────────────────────────────────────────────────────── */

export const CURRICULO_MAX_BYTES = 10 * 1024 * 1024 // 10 MB
export const CURRICULO_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png"

/** Link do currículo (só coordenadores conseguem abrir). `ver` = abrir no navegador (PDF/imagem). */
export function urlCurriculo(professorId: string, nome: string, ver = false) {
  return `/api/curriculos/${professorId}/${encodeURIComponent(nome)}${ver ? "?ver=1" : ""}`
}
