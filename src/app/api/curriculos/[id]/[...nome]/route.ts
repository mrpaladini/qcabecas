import { baixarCurriculo } from "@/lib/download-curriculo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// /api/curriculos/<idProfessor>/<nome-do-arquivo>  — somente coordenadores
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; nome: string[] }> },
) {
  const { id } = await params
  return baixarCurriculo(request, id)
}
