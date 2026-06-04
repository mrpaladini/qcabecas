import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

// Página de redirecionamento pós-login — envia para o dashboard do perfil correto
export default async function DashboardRedirect() {
  const session = await auth()

  if (!session?.user) redirect("/login")

  const role = (session.user as any).role

  if (role === "COORDENADOR") redirect("/coordenador/agendamentos")
  if (role === "PROFESSOR")   redirect("/professor")
  if (role === "ALUNO")       redirect("/aluno")

  redirect("/login")
}
