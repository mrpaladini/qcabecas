import { baixarMaterial } from "@/lib/download-material"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// /api/materiais/12  (links antigos — sem o nome no final)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return baixarMaterial(request, id)
}
