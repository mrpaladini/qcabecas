import { redirect } from "next/navigation"

// /coordenador/administrativo → abre direto a Auditoria (único submenu por enquanto)
export default function AdministrativoPage() {
  redirect("/coordenador/administrativo/auditoria")
}
