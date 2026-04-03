interface ThereforeMarkProps {
  size?: number          // display width in px (height scales proportionally)
  weight?: 'heavy' | 'medium' | 'light'
  animate?: 'spin' | 'ellipsis'
  className?: string     // for colour via Tailwind (e.g. text-crimson, text-grey-400)
}

const radii: Record<string, number> = {
  heavy: 4.0,
  medium: 3.4,
  light: 2.8,
}

export function ThereforeMark({
  size = 22,
  weight = 'heavy',
  animate,
  className = '',
}: ThereforeMarkProps) {
  const r = radii[weight]
  const h = Math.round(size * (22 / 26))

  const animClass = animate === 'spin'
    ? 'therefore-spin'
    : animate === 'ellipsis'
      ? 'therefore-ellipsis'
      : ''

  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 26 22"
      fill="currentColor"
      className={`${className} ${animClass}`.trim()}
      aria-hidden="true"
    >
      <circle className="therefore-dot therefore-dot-top" cx="13" cy="4.5" r={r} />
      <circle className="therefore-dot therefore-dot-bl" cx="5.2" cy="17.5" r={r} />
      <circle className="therefore-dot therefore-dot-br" cx="20.8" cy="17.5" r={r} />
    </svg>
  )
}
