import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { getPagamento } from "../../actions"
import { RelatorioPagamento } from "./RelatorioPagamento"

export default async function RelatorioPagamentoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if ((session?.user as any)?.role !== "COORDENADOR") redirect("/unauthorized")

  const { id } = await params
  const pagamento = await getPagamento(id)
  if (!pagamento) notFound()

  return <RelatorioPagamento pagamento={pagamento} />
}
