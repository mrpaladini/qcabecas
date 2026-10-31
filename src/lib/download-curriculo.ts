import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { registrarAuditoria, quem } from "@/lib/audit"
import { caminhoCurriculo } from "@/lib/curriculo"
import { createReadStream } from "fs"
import { stat } from "fs/promises"
import { Readable } from "stream"

function paginaErro(status: number, titulo: string, detalhe: string) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title>
<style>body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}
.c{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;max-width:440px;text-align:center}
h1{font-size:18px;margin:0 0 8px}p{color:#475569;font-size:14px;line-height:1.5}a{color:#1d4ed8;font-weight:600}</style></head>
<body><div class="c"><h1>${titulo}</h1><p>${detalhe}</p><p><a href="javascript:history.back()">← Voltar</a></p></div></body></html>`
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
}

function rfc5987(nome: string) {
  return encodeURIComponent(nome).replace(/['()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase())
}

/** Entrega o currículo do professor. Acesso: SOMENTE coordenador. */
export async function baixarCurriculo(request: Request, id: string) {
  const session = await auth()
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!user?.id) return paginaErro(401, "Sessão expirada", "Entre novamente no portal para abrir o currículo.")
  // 404 também para "sem permissão" — não revela que o arquivo existe
  if (user.role !== "COORDENADOR") return paginaErro(404, "Arquivo não encontrado", "Este arquivo não existe ou você não tem acesso a ele.")

  let profId: bigint
  try { profId = BigInt(id) } catch { return paginaErro(400, "Link inválido", "Este link não é válido.") }

  const prof = await prisma.user.findFirst({
    where: { id: profId, role: "PROFESSOR" },
    select: { name: true, curriculoNome: true, curriculoArquivo: true, curriculoMime: true },
  })
  if (!prof?.curriculoArquivo) return paginaErro(404, "Currículo não encontrado", "Este professor não tem currículo cadastrado.")

  const caminho = caminhoCurriculo(prof.curriculoArquivo)
  let tamanho = 0
  try { const s = caminho ? await stat(caminho) : null; if (!s?.isFile()) throw 0; tamanho = s.size } catch {
    console.error(`[curriculos] arquivo ausente no disco — professor ${id}, "${prof.curriculoArquivo}"`)
    return paginaErro(410, "Arquivo indisponível", "O currículo está registrado, mas não foi encontrado no servidor. Envie-o novamente no cadastro do professor.")
  }

  const nome = prof.curriculoNome || "curriculo"
  const nomeAscii = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")
  const mime = prof.curriculoMime || "application/octet-stream"
  const visualizavel = ["application/pdf", "image/jpeg", "image/png"].includes(mime)
  const ver = visualizavel && new URL(request.url).searchParams.get("ver") === "1"

  await registrarAuditoria(session, "CURRICULO_VISUALIZADO", "Usuario", id,
    `${quem(session)} abriu o currículo do professor ${prof.name}`)

  const stream = Readable.toWeb(createReadStream(caminho!)) as ReadableStream
  return new Response(stream, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(tamanho),
      "Content-Disposition": `${ver ? "inline" : "attachment"}; filename="${nomeAscii}"; filename*=UTF-8''${rfc5987(nome)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
