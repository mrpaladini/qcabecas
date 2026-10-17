"use client"

import { useMemo, useState } from "react"
import { UsuarioCRUD, type Usuario } from "./UsuarioCRUD"
import { serieLabel } from "@/lib/professor"

/** Remove acentos e caixa para a busca ("José" encontra "jose"). */
export function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

function textoBusca(u: Usuario) {
  return normalizar([
    u.name, u.email, u.phone, u.phone2,
    u.responsavelNome, u.responsavelTelefone, u.cpfResponsavel,
    u.escola, u.serie, u.cidade, u.bairro, u.escolaAtuacao,
    ...(u.seriesAtendidas ?? []).map(serieLabel),
  ].filter(Boolean).join(" "))
}

export function UsuariosComBusca({ usuarios, role }: {
  usuarios: Usuario[]
  role: "ALUNO" | "PROFESSOR" | "COORDENADOR"
}) {
  const [busca, setBusca] = useState("")
  const [ordem, setOrdem] = useState<"nome" | "recentes">("nome")

  const indexados = useMemo(() => usuarios.map(u => ({ u, txt: textoBusca(u) })), [usuarios])

  const filtrados = useMemo(() => {
    const termos = normalizar(busca).split(/\s+/).filter(Boolean)
    const digitos = busca.replace(/\D/g, "")
    let l = indexados
      .filter(({ u, txt }) =>
        termos.every(t => txt.includes(t)) ||
        // telefone/CPF digitados só com números
        (digitos.length >= 4 && [u.phone, u.phone2, u.responsavelTelefone, u.cpfResponsavel]
          .some(v => v?.replace(/\D/g, "").includes(digitos))))
      .map(x => x.u)
    if (ordem === "recentes") l = [...l].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    return l
  }, [indexados, busca, ordem])

  const ativos   = filtrados.filter(u => !u.deletedAt)
  const inativos = filtrados.filter(u =>  u.deletedAt)

  const placeholder = role === "ALUNO"
    ? "Buscar por nome, e-mail, telefone, responsável, escola…"
    : role === "PROFESSOR"
      ? "Buscar por nome, e-mail, telefone, escola, série…"
      : "Buscar por nome ou e-mail…"

  return (
    <div className="space-y-8">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border border-neutral-200 rounded-2xl p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm pointer-events-none">🔍</span>
          <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder={placeholder}
            aria-label="Buscar"
            className="w-full border border-neutral-300 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={ordem} onChange={e => setOrdem(e.target.value as any)} aria-label="Ordenar"
          className="border border-neutral-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="nome">Ordem alfabética</option>
          <option value="recentes">Cadastro mais recente</option>
        </select>
        {busca && (
          <span className="text-xs text-neutral-500">{filtrados.length} de {usuarios.length} encontrado(s)</span>
        )}
      </div>

      <section>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Ativos ({ativos.length})</h2>
        <UsuarioCRUD usuarios={ativos} role={role} />
      </section>

      {inativos.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-neutral-500 mb-4">Inativos ({inativos.length})</h2>
          <UsuarioCRUD usuarios={inativos} role={role} />
        </section>
      )}
    </div>
  )
}
