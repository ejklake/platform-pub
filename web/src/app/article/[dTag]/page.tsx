import { notFound } from 'next/navigation'
import { renderMarkdown } from '../../../lib/markdown'
import { ArticleReader } from '../../../components/article/ArticleReader'
import type { ArticleMetadata } from '../../../lib/api'

// =============================================================================
// Article Page — /article/:dTag  (Server Component)
//
// Fetches article metadata + free content from the gateway at request time,
// renders markdown to HTML on the server, and passes the result to the
// ArticleReader client component for interactive features (paywall, replies,
// quote selection).
//
// The article body arrives as static HTML — no JavaScript needed to read it.
// =============================================================================

const GATEWAY = process.env.GATEWAY_INTERNAL_URL ?? process.env.GATEWAY_URL ?? 'http://localhost:3000'

async function getArticle(dTag: string): Promise<ArticleMetadata | null> {
  const res = await fetch(`${GATEWAY}/api/v1/articles/${dTag}`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) return null
  return res.json()
}

export default async function ArticlePage({ params }: { params: { dTag: string } }) {
  const article = await getArticle(params.dTag)
  if (!article) return notFound()

  // Render free-section markdown to HTML on the server
  const freeHtml = article.contentFree
    ? await renderMarkdown(article.contentFree)
    : ''

  return (
    <ArticleReader
      article={{
        id: article.nostrEventId,
        pubkey: article.writer.pubkey,
        dTag: article.dTag,
        title: article.title,
        summary: article.summary ?? '',
        content: article.contentFree ?? '',
        publishedAt: article.publishedAt
          ? Math.floor(new Date(article.publishedAt).getTime() / 1000)
          : 0,
        tags: [],
        pricePence: article.pricePence ?? undefined,
        gatePositionPct: article.gatePositionPct ?? undefined,
        isPaywalled: article.isPaywalled,
      }}
      writerName={article.writer.displayName ?? article.writer.username}
      writerUsername={article.writer.username}
      writerAvatar={article.writer.avatar ?? undefined}
      preRenderedFreeHtml={freeHtml}
    />
  )
}
