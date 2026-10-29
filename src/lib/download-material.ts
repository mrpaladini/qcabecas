import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { registrarAuditoria, quem, fmtDataHoraAudit } from "@/lib/audit"
import { createReadStream } from "fs"
import { stat } from "fs/promises"
import { join, resolve, sep } from "path"
import { Readable } from "stream"

/** Link de download que já termina com o nome original (ex.: /api/materiais/12/Lista%20de%20exercicios.pdf). */
export function urlMaterial(id: bigint | number | string, nomeOriginal: string, ver = false) {
  return `/api/materiais/${id}/${encodeURIComponent(nomeOriginal)}${ver ? "?ver=1" : ""}`
}

/** Página de erro legível (em vez de um arquivo "1.txt" baixado). */
function paginaErro(status: number, titulo: string, detalhe: string) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title>
<style>body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}
.c{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;max-width:440px;text-align:center}
h1{font-size:18px;margin:0 0 8px}p{color:#475569;font-size:14px;line-height:1.5}a{color:#1d4ed8;font-weight:600}</style></head>
<body><div class="c"><h1>${titulo}</h1><p>${detalhe}</p><p><a href="javascript:history.back()">← Voltar</a></p></div></body></html>`
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
}

/** Divide por "/" e "\" — o caminho pode ter sido gravado no Windows e lido no Linux (ou o contrário). */
function partes(p: string) {
  return p.split(/[\\/]+/).filter(s => s && s !== "." && s !== "..")
}

/** encodeURIComponent deixa ' ( ) * sem codificar, e o Chrome rejeita o cabeçalho por isso. */
function rfc5987(nome: string) {
  return encodeURIComponent(nome).replace(/['()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase())
}

async function existe(p: string) {
  try { const s = await stat(p); return s.isFile() ? s.size : null } catch { return null }
}

/**
 * Entrega o arquivo enviado pelo aluno com o NOME, EXTENSÃO e FORMATO originais.
 * Acesso: professor da aula, o próprio aluno, ou coordenador.
 */
export async function baixarMaterial(request: Request, id: string) {
  const session = await auth()
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!user?.id) return paginaErro(401, "Sessão expirada", "Entre novamente no portal para baixar o arquivo.")

  let materialId: bigint
  try { materialId = BigInt(id) } catch { return paginaErro(400, "Link inválido", "Este link de arquivo não é válido.") }

  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: {
      appointment: { select: { professorId: true, disciplina: true, dataHora: true } },
      aluno:       { select: { name: true } },
    },
  })

  const userId = BigInt(user.id)
  const autorizado = !!material && (
    user.role === "COORDENADOR" ||
    (user.role === "PROFESSOR" && material.appointment.professorId === userId) ||
    (user.role === "ALUNO" && material.alunoId === userId)
  )
  // 404 também para "sem permissão" — não revela que o arquivo existe
  if (!material || !autorizado) return paginaErro(404, "Arquivo não encontrado", "Este arquivo não existe ou você não tem acesso a ele.")

  // Procura o arquivo: caminho gravado (normalizado) e, como reserva, uploads/<idAula>/<nomeGravado>
  const bases = Array.from(new Set([
    resolve(process.cwd(), "uploads"),
    ...(process.env.UPLOAD_DIR ? [resolve(process.cwd(), process.env.UPLOAD_DIR)] : []),
  ]))
  const candidatos: string[] = []
  for (const base of bases) {
    candidatos.push(resolve(base, ...partes(material.filepath)))
    candidatos.push(resolve(base, String(material.appointmentId), material.storedName))
  }

  let caminho: string | null = null
  let tamanho = 0
  for (const c of candidatos) {
    if (!bases.some(b => c.startsWith(b + sep))) continue // impede path traversal
    const t = await existe(c)
    if (t !== null) { caminho = c; tamanho = t; break }
  }
  if (!caminho) {
    console.error(`[materiais] arquivo ausente no disco — material ${material.id}, filepath "${material.filepath}". Procurado em:`, candidatos)
    return paginaErro(410, "Arquivo indisponível",
      `O arquivo "${material.originalName}" está registrado, mas não foi encontrado no servidor. ` +
      `Peça ao aluno para enviá-lo novamente.`)
  }

  // Nome original exatamente como o aluno enviou (com a extensão)
  const nome = material.originalName || material.storedName
  const nomeAscii = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")
  const visualizavel = ["application/pdf", "image/jpeg", "image/png"].includes(material.mimetype)
  const ver = visualizavel && new URL(request.url).searchParams.get("ver") === "1"

  if (user.role !== "ALUNO") {
    await registrarAuditoria(session, "MATERIAL_BAIXADO", "Material", material.id,
      `${quem(session)} baixou o material "${nome}" do aluno ${material.aluno.name.split(" ")[0]} ` +
      `(aula de ${material.appointment.disciplina} em ${fmtDataHoraAudit(material.appointment.dataHora)})`)
  }

  const stream = Readable.toWeb(createReadStream(caminho)) as ReadableStream
  return new Response(stream, {
    headers: {
      "Content-Type": material.mimetype || "application/octet-stream",
      "Content-Length": String(tamanho),
      "Content-Disposition": `${ver ? "inline" : "attachment"}; filename="${nomeAscii}"; filename*=UTF-8''${rfc5987(nome)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
