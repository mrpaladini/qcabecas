import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { registrarAuditoria, quem, fmtDataHoraAudit } from "@/lib/audit"
import { createReadStream } from "fs"
import { stat } from "fs/promises"
import { join, resolve, sep } from "path"
import { Readable } from "stream"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Download de material enviado pelo aluno.
 * Acesso: o professor da aula, o próprio aluno que enviou, ou qualquer coordenador.
 * Os arquivos ficam fora de /public (pasta uploads/), então só saem por aqui.
 *
 * ?ver=1 abre no navegador (PDF/imagem); sem ele, força o download.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!user?.id) return new Response("Não autenticado", { status: 401 })

  const { id } = await params
  let materialId: bigint
  try { materialId = BigInt(id) } catch { return new Response("Arquivo inválido", { status: 400 }) }

  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: {
      appointment: { select: { professorId: true, alunoId: true, disciplina: true, dataHora: true } },
      aluno:       { select: { name: true } },
    },
  })
  if (!material) return new Response("Arquivo não encontrado", { status: 404 })

  const userId = BigInt(user.id)
  const autorizado =
    user.role === "COORDENADOR" ||
    (user.role === "PROFESSOR" && material.appointment.professorId === userId) ||
    (user.role === "ALUNO" && material.alunoId === userId)
  // 404 em vez de 403 para não revelar que o arquivo existe
  if (!autorizado) return new Response("Arquivo não encontrado", { status: 404 })

  // Impede path traversal: o caminho final precisa estar dentro de uploads/
  const base = resolve(process.cwd(), "uploads")
  const caminho = resolve(base, material.filepath)
  if (!caminho.startsWith(base + sep)) return new Response("Arquivo inválido", { status: 400 })

  let tamanho: number
  try {
    tamanho = (await stat(caminho)).size
  } catch {
    return new Response("O arquivo não está mais disponível no servidor", { status: 410 })
  }

  // Só PDF e imagem podem abrir direto no navegador; o resto sempre baixa
  const visualizavel = ["application/pdf", "image/jpeg", "image/png"].includes(material.mimetype)
  const ver = visualizavel && new URL(request.url).searchParams.get("ver") === "1"
  const nome = material.originalName || material.storedName
  const nomeAscii = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "")
  const disposition = `${ver ? "inline" : "attachment"}; filename="${nomeAscii}"; filename*=UTF-8''${encodeURIComponent(nome)}`

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
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
