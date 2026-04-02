interface AvatarProps {
  src?: string | null
  name: string
  size?: number
  lazy?: boolean
}

export function Avatar({ src, name, size = 28, lazy = true }: AvatarProps) {
  const initial = (name || '?')[0].toUpperCase()

  if (!src) {
    return (
      <span
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        className="inline-flex items-center justify-center rounded-full bg-grey-100 text-grey-400 font-medium flex-shrink-0"
      >
        {initial}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading={lazy ? 'lazy' : undefined}
      className="rounded-full object-cover flex-shrink-0"
    />
  )
}
