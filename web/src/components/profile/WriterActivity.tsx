'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '../../stores/auth'
import { ArticleCard } from '../feed/ArticleCard'
import { NoteCard } from '../feed/NoteCard'
import { NoteComposer } from '../feed/NoteComposer'
import { VoteControls } from '../ui/VoteControls'
import type { WriterProfile, VoteTally, MyVoteCount } from '../../lib/api'
import type { ArticleEvent, NoteEvent } from '../../lib/ndk'
import type { QuoteTarget } from '../../lib/publishNote'
import { formatDateFromISO } from '../../lib/format'

interface DbArticle {
  id: string
  nostrEventId: string
  dTag: string
  title: string
  slug: string
  summary: string | null
  wordCount: number | null
  isPaywalled: boolean
  publishedAt: string | null
}

interface DbNote {
  id: string
  nostrEventId: string
  content: string
  publishedAt: string
  quotedEventId?: string
  quotedEventKind?: number
  quotedExcerpt?: string
  quotedTitle?: string
  quotedAuthor?: string
}

interface DbReply {
  id: string
  nostrEventId: string
  content: string
  publishedAt: string
  isDeleted: boolean
  targetKind: number
  targetEventId: string | null
  articleSlug: string | null
  articleTitle: string | null
  parentEventId: string | null
  parentAuthorUsername: string | null
  parentAuthorDisplayName: string | null
}

type ActivityItem =
  | { kind: 'article'; publishedAt: string; data: DbArticle }
  | { kind: 'note'; publishedAt: string; data: DbNote }
  | { kind: 'reply'; publishedAt: string; data: DbReply }

interface SubStatus {
  subscribed: boolean
  ownContent?: boolean
  status?: string
  pricePence?: number
  currentPeriodEnd?: string
}

interface WriterActivityProps {
  username: string
  writer: WriterProfile
}

