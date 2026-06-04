interface AniversarioBadgeProps {
  size?: "sm" | "md" | "lg"
}

const sizes = {
  sm: "text-xs px-2.5 py-1 gap-1",
  md: "text-sm px-3 py-1.5 gap-1.5",
  lg: "text-base px-4 py-2 gap-2",
}

// Componente Server — sem interatividade, renderiza no servidor
export function AniversarioBadge({ size = "md" }: AniversarioBadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-bold rounded-full bg-anniversary-500 text-white shadow-sm ${sizes[size]}`}
      aria-label="10 anos de atividade"
    >
      <span aria-hidden="true">⭐</span>
      <span>10 Anos</span>
    </span>
  )
}
