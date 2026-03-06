type NodeInsertButtonProps = {
  onClick: () => void
}

export function NodeInsertButton({ onClick }: NodeInsertButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Inserer un noeud"
      className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)] text-white text-sm hover:opacity-80 transition-opacity shadow-md"
    >
      +
    </button>
  )
}
