'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface FeaturedArticle {
  dTag: string
  title: string
  summary: string | null
  contentFree: string
  publishedAt: number
  pricePence: number | null
  isPaywalled: boolean
  authorDisplayName: string | null
  authorUsername: string | null
}

export function FeaturedWriters() {
  const [articles, setArticles] = useState<FeaturedArticle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/feed/featured')
      .then(r => r.ok ? r.json() : { articles: [] })
      .then(data => setArticles((data.articles ?? []).slice(0, 3)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-0">
        {[1, 2, 3].map(i => (
          <div key={i} style={{ background: '#FFFAEF', borderBottom: '2.5px solid #B8D2C1', padding: '1.5rem 1.75rem' }}>
            <div className="h-3 w-24 animate-pulse bg-surface-deep mb-4" />
            <div className="h-5 w-3/4 animate-pulse bg-surface-deep mb-3" />
            <div className="h-3 w-full animate-pulse bg-surface-deep" />
          </div>
        ))}
      </div>
    )
  }

  if (articles.length === 0) return null

  return (
    <div className="space-y-0">
      {articles.map(article => (
        <FeaturedCard key={article.dTag} article={article} />
      ))}
    </div>
  )
}

function FeaturedCard({ article }: { article: FeaturedArticle }) {
  const excerpt = article.summary || truncate(stripMarkdown(article.contentFree), 200)
  const wordCount = article.contentFree.split(/\s+/).length
  const readMinutes = Math.max(1, Math.round(wordCount / 200))

  return (
    <Link
      href={`/article/${article.dTag}`}
      className="block"
      style={{
        background: '#FFFAEF',
        padding: '1.5rem 1.75rem',
        borderLeft: '4px solid transparent',
        borderBottom: '2.5px solid #B8D2C1',
        cursor: 'pointer',
        transition: 'border-left-color 0.12s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderLeftColor = '#B5242A')}
      onMouseLeave={e => (e.currentTarget.style.borderLeftColor = 'transparent')}
    >
      {article.authorDisplayName && (
        <p style={{ fontFamily: '"Source Sans 3", system-ui, sans-serif', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A8578', marginBottom: '10px' }}>
          {article.authorDisplayName}
        </p>
      )}

      <h2 style={{ fontFamily: '"Literata", Georgia, serif', fontSize: '28px', fontWeight: 500, fontStyle: 'italic', color: '#0F1F18', lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: '10px' }}>
        {article.title}
      </h2>

      <p style={{ fontFamily: '"Source Sans 3", system-ui, sans-serif', fontSize: '16px', fontWeight: 400, color: '#263D32', lineHeight: 1.6, marginBottom: '14px' }}>
        {excerpt}
      </p>

      <div className="flex items-center gap-3" style={{ fontFamily: '"Source Sans 3", system-ui, sans-serif', fontSize: '13px', color: '#ACA69C' }}>
        <span>{formatDate(article.publishedAt)}</span>
        <span style={{ opacity: 0.4 }}>/</span>
        <span>{readMinutes} min</span>
        {article.isPaywalled && article.pricePence && (
          <>
            <span style={{ opacity: 0.4 }}>/</span>
            <span style={{ color: '#B5242A' }}>£{(article.pricePence / 100).toFixed(2)}</span>
          </>
        )}
      </div>
    </Link>
  )
}

function truncate(t: string, n: number) { return t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, '') + '...' }
function stripMarkdown(md: string) {
  return md.replace(/^#{1,6}\s+/gm,'').replace(/\*\*(.+?)\*\*/g,'$1').replace(/\*(.+?)\*/g,'$1')
    .replace(/\[(.+?)\]\(.+?\)/g,'$1').replace(/!\[.*?\]\(.+?\)/g,'').replace(/\n+/g,' ').trim()
}
function formatDate(ts: number) {
  const d = new Date(ts*1000), now = new Date(), days = Math.floor((now.getTime()-d.getTime())/86400000)
  if (days===0) return 'Today'; if (days===1) return 'Yesterday'; if (days<7) return `${days}d ago`
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:d.getFullYear()!==now.getFullYear()?'numeric':undefined})
}
