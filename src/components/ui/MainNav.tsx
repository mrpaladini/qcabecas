"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

type Item = { href: string; label: string; icon?: string }
type Grupo = { label: string; itens: Item[] }
type Entrada = Item | Grupo

const MENU_COORDENADOR: Entrada[] = [
  { href: "/coordenador/agendamentos", label: "Agendamentos" },
  { href: "/coordenador/alunos", label: "Alunos" },
  { href: "/coordenador/professores", label: "Professores" },
  { href: "/coordenador/coordenadores", label: "Coordenadores" },
  { href: "/coordenador/disciplinas", label: "Disciplinas" },
  { href: "/coordenador/salas", label: "Salas" },
  { href: "/coordenador/calendario", label: "Calendário" },
  {
    label: "Relatório",
    itens: [
      { href: "/coordenador/relatorio", label: "Relatório de Aulas", icon: "📋" },
      { href: "/coordenador/relatorio/conferencia-professor", label: "Conferência Professor", icon: "👩‍🏫" },
      { href: "/coordenador/relatorio/conferencia-aluno", label: "Conferência Aluno", icon: "🎓" },
    ],
  },
  {
    label: "Finanças",
    itens: [
      { href: "/coordenador/financas/contas-a-receber", label: "Contas a Receber", icon: "💰" },
      { href: "/coordenador/financas/contas-a-pagar", label: "Contas a Pagar", icon: "💳" },
    ],
  },
  {
    label: "Administrativo",
    itens: [
      { href: "/coordenador/administrativo/auditoria", label: "Auditoria", icon: "🔎" },
    ],
  },
]

const MENU_ALUNO: Entrada[] = [
  { href: "/aluno", label: "Minhas aulas" },
  { href: "/aluno/materiais", label: "Enviar material" },
  { href: "/aluno/materiais-professor", label: "Materiais do professor" },
]

const MENU_PROFESSOR: Entrada[] = [
  { href: "/professor", label: "Minhas aulas e materiais" },
]

const MENU_PUBLICO: Entrada[] = [
  { href: "/#servicos", label: "Serviços" },
  { href: "/#contato", label: "Contato" },
]

function ehGrupo(e: Entrada): e is Grupo {
  return "itens" in e
}

/**
 * Navegação principal.
 * - Telas grandes (xl+): links em linha, com submenus (Finanças, Administrativo).
 * - Celular / tablet / notebook pequeno: botão ☰ que abre um painel com todos os itens.
 * O painel fecha sozinho ao trocar de página.
 */
export function MainNav({ role, logado }: { role?: string; logado: boolean }) {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)
  const [submenu, setSubmenu] = useState<string | null>(null)

  const menu: Entrada[] =
    role === "COORDENADOR" ? MENU_COORDENADOR :
    role === "ALUNO"       ? MENU_ALUNO :
    role === "PROFESSOR"   ? MENU_PROFESSOR :
    !logado                ? MENU_PUBLICO : []

  // fecha painel/submenus ao navegar (ajuste de estado durante o render, sem efeito)
  const [ultimoPath, setUltimoPath] = useState(pathname)
  if (ultimoPath !== pathname) {
    setUltimoPath(pathname)
    setAberto(false)
    setSubmenu(null)
  }

  // trava a rolagem do fundo com o painel aberto
  useEffect(() => {
    document.body.style.overflow = aberto ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [aberto])

  if (menu.length === 0) return null

  const RAIZES = ["/aluno", "/professor", "/coordenador/relatorio"] // raiz só fica ativa na própria página
  const ativo = (href: string) => !href.includes("#") &&
    (pathname === href || (!RAIZES.includes(href) && pathname.startsWith(href + "/")))
  const grupoAtivo = (g: Grupo) => g.itens.some(i => ativo(i.href))

  // Menu público é curto: mostra em linha a partir do md; o do coordenador só no xl
  const bpDesktop = role === "COORDENADOR" ? "xl" : "md"

  return (
    <>
      {/* ── Desktop ── */}
      <nav aria-label="Menu principal"
        className={`hidden ${bpDesktop === "xl" ? "xl:flex" : "md:flex"} items-center gap-5 text-sm font-medium text-neutral-600`}>
        {menu.map(e => ehGrupo(e) ? (
          <div key={e.label} className="relative group"
            onMouseLeave={() => setSubmenu(null)}>
            <button type="button"
              aria-haspopup="true" aria-expanded={submenu === e.label}
              onClick={() => setSubmenu(s => s === e.label ? null : e.label)}
              className={`flex items-center gap-1 font-semibold transition-colors hover:text-primary-700 ${grupoAtivo(e) ? "text-primary-700" : ""}`}>
              {e.label} <span className="text-xs opacity-60">▾</span>
            </button>
            <div className={`absolute right-0 top-full pt-2 w-56 z-50 transition-all duration-150
              ${submenu === e.label ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
              group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto`}>
              <div className="bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden">
                {e.itens.map((i, idx) => (
                  <Link key={i.href} href={i.href}
                    className={`flex items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-primary-50 hover:text-primary-700
                      ${idx > 0 ? "border-t border-neutral-100" : ""} ${ativo(i.href) ? "text-primary-700 bg-primary-50" : "text-neutral-700"}`}>
                    {i.icon && <span aria-hidden="true">{i.icon}</span>} {i.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <Link key={e.href} href={e.href}
            className={`transition-colors hover:text-primary-700 whitespace-nowrap ${ativo(e.href) ? "text-primary-700 font-semibold" : ""}`}>
            {e.label}
          </Link>
        ))}
      </nav>

      {/* ── Botão ☰ (celular/tablet) ── */}
      <button type="button" onClick={() => setAberto(true)}
        aria-label="Abrir menu" aria-expanded={aberto} aria-controls="menu-mobile"
        className={`${bpDesktop === "xl" ? "xl:hidden" : "md:hidden"} order-last inline-flex items-center justify-center w-10 h-10 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50`}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* ── Painel lateral ── */}
      {aberto && (
        <div className={`${bpDesktop === "xl" ? "xl:hidden" : "md:hidden"} fixed inset-0 z-[60]`} role="dialog" aria-modal="true" id="menu-mobile">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 top-0 h-full w-[85vw] max-w-xs bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-16 border-b border-neutral-100">
              <span className="font-bold text-neutral-900">Menu</span>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar menu"
                className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-neutral-100 text-neutral-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav aria-label="Menu" className="flex-1 overflow-y-auto py-2">
              {menu.map(e => ehGrupo(e) ? (
                <div key={e.label} className="py-1">
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">{e.label}</p>
                  {e.itens.map(i => (
                    <Link key={i.href} href={i.href} onClick={() => setAberto(false)}
                      className={`flex items-center gap-2 px-4 py-3 text-base ${ativo(i.href) ? "bg-primary-50 text-primary-700 font-semibold" : "text-neutral-700 hover:bg-neutral-50"}`}>
                      {i.icon && <span aria-hidden="true">{i.icon}</span>} {i.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link key={e.href} href={e.href} onClick={() => setAberto(false)}
                  className={`block px-4 py-3 text-base ${ativo(e.href) ? "bg-primary-50 text-primary-700 font-semibold" : "text-neutral-700 hover:bg-neutral-50"}`}>
                  {e.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
