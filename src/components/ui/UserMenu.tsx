"use client"

import { useState } from "react"
import { logout } from "@/app/actions/auth"

interface UserMenuProps {
  name: string
  role: string
}

const roleLabel: Record<string, string> = {
  COORDENADOR: "Coordenação",
  PROFESSOR: "Professor(a)",
  ALUNO: "Aluno(a)",
}

export function UserMenu({ name, role }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const firstName = name.split(" ")[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-primary-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors"
      >
        <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">
          {firstName[0]?.toUpperCase()}
        </span>
        <span>{firstName}</span>
        <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-neutral-100 z-20 overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100">
              <p className="text-sm font-semibold text-neutral-900">{name}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{roleLabel[role] ?? role}</p>
            </div>
            {/* Server Action via form — funciona sem SessionProvider */}
            <form action={logout}>
              <button
                type="submit"
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sair
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
