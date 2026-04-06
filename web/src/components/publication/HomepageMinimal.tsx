import Link from 'next/link'

interface Article {
  nostr_d_tag: string
  title: string
  published_at: string | null
  author_display_name: string | null
  author_username: string
}

interface Props {
  slug: string
  articles: Article[]
}

export function HomepageMinimal({ slug, articles }: Props) {
  if (articles.length === 0) {
    return <p className="text-grey-400 text-sm py-10 text-center">No articles published yet.</p>
  }

  return (
    <ul className="space-y-3">
      {articles.map(a => (
        <li key={a.nostr_d_tag}>
          <Link href={`/pub/${slug}/${a.nostr_d_tag}`} className="flex items-baseline gap-3 group">
            <h2 className="font-serif text-base text-black group-hover:opacity-70">{a.title}</h2>
            {a.published_at && (
              <span className="text-ui-xs text-grey-300 shrink-0">
                {new Date(a.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
