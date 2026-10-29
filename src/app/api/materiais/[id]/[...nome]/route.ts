import { baixarMaterial } from "@/lib/download-material"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// /api/materiais/12/Lista%20de%20exercicios.pdf — o nome no final garante que o
// navegador salve com o nome e a extensão originais mesmo se ignorar o cabeçalho.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; nome: string[] }> },
) {
  const { id } = await params
  return baixarMaterial(request, id)
}
