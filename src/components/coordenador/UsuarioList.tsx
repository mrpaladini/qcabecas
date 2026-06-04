"use client"

import { useState, useTransition } from "react"
import { desativarUsuario, reativarUsuario, regerarSenha } from "@/app/coordenador/usuarios/actions"

type Usuario = {
  id: string
  name: string
  email: string
  phone: string | null
  tempPassword: string | null
  deletedAt: Date | null
}

export function UsuarioList({ usuarios, role }: { usuarios: Usuario[]; role: "ALUNO" | "PROFESSOR" }) {
  const [senhaVisivel, setSenhaVisivel] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  async function handleRegerarSenha(id: string) {
    const res = await regerarSenha(id)
    if (res.success) setSenhaVisivel(prev => ({ ...prev, [id]: res.data!.senhaGerada }))
  }

  async function handleToggleAtivo(id: string, ativo: boolean) {
    startTransition(async () => {
      if (ativo) await desativarUsuario(id)
      else await reativarUsuario(id)
    })
  }

  if (usuarios.length === 0)
    return <p className="text-neutral-500 text-center py-10">Nenhum {role === "ALUNO" ? "aluno" : "professor"} cadastrado ainda.</p>

  return (
    <div className="space-y-3">
      {usuarios.map(u => {
        const ativo = !u.deletedAt
        const senha = senhaVisivel[u.id] ?? u.tempPassword
        return (
          <div key={u.id} className={`bg-white border rounded-2xl p-4 flex flex-wrap items-center gap-4 ${!ativo ? "opacity-60" : ""}`}>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-neutral-900 truncate">{u.name}</p>
              <p className="text-sm text-neutral-500">{u.email}</p>
              {u.phone && <p className="text-xs text-neutral-400">{u.phone}</p>}
            </div>

            {senha && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                <span className="text-xs text-amber-700 font-medium">Senha:</span>
                <code className="text-xs font-mono text-amber-900 font-bold">{senha}</code>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRegerarSenha(u.id)}
                className="text-xs text-primary-600 hover:text-primary-800 font-medium border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
              >
                Gerar nova senha
              </button>
              <button
                onClick={() => handleToggleAtivo(u.id, ativo)}
                disabled={isPending}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  ativo
                    ? "text-red-600 border border-red-200 hover:bg-red-50"
                    : "text-green-600 border border-green-200 hover:bg-green-50"
                }`}
              >
                {ativo ? "Desativar" : "Reativar"}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
