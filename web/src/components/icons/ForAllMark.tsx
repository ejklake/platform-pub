interface ForAllMarkProps {
  size?: number
  className?: string
}

/**
 * ∀ — the universal quantifier, rendered as an inverted capital A.
 * Heavy stroke weight, low crossbar. SVG path, not a Unicode character.
 */
export function ForAllMark({ size = 22, className = '' }: ForAllMarkProps) {
  // Aspect ratio roughly 0.8:1 (width:height)
  const w = size
  const h = Math.round(size * 1.15)

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 40 46"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {/* Inverted A — two heavy legs meeting at bottom, crossbar near the bottom */}
      <path d="M0 0L16.5 46H23.5L40 0H32.5L20 35.5L7.5 0H0Z" />
      <rect x="9" y="6" width="22" height="5" />
    </svg>
  )
}
