import Link from 'next/link'

interface Article {
  nostr_d_tag: string
  title: string
  summary: string | null
  published_at: string | null
  author_display_name: string | null
  author_username: string
}

interface Props {
  slug: string
  articles: Article[]
}

export function HomepageMagazine({ slug, articles }: Props) {
  if (articles.length === 0) {
    return <p className="text-grey-400 text-sm py-10 text-center">No articles published yet.</p>
  }

  const [featured, ...rest] = articles

  return (
    <div>
      {/* Featured hero card */}
      <Link href={`/pub/${slug}/${featured.nostr_d_tag}`} className="block bg-grey-100 p-8 mb-6 group">
        <h2 className="font-serif text-3xl text-black group-hover:opacity-70 mb-2">{featured.title}</h2>
        {featured.summary && <p className="text-sm text-grey-600 mb-3 line-clamp-3">{featured.summary}</p>}
        <p className="text-ui-xs text-grey-300">
          {featured.author_display_name || featured.author_username}
          {featured.published_at && (
            <> &middot; {new Date(featured.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</>
          )}
        </p>
      </Link>

      {/* Grid of remaining articles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rest.map(a => (
          <Link key={a.nostr_d_tag} href={`/pub/${slug}/${a.nostr_d_tag}`} className="block bg-grey-100 p-5 group">
            <h3 className="font-serif text-lg text-black group-hover:opacity-70 mb-1">{a.title}</h3>
            <p className="text-ui-xs text-grey-300">
              {a.author_display_name || a.author_username}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