export function WriterActivity({ username, writer }: WriterActivityProps) {
  const { user, loading: authLoading } = useAuth()
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null)
  const [subLoading, setSubLoading] = useState(false)
  const [pendingQuote, setPendingQuote] = useState<QuoteTarget | null>(null)
  const [voteTallies, setVoteTallies] = useState<Record<string, VoteTally>>({})
  const [myVoteCounts, setMyVoteCounts] = useState<Record<string, MyVoteCount>>({})

  useEffect(() => {
    async function loadActivity() {
      setLoading(true)
      try {
        const [articlesRes, notesRes, repliesRes] = await Promise.all([
          fetch(`/api/v1/writers/${username}/articles?limit=50`, { credentials: 'include' }),
          fetch(`/api/v1/writers/${username}/notes?limit=50`, { credentials: 'include' }),
          fetch(`/api/v1/writers/${username}/replies?limit=50`, { credentials: 'include' }),
        ])
        const items: ActivityItem[] = []
        if (articlesRes.ok) {
          const data = await articlesRes.json()
          for (const a of (data.articles ?? []) as DbArticle[]) {
            if (a.publishedAt) items.push({ kind: 'article', publishedAt: a.publishedAt, data: a })
          }
        }
        if (notesRes.ok) {
          const data = await notesRes.json()
          for (const n of (data.notes ?? []) as DbNote[]) {
            items.push({ kind: 'note', publishedAt: n.publishedAt, data: n })
          }
        }
        if (repliesRes.ok) {
          const data = await repliesRes.json()
          for (const r of (data.replies ?? []) as DbReply[]) {
            items.push({ kind: 'reply', publishedAt: r.publishedAt, data: r })
          }
        }
        items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        setActivity(items)

        const eventIds = items.map(i => {
          if (i.kind === 'article') return (i.data as DbArticle).nostrEventId
          if (i.kind === 'note') return (i.data as DbNote).nostrEventId
          return (i.data as DbReply).nostrEventId
        })
        if (eventIds.length > 0) {
          const idsParam = eventIds.join(',')
          const [talliesRes, myVotesRes] = await Promise.all([
            fetch(`/api/v1/votes/tally?eventIds=${idsParam}`)
              .then(r => r.ok ? r.json() : { tallies: {} })
              .catch(() => ({ tallies: {} })),
            fetch(`/api/v1/votes/mine?eventIds=${idsParam}`, { credentials: 'include' })
              .then(r => r.ok ? r.json() : { voteCounts: {} })
              .catch(() => ({ voteCounts: {} })),
          ])
          setVoteTallies(talliesRes.tallies ?? {})
          setMyVoteCounts(myVotesRes.voteCounts ?? {})
        }
      } catch { /* silently fail */ }
      finally { setLoading(false) }
    }
    loadActivity()
  }, [username])

  useEffect(() => {
    if (!user || !writer) return
    async function checkStatus() {
      try {
        const [followRes, subRes] = await Promise.all([
          fetch('/api/v1/follows', { credentials: 'include' }),
          fetch(`/api/v1/subscriptions/check/${writer!.id}`, { credentials: 'include' }),
        ])
        if (followRes.ok) {
          const data = await followRes.json()
          setFollowing((data.writers ?? []).some((w: any) => w.id === writer!.id))
        }
        if (subRes.ok) {
          setSubStatus(await subRes.json())
        }
      } catch { setSubStatus({ subscribed: false }) }
    }
    checkStatus()
  }, [user, writer])

  async function handleToggleFollow() {
    if (!user || !writer) return
    setFollowLoading(true)
    try {
      const res = await fetch(`/api/v1/follows/${writer.id}`, {
        method: following ? 'DELETE' : 'POST',
        credentials: 'include',
      })
      if (res.ok) setFollowing(!following)
    } catch (err) { console.error('Follow error:', err) }
    finally { setFollowLoading(false) }
  }

  async function handleSubscribe(period: 'monthly' | 'annual' = 'monthly') {
    if (!user || !writer) return
    setSubLoading(true)
    try {
      const res = await fetch(`/api/v1/subscriptions/${writer.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      })
      if (res.ok) {
        const data = await res.json()
        setSubStatus({ subscribed: true, status: 'active', pricePence: data.pricePence, currentPeriodEnd: data.currentPeriodEnd })
      }
    } catch (err) { console.error('Subscribe error:', err) }
    finally { setSubLoading(false) }
  }

  async function handleUnsubscribe() {
    if (!user || !writer) return
    setSubLoading(true)
    try {
      const res = await fetch(`/api/v1/subscriptions/${writer.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setSubStatus({ subscribed: true, status: 'cancelled', currentPeriodEnd: data.accessUntil })
      }
    } catch (err) { console.error('Unsubscribe error:', err) }
    finally { setSubLoading(false) }
  }

  const handleNoteDeleted = useCallback((id: string) => {
    setActivity(prev => prev.filter(i => !(i.kind === 'note' && (i.data as DbNote).nostrEventId === id)))
  }, [])

  const handleQuote = useCallback((target: QuoteTarget) => {
    setPendingQuote(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const isOwnProfile = user?.username === username
  const hasPaywalledArticles = activity.some(i => i.kind === 'article' && (i.data as DbArticle).isPaywalled)

  return (
    <>
      {/* Action buttons — rendered client-side since they need auth state */}
      {user && !isOwnProfile && (
        <div className="flex items-center gap-2 mb-6 -mt-6">
          <button
            onClick={handleToggleFollow}
            disabled={followLoading}
            className={`transition-colors disabled:opacity-50 ${following ? 'btn-soft py-1.5 px-4 text-ui-xs' : 'btn py-1.5 px-4 text-ui-xs'}`}
          >
            {followLoading ? '...' : following ? 'Following' : 'Follow'}
          </button>

          {hasPaywalledArticles && subStatus && !subStatus.ownContent && (
            subStatus.subscribed ? (
              <button
                onClick={handleUnsubscribe}
                disabled={subLoading}
                className="btn-soft py-1.5 px-4 text-ui-xs disabled:opacity-50 transition-colors"
              >
                {subLoading ? '...' : subStatus.status === 'cancelled'
                  ? `Access until ${new Date(subStatus.currentPeriodEnd!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                  : 'Subscribed'}
              </button>
            ) : (() => {
              const monthlyPence = subStatus.pricePence ?? writer.subscriptionPricePence ?? 500
              const discount = writer.annualDiscountPct ?? 15
              const annualPence = Math.round(monthlyPence * 12 * (1 - discount / 100))
              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSubscribe('monthly')}
                    disabled={subLoading}
                    className="btn-accent py-1.5 px-4 text-ui-xs disabled:opacity-50 transition-colors"
                  >
                    {subLoading ? '...' : `Subscribe £${(monthlyPence / 100).toFixed(2)}/mo`}
                  </button>
                  {discount > 0 && (
                    <button
                      onClick={() => handleSubscribe('annual')}
                      disabled={subLoading}
                      className="btn-soft py-1.5 px-4 text-ui-xs disabled:opacity-50 transition-colors"
                    >
                      {subLoading ? '...' : `£${(annualPence / 100).toFixed(2)}/yr`}
                    </button>
                  )}
                </div>
              )
            })()
          )}
        </div>
      )}

      {!user && !authLoading && !isOwnProfile && (
        <div className="mb-6 -mt-6">
          <Link href="/auth?mode=login" className="text-ui-xs text-grey-400 hover:text-black transition-colors">
            Log in to follow
          </Link>
        </div>
      )}

      {/* Quote composer modal */}
      {pendingQuote && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setPendingQuote(null)}
        >
          <div className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <NoteComposer
              quoteTarget={pendingQuote}
              onPublished={() => setPendingQuote(null)}
              onClearQuote={() => setPendingQuote(null)}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-ui-sm text-grey-300">Loading activity...</div>
      ) : activity.length === 0 ? (
        <p className="text-ui-sm text-grey-400 py-10">Looks like {writer?.displayName ?? username} hasn&apos;t said anything yet.</p>
      ) : (
        <div className="space-y-3">
          {activity.map(item => {
            if (item.kind === 'article') {
              const a = item.data as DbArticle
              const articleEvent: ArticleEvent & { type: 'article' } = {
                type: 'article',
                id: a.nostrEventId,
                pubkey: writer!.pubkey,
                dTag: a.dTag,
                title: a.title,
                summary: a.summary ?? '',
                content: '',
                publishedAt: a.publishedAt ? Math.floor(new Date(a.publishedAt).getTime() / 1000) : 0,
                tags: [],
                isPaywalled: a.isPaywalled,
              }
              return <ArticleCard key={a.id} article={articleEvent} onQuote={handleQuote} voteTally={voteTallies[a.nostrEventId]} myVoteCounts={myVoteCounts[a.nostrEventId]} />
            }
            if (item.kind === 'note') {
              const n = item.data as DbNote
              const noteEvent: NoteEvent = {
                type: 'note',
                id: n.nostrEventId,
                pubkey: writer!.pubkey,
                content: n.content,
                publishedAt: Math.floor(new Date(n.publishedAt).getTime() / 1000),
                quotedEventId: n.quotedEventId,
                quotedEventKind: n.quotedEventKind,
                quotedExcerpt: n.quotedExcerpt,
                quotedTitle: n.quotedTitle,
                quotedAuthor: n.quotedAuthor,
              }
              return <NoteCard key={n.id} note={noteEvent} onDeleted={handleNoteDeleted} onQuote={handleQuote} voteTally={voteTallies[n.nostrEventId]} myVoteCounts={myVoteCounts[n.nostrEventId]} />
            }
            const r = item.data as DbReply
            return <DbReplyCard key={r.id} reply={r} writerName={writer?.displayName ?? username} isOwnProfile={isOwnProfile} onQuote={handleQuote} voteTally={voteTallies[r.nostrEventId]} myVoteCounts={myVoteCounts[r.nostrEventId]} />
          })}
        </div>
      )}
    </>
  )
}

function DbReplyCard({ reply, writerName, isOwnProfile, onQuote, voteTally, myVoteCounts }: { reply: DbReply; writerName: string; isOwnProfile: boolean; onQuote?: (target: QuoteTarget) => void; voteTally?: VoteTally; myVoteCounts?: MyVoteCount }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleted, setIsDeleted] = useState(reply.isDeleted)
  const [content, setContent] = useState(reply.content)

  const articleHref = reply.articleSlug
    ? `${reply.articleSlug}#reply-${reply.id}`
    : null
  const fullArticleHref = articleHref ? `/article/${articleHref}` : null

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    try {
      const res = await fetch(`/api/v1/replies/${reply.id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) {
        setIsDeleted(true)
        setContent('[deleted]')
      }
    } catch { /* ignore */ }
    setConfirmDelete(false)
  }

  if (isDeleted) {
    return (
      <div className="bg-white p-5 border-l-[3px] border-grey-200">
        <p className="label-ui text-grey-400 mb-2">{writerName} · Reply</p>
        <p className="text-ui-xs text-grey-300 italic">[Deleted]</p>
      </div>
    )
  }

  return (
    <div className="bg-white p-5 border-l-[3px] border-grey-200">
      <div className="flex items-center gap-2 mb-2">
        <span className="label-ui text-grey-400">{writerName} · Reply</span>
        <time className="text-ui-xs text-grey-300" dateTime={reply.publishedAt}>{formatDateFromISO(reply.publishedAt)}</time>
        {isOwnProfile && (
          <button
            onClick={handleDelete}
            className={`ml-auto text-ui-xs transition-colors ${confirmDelete ? 'text-red-500 font-medium' : 'text-grey-300 hover:text-red-500'}`}
          >
            {confirmDelete ? 'Confirm?' : 'Delete'}
          </button>
        )}
      </div>

      {reply.parentAuthorUsername && (
        <p className="text-ui-xs text-grey-300 mb-2">
          Replying to{' '}
          <Link href={`/${reply.parentAuthorUsername}`} className="text-grey-400 hover:text-black transition-colors underline underline-offset-2">
            @{reply.parentAuthorDisplayName ?? reply.parentAuthorUsername}
          </Link>
        </p>
      )}

      {fullArticleHref ? (
        <Link href={fullArticleHref} className="block hover:opacity-80 transition-opacity">
          <p className="font-serif text-sm text-black leading-relaxed" style={{ lineHeight: '1.7' }}>{content}</p>
        </Link>
      ) : (
        <p className="font-serif text-sm text-black leading-relaxed" style={{ lineHeight: '1.7' }}>{content}</p>
      )}

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        {reply.articleSlug && (
          <Link
            href={`/article/${reply.articleSlug}`}
            className="text-ui-xs text-grey-400 hover:text-black transition-colors underline underline-offset-2"
            onClick={e => e.stopPropagation()}
          >
            {reply.articleTitle ?? 'View article'}
          </Link>
        )}
        <div className="ml-auto flex items-center gap-2">
          {onQuote && (
            <button
              onClick={() => onQuote({ eventId: reply.nostrEventId, eventKind: 1111, authorPubkey: '', previewContent: content.slice(0, 200), previewAuthorName: writerName })}
              className="text-ui-xs text-grey-300 hover:text-black transition-colors"
            >
              Quote
            </button>
          )}
          <VoteControls targetEventId={reply.nostrEventId} targetKind={1111} isOwnContent={isOwnProfile} initialTally={voteTally} initialMyVotes={myVoteCounts} />
        </div>
      </div>
    </div>
  )
}
