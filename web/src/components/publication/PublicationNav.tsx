import Link from 'next/link'

interface Props {
  slug: string
  name: string
  logo?: string | null
}

export function PublicationNav({ slug, name, logo }: Props) {
  return (
    <nav className="border-b border-grey-200 bg-white">
      <div className="mx-auto max-w-feed px-4 sm:px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-3">
          {logo && (
            <img src={logo} alt="" className="w-8 h-8 rounded-full object-cover" />
          )}
          <Link href={`/pub/${slug}`} className="font-serif text-lg font-medium text-black">
            {name}
          </Link>
        </div>
        <div className="flex items-center gap-4 text-ui-xs">
          <Link href={`/pub/${slug}/about`} className="text-grey-400 hover:text-black">About</Link>
          <Link href={`/pub/${slug}/masthead`} className="text-grey-400 hover:text-black">Masthead</Link>
          <Link href={`/pub/${slug}/archive`} className="text-grey-400 hover:text-black">Archive</Link>
          <Link href={`/pub/${slug}/subscribe`} className="btn text-xs">Subscribe</Link>
        </div>
      </div>
    </nav>
  )
}
