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

export function HomepageBlog({ slug, articles }: Props) {
  if (articles.length === 0) {
    return <p className="text-grey-400 text-sm py-10 text-center">No articles published yet.</p>
  }

  return (
    <div className="space-y-0">
      {articles.map(a => (
        <article key={a.nostr_d_tag} className="border-b border-grey-200 py-6">
          <Link href={`/pub/${slug}/${a.nostr_d_tag}`} className="block group">
            <h2 className="font-serif text-xl text-black group-hover:opacity-70 mb-1">{a.title}</h2>
            {a.summary && <p className="text-sm text-grey-600 mb-2 line-clamp-2">{a.summary}</p>}
            <p className="text-ui-xs text-grey-300">
              {a.author_display_name || a.author_username}
              {a.published_at && (
                <> &middot; {new Date(a.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</>
              )}
            </p>
          </Link>
        </article>
      ))}
    </div>
  )
}
