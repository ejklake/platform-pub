import { notFound } from 'next/navigation'
import { renderMarkdown } from '../../../../lib/markdown'
import { ArticleReader } from '../../../../components/article/ArticleReader'
import type { ArticleMetadata } from '../../../../lib/api'

// =============================================================================
// Publication Article Page — /pub/:slug/:articleSlug  (Server Component)
//
// Same as the standard article page but rendered within the publication shell
// (layout.tsx provides PublicationNav + PublicationFooter).
// =============================================================================

const GATEWAY = process.env.GATEWAY_INTERNAL_URL ?? process.env.GATEWAY_URL ?? 'http://localhost:3000'

async function getArticle(dTag: string): Promise<ArticleMetadata | null> {
  const res = await fetch(`${GATEWAY}/api/v1/articles/${dTag}`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) return null
  return res.json()
}

export default async function PublicationArticlePage({
  params,
}: {
  params: { slug: string; articleSlug: string }
}) {
  const article = await getArticle(params.articleSlug)
  if (!article) return notFound()

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
      articleDbId={article.id}
      writerName={article.writer.displayName ?? article.writer.username}
      writerUsername={article.writer.username}
      writerAvatar={article.writer.avatar ?? undefined}
      writerId={article.writer.id}
      subscriptionPricePence={article.writer.subscriptionPricePence}
      writerSpendThisMonthPence={article.writerSpendThisMonthPence ?? undefined}
      nudgeShownThisMonth={article.nudgeShownThisMonth ?? false}
      preRenderedFreeHtml={freeHtml}
    />
  )
}
