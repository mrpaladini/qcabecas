"use server"

import { auth, signOut } from "@/lib/auth"
import { registrarAuditoria, quem } from "@/lib/audit"

export async function logout() {
  const session = await auth()
  if (session?.user) {
    await registrarAuditoria(session, "LOGOUT", "Usuario", (session.user as any).id, `${quem(session)} saiu do sistema`)
  }
  await signOut({ redirectTo: "/" })
}
