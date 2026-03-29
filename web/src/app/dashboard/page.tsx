'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../stores/auth'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { payment, myArticles, type WriterEarnings, type ArticleEarnings, type MyArticle } from '../../lib/api'
import { loadDrafts, deleteDraft } from '../../lib/drafts'
import { NDKEvent } from '@nostr-dev-kit/ndk'
import { getNdk, KIND_DELETION } from '../../lib/ndk'
import { signViaGateway } from '../../lib/sign'

type DashboardTab = 'articles' | 'drafts' | 'credits' | 'accounts' | 'settings'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawTab = searchParams.get('tab')
  const initialTab: DashboardTab = rawTab === 'earnings' ? 'credits' : rawTab === 'debits' ? 'accounts' : (rawTab as DashboardTab) || 'articles'
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab)
  const [hasEarnings, setHasEarnings] = useState<boolean | null>(null)

  useEffect(() => { if (!loading && !user) router.push('/auth?mode=login') }, [user, loading, router])

  // Check if user has any earnings (to conditionally show credits tab)
  useEffect(() => {
    if (!user) return
    async function checkEarnings() {
      try {
        const res = await fetch(`/api/v1/earnings/${user!.id}`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setHasEarnings(data.earningsTotalPence > 0 || data.readCount > 0)
        } else {
          setHasEarnings(false)
        }
      } catch { setHasEarnings(false) }
    }
    // Also check for subscribers
    async function checkSubscribers() {
      try {
        const res = await fetch('/api/v1/subscribers', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (data.subscribers?.length > 0) setHasEarnings(true)
        }
      } catch {}
    }
    checkEarnings()
    checkSubscribers()
  }, [user])

  function switchTab(tab: DashboardTab) {
    setActiveTab(tab)
    const url = new URL(window.location.href); url.searchParams.set('tab', tab)
    window.history.replaceState({}, '', url.toString())
  }

  if (loading || !user) return <DashboardSkeleton />

  const tabs: DashboardTab[] = hasEarnings
    ? ['articles', 'drafts', 'credits', 'accounts', 'settings']
    : ['articles', 'drafts', 'accounts', 'settings']

  return (
    <div className="mx-auto max-w-content px-6 py-10">
      <div className="flex items-center justify-between mb-10">
        <div className="flex gap-2">
          {tabs.map(tab => (
            <button key={tab} onClick={() => switchTab(tab)} className={`tab-pill ${activeTab === tab ? 'tab-pill-active' : 'tab-pill-inactive'}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
          ))}
        </div>
        <Link href="/write" className="btn">New article</Link>
      </div>
      {activeTab === 'articles' && <ArticlesTab userId={user.id} pubkey={user.pubkey} />}
      {activeTab === 'drafts' && <DraftsTab />}
      {activeTab === 'credits' && hasEarnings && <CreditsTab userId={user.id} stripeReady={user.stripeConnectKycComplete} />}
      {activeTab === 'accounts' && <AccountsTab userId={user.id} freeAllowancePence={user.freeAllowanceRemainingPence} hasCard={user.hasPaymentMethod} />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  )
}

// =============================================================================
// Articles Tab — unchanged from previous
// =============================================================================

function ArticlesTab({ userId, pubkey }: { userId: string; pubkey: string }) {
  const [articles, setArticles] = useState<MyArticle[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [deletingId, setDeletingId] = useState<string | null>(null)
  useEffect(() => { (async () => { setLoading(true); try { setArticles((await myArticles.list()).articles) } catch { setError('Failed to load articles.') } finally { setLoading(false) } })() }, [userId])
  async function handleToggleReplies(id: string, on: boolean) { try { await myArticles.update(id, { repliesEnabled: on }); setArticles(p => p.map(a => a.id === id ? { ...a, repliesEnabled: on } : a)) } catch { setError('Failed to update.') } }
  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const result = await myArticles.remove(id)
      setArticles(p => p.filter(a => a.id !== id))
      // Also publish the kind 5 deletion event from the frontend so the relay
      // removes the article from feeds even if the gateway's relay publish failed.
      try {
        const ndk = getNdk(); await ndk.connect()
        const delEvent = new NDKEvent(ndk)
        delEvent.kind = KIND_DELETION; delEvent.content = ''
        delEvent.tags = [['e', result.nostrEventId], ['a', `30023:${pubkey}:${result.dTag}`]]
        const signed = await signViaGateway(delEvent)
        await signed.publish()
      } catch { /* non-fatal — DB is already soft-deleted */ }
    }
    catch { setError('Failed to delete.') }
    finally { setDeletingId(null) }
  }

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 animate-pulse bg-card" />)}</div>
  if (error) return <div className="bg-card px-4 py-3 text-ui-xs text-content-primary">{error}</div>
  if (articles.length === 0) return <div className="py-20 text-center"><p className="text-ui-sm text-content-muted mb-4">No published articles yet.</p><Link href="/write" className="text-ui-xs text-ink underline underline-offset-4">Write your first article</Link></div>

  return (
    <div className="overflow-x-auto bg-card">
      <table className="w-full text-ui-xs">
        <thead><tr className="border-b-2 border-rule/50"><th className="px-4 py-3 text-left label-ui text-content-muted">Title</th><th className="px-4 py-3 text-left label-ui text-content-muted">Status</th><th className="px-4 py-3 text-right label-ui text-content-muted">Reads</th><th className="px-4 py-3 text-right label-ui text-content-muted">Earned</th><th className="px-4 py-3 text-center label-ui text-content-muted">Replies</th><th className="px-4 py-3 text-right label-ui text-content-muted">Actions</th></tr></thead>
        <tbody>{articles.map(a => (
          <tr key={a.id} className="border-b-2 border-rule/50 last:border-b-0">
            <td className="px-4 py-3"><Link href={`/article/${a.dTag}`} className="text-ink hover:opacity-70">{a.title}</Link></td>
            <td className="px-4 py-3">{a.isPaywalled ? <span className="text-content-primary">£{((a.pricePence??0)/100).toFixed(2)}</span> : <span className="text-content-muted">Free</span>}</td>
            <td className="px-4 py-3 text-right tabular-nums">{a.readCount}</td>
            <td className="px-4 py-3 text-right text-ink tabular-nums">£{(a.netEarningsPence/100).toFixed(2)}</td>
            <td className="px-4 py-3 text-center"><button onClick={() => handleToggleReplies(a.id, !a.repliesEnabled)} className={`text-ui-xs ${a.repliesEnabled ? 'text-accent' : 'text-content-faint'}`}>{a.repliesEnabled ? 'On' : 'Off'}</button></td>
            <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-3"><Link href={`/write?edit=${a.nostrEventId}`} className="text-content-muted hover:text-ink">Edit</Link><button onClick={() => handleDelete(a.id)} disabled={deletingId===a.id} className="text-content-faint hover:text-ink disabled:opacity-50">{deletingId===a.id ? '...' : 'Delete'}</button></div></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

// =============================================================================
// Drafts Tab — unchanged
// =============================================================================

function DraftsTab() {
  const [drafts, setDrafts] = useState<any[]>([]); const [loading, setLoading] = useState(true)
  useEffect(() => { (async () => { setLoading(true); try { setDrafts(await loadDrafts()) } catch {} finally { setLoading(false) } })() }, [])
  async function handleDelete(id: string) { try { await deleteDraft(id); setDrafts(p => p.filter((d:any) => d.draftId !== id)) } catch {} }
  if (loading) return <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-8 animate-pulse bg-card" />)}</div>
  if (drafts.length === 0) return <div className="py-20 text-center"><p className="text-ui-sm text-content-muted mb-4">No saved drafts.</p><Link href="/write" className="text-ui-xs text-ink underline underline-offset-4">Start writing</Link></div>
  return <div className="space-y-2">{drafts.map((d:any) => <div key={d.draftId} className="flex items-center justify-between bg-card px-4 py-3"><div><p className="text-ui-sm text-ink">{d.title||'Untitled'}</p><p className="text-ui-xs text-content-faint mt-0.5">Last saved {new Date(d.autoSavedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p></div><div className="flex items-center gap-4"><Link href={`/write?draft=${d.draftId}`} className="text-ui-xs text-content-primary hover:text-ink">Continue</Link><button onClick={() => handleDelete(d.draftId)} className="text-ui-xs text-content-faint hover:text-ink">Delete</button></div></div>)}</div>
}

// =============================================================================
// Credits Tab — itemised chronological log + subscribers + value flagging
// =============================================================================

interface SubscriberInfo {
  subscriptionId: string
  readerUsername: string
  readerDisplayName: string | null
  pricePence: number
  status: string
  articlesRead: number
  totalArticleValuePence: number
  gettingMoneysworth: boolean
  startedAt: string
}

interface CreditEvent {
  type: 'read' | 'subscription'
  date: string
  description: string
  amountPence: number
  readerName?: string
  articleTitle?: string
}

function CreditsTab({ userId, stripeReady }: { userId: string; stripeReady: boolean }) {
  const [earnings, setEarnings] = useState<WriterEarnings | null>(null)
  const [articleEarnings, setArticleEarnings] = useState<ArticleEarnings[]>([])
  const [subscribers, setSubscribers] = useState<SubscriberInfo[]>([])
  const [subEvents, setSubEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const [earningsRes, perArticleRes, subscribersRes, subEventsRes] = await Promise.all([
          payment.getEarnings(userId),
          payment.getPerArticleEarnings(userId),
          fetch('/api/v1/subscribers', { credentials: 'include' }).then(r => r.ok ? r.json() : { subscribers: [] }),
          fetch(`/api/v1/subscription-events?role=writer&limit=50`, { credentials: 'include' }).then(r => r.ok ? r.json() : { events: [] }).catch(() => ({ events: [] })),
        ])
        setEarnings(earningsRes)
        setArticleEarnings(perArticleRes.articles)
        setSubscribers(subscribersRes.subscribers ?? [])
        setSubEvents(subEventsRes.events ?? [])
      } catch { setError('Failed to load earnings data.') }
      finally { setLoading(false) }
    })()
  }, [userId])

  // Net balance calculation
  const totalCredits = (earnings?.earningsTotalPence ?? 0) + subscribers.reduce((s, sub) => s + (sub.status === 'active' ? sub.pricePence : 0), 0)
  const activeSubscribers = subscribers.filter(s => s.status === 'active')

  if (error) return <div className="bg-card px-4 py-3 text-ui-xs text-content-primary">{error}</div>

  return (
    <div>
      {/* Connect Stripe prompt */}
      {!stripeReady && earnings && earnings.earningsTotalPence > 0 && (
        <div className="mb-10 bg-surface-deep border-l-[3px] border-accent px-6 py-4">
          <p className="text-ui-sm text-content-primary">You've earned £{(earnings.earningsTotalPence/100).toFixed(2)} from {earnings.readCount} paid reads. Connect your bank to get paid.</p>
          <a href="/settings" className="mt-2 inline-block text-ui-xs text-accent-dark underline underline-offset-4">Connect Stripe</a>
        </div>
      )}

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-14">{[1,2,3].map(i => <div key={i} className="bg-card p-6"><div className="h-3 w-20 animate-pulse bg-surface-deep mb-3"/><div className="h-7 w-28 animate-pulse bg-surface-deep"/></div>)}</div>
      ) : earnings ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 mb-14">
          <Card label="Total earned" pence={earnings.earningsTotalPence} sub={`${earnings.readCount} paid reads`} primary />
          <Card label="Pending" pence={earnings.pendingTransferPence} sub="Awaiting threshold" />
          <Card label="Paid out" pence={earnings.paidOutPence} sub="To your bank" />
          <Card label="Subscribers" pence={activeSubscribers.reduce((s, sub) => s + sub.pricePence, 0)} sub={`${activeSubscribers.length} active`} accent />
        </div>
      ) : null}

      {/* Subscribers section */}
      {subscribers.length > 0 && (
        <div className="mb-14">
          <p className="label-ui text-content-muted mb-4">Subscribers</p>
          <div className="overflow-x-auto bg-card">
            <table className="w-full text-ui-xs">
              <thead><tr className="border-b-2 border-rule/50">
                <th className="px-4 py-3 text-left label-ui text-content-muted">Reader</th>
                <th className="px-4 py-3 text-right label-ui text-content-muted">Pays</th>
                <th className="px-4 py-3 text-right label-ui text-content-muted">Articles read</th>
                <th className="px-4 py-3 text-right label-ui text-content-muted">Article value</th>
                <th className="px-4 py-3 text-center label-ui text-content-muted">Value</th>
                <th className="px-4 py-3 text-left label-ui text-content-muted">Status</th>
              </tr></thead>
              <tbody>{subscribers.map(s => (
                <tr key={s.subscriptionId} className="border-b-2 border-rule/50 last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/${s.readerUsername}`} className="text-ink hover:opacity-70">{s.readerDisplayName ?? s.readerUsername}</Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">£{(s.pricePence/100).toFixed(2)}/mo</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.articlesRead}</td>
                  <td className="px-4 py-3 text-right tabular-nums">£{(s.totalArticleValuePence/100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    {s.gettingMoneysworth ? (
                      <span className="text-accent text-ui-xs font-medium" title="Reading more than they pay — getting their money's worth">Good value</span>
                    ) : (
                      <span className="text-amber-600 text-ui-xs" title="Reading less than subscription cost — may cancel">At risk</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-ui-xs ${s.status === 'active' ? 'text-accent font-medium' : 'text-content-faint'}`}>
                      {s.status === 'active' ? 'Active' : 'Cancelled'}
                    </span>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* How credits work */}
      <div className="bg-card p-6 mb-12">
        <p className="label-ui text-content-muted mb-3">How credits work</p>
        <div className="space-y-2 text-ui-xs text-content-secondary leading-relaxed">
          <p>All figures shown after the 8% platform fee. Per-article reads and subscription income are netted against your own reading debits. Payouts trigger monthly when your net balance clears the threshold.</p>
          <p>Subscriber reads are logged at zero cost but tracked — you can see which subscribers are getting their money's worth and which may be at risk of cancelling.</p>
        </div>
      </div>

      {/* Per-article revenue */}
      <p className="label-ui text-content-muted mb-4">Per-article revenue</p>
      {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-8 animate-pulse bg-card"/>)}</div>
      : articleEarnings.length === 0 ? <p className="text-ui-xs text-content-faint">No settled revenue yet.</p>
      : <div className="overflow-x-auto bg-card"><table className="w-full text-ui-xs"><thead><tr className="border-b-2 border-rule/50"><th className="px-4 py-3 text-left label-ui text-content-muted">Article</th><th className="px-4 py-3 text-right label-ui text-content-muted">Reads</th><th className="px-4 py-3 text-right label-ui text-content-muted">Earned</th><th className="px-4 py-3 text-right label-ui text-content-muted">Pending</th><th className="px-4 py-3 text-right label-ui text-content-muted">Paid</th></tr></thead><tbody>{articleEarnings.map(a => <tr key={a.articleId} className="border-b-2 border-rule/50 last:border-b-0"><td className="px-4 py-3"><a href={`/article/${a.dTag}`} className="text-ink hover:opacity-70">{a.title}</a></td><td className="px-4 py-3 text-right tabular-nums">{a.readCount}</td><td className="px-4 py-3 text-right text-ink tabular-nums">£{(a.netEarningsPence/100).toFixed(2)}</td><td className="px-4 py-3 text-right text-content-faint tabular-nums">£{(a.pendingPence/100).toFixed(2)}</td><td className="px-4 py-3 text-right text-content-faint tabular-nums">£{(a.paidPence/100).toFixed(2)}</td></tr>)}</tbody></table></div>}
    </div>
  )
}

// =============================================================================
// Accounts Tab — unified incomings & outgoings with running balance
// =============================================================================

type StatementFilter = 'all' | 'credits' | 'debits'

interface StatementEntry {
  id: string
  date: string
  type: 'credit' | 'debit' | 'settlement'
  category: string
  description: string
  amount_pence: number
  link: string | null
}

interface StatementSummary {
  creditsTotalPence: number
  debitsTotalPence: number
  balancePence: number
  lastSettledAt: string | null
}

const PAGE_SIZE = 30

const CATEGORY_LABELS: Record<string, string> = {
  free_allowance: 'Free credit',
  article_read: 'Paywall',
  article_earning: 'Article read',
  subscription_charge: 'Subscription',
  subscription_earning: 'Subscriber',
  vote_charge: 'Vote',
  vote_earning: 'Vote income',
  settlement: 'Settlement',
}

function AccountsTab({ userId, freeAllowancePence, hasCard }: { userId: string; freeAllowancePence: number; hasCard: boolean }) {
  const [summary, setSummary] = useState<StatementSummary | null>(null)
  const [entries, setEntries] = useState<StatementEntry[]>([])
  const [totalEntries, setTotalEntries] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [filter, setFilter] = useState<StatementFilter>('all')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchStatement(f: StatementFilter, offset: number, append: boolean) {
    const isInitial = offset === 0 && !append
    if (isInitial) setLoading(true)
    else setLoadingMore(true)
    try {
      const res = await fetch(
        `/api/v1/my/account-statement?filter=${f}&limit=${PAGE_SIZE}&offset=${offset}`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setSummary(data.summary)
      setEntries(prev => append ? [...prev, ...data.entries] : data.entries)
      setTotalEntries(data.totalEntries)
      setHasMore(data.hasMore)
    } catch { setError('Failed to load account data.') }
    finally { setLoading(false); setLoadingMore(false) }
  }

  useEffect(() => { fetchStatement(filter, 0, false) }, [userId, filter])

  function handleFilterChange(f: StatementFilter) {
    if (f === filter) return
    setFilter(f)
  }

  function handleLoadMore() {
    fetchStatement(filter, entries.length, true)
  }

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 animate-pulse bg-card" />)}</div>
  }

  const creditsPence = summary?.creditsTotalPence ?? 0
  const debitsPence = summary?.debitsTotalPence ?? 0
  const balancePence = summary?.balancePence ?? 0

  return (
    <div>
      {/* Summary tiles — clickable to filter */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-10">
        <button onClick={() => handleFilterChange('credits')} className="text-left">
          <div className={`p-6 transition-shadow ${filter === 'credits' ? 'bg-ink ring-2 ring-content-secondary' : 'bg-ink'}`}>
            <p className="label-ui mb-2 text-content-faint">Credits</p>
            <p className="font-serif text-2xl font-light text-surface">£{(creditsPence/100).toFixed(2)}</p>
            <p className="mt-1 text-ui-xs text-content-faint">All income{summary?.lastSettledAt ? ' since last settlement' : ''}</p>
          </div>
        </button>
        <button onClick={() => handleFilterChange('debits')} className="text-left">
          <div className={`p-6 bg-surface-deep transition-shadow ${filter === 'debits' ? 'ring-2 ring-accent' : ''}`}>
            <p className="label-ui mb-2 text-accent-dark">Debits</p>
            <p className="font-serif text-2xl font-light text-accent-dark">£{(debitsPence/100).toFixed(2)}</p>
            <p className="mt-1 text-ui-xs text-accent">All outgoings{summary?.lastSettledAt ? ' since last settlement' : ''}</p>
          </div>
        </button>
        <button onClick={() => handleFilterChange('all')} className="text-left">
          <div className={`p-6 bg-card transition-shadow ${filter === 'all' ? 'ring-2 ring-content-secondary' : ''}`}>
            <p className="label-ui mb-2 text-content-muted">Balance</p>
            <p className={`font-serif text-2xl font-light ${balancePence >= 0 ? 'text-ink' : 'text-accent'}`}>
              {balancePence < 0 ? '−' : ''}£{(Math.abs(balancePence)/100).toFixed(2)}
            </p>
            <p className="mt-1 text-ui-xs text-content-faint">
              {balancePence >= 0 ? 'In credit' : 'Outstanding'}
            </p>
          </div>
        </button>
      </div>

      {error && <div className="bg-card px-4 py-3 text-ui-xs text-content-primary mb-8">{error}</div>}

      {!hasCard && freeAllowancePence <= 0 && (
        <div className="mb-8 bg-surface-deep border-l-[3px] border-accent px-6 py-4">
          <p className="text-ui-xs text-content-primary">Free allowance used. <a href="/settings" className="underline underline-offset-4 text-accent-dark">Add a card</a> to keep reading.</p>
        </div>
      )}

      {/* Account statement */}
      {entries.length > 0 ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="label-ui text-content-muted">
              {filter === 'credits' ? 'Income' : filter === 'debits' ? 'Outgoings' : 'Account statement'}
            </p>
            {filter !== 'all' && (
              <button onClick={() => handleFilterChange('all')} className="text-ui-xs text-content-faint hover:text-ink underline underline-offset-4">
                Show all
              </button>
            )}
          </div>
          <div className="overflow-x-auto bg-card">
            <table className="w-full text-ui-xs">
              <thead>
                <tr className="border-b-2 border-rule/50">
                  <th className="px-4 py-3 text-left label-ui text-content-muted">Date</th>
                  <th className="px-4 py-3 text-left label-ui text-content-muted">Type</th>
                  <th className="px-4 py-3 text-left label-ui text-content-muted">Description</th>
                  <th className="px-4 py-3 text-right label-ui text-content-muted">Amount</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.id} className="border-b-2 border-rule/50 last:border-b-0">
                    <td className="px-4 py-3 text-content-faint whitespace-nowrap">
                      {new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-ui-xs ${entry.type === 'credit' ? 'text-ink' : entry.type === 'settlement' ? 'text-content-muted' : 'text-accent-dark'}`}>
                        {CATEGORY_LABELS[entry.category] ?? entry.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.link ? (
                        <Link href={entry.link} className="text-ink hover:opacity-70">{entry.description}</Link>
                      ) : (
                        <span className="text-ink">{entry.description}</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${
                      entry.type === 'credit' ? 'text-ink'
                      : entry.type === 'settlement' ? 'text-content-muted'
                      : 'text-accent'
                    }`}>
                      {entry.type === 'credit' ? '+' : entry.type === 'settlement' ? '−' : '−'}£{(Math.abs(entry.amount_pence)/100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="text-ui-xs text-ink underline underline-offset-4 hover:opacity-70 disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : `Show more (${totalEntries - entries.length} remaining)`}
              </button>
            </div>
          )}
        </>
      ) : !error && (
        <div className="py-20 text-center">
          <p className="text-ui-sm text-content-muted mb-4">No transactions yet.</p>
          <Link href="/feed" className="text-ui-xs text-ink underline underline-offset-4">Browse the feed</Link>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Settings Tab — embeds the settings page
// =============================================================================

function SettingsTab() {
  const router = useRouter()
  useEffect(() => { router.push('/settings') }, [router])
  return (
    <div className="py-20 text-center">
      <p className="text-ui-sm text-content-muted">Redirecting to settings…</p>
    </div>
  )
}

// =============================================================================
// Shared Card Component
// =============================================================================

function Card({ label, pence, sub, primary=false, accent=false }: { label: string; pence: number; sub: string; primary?: boolean; accent?: boolean }) {
  const bg = primary ? 'bg-ink' : accent ? 'bg-surface-deep' : 'bg-card'
  const labelColor = primary ? 'text-content-faint' : accent ? 'text-accent-dark' : 'text-content-muted'
  const valueColor = primary ? 'text-surface' : accent ? 'text-accent-dark' : 'text-ink'
  const subColor = primary ? 'text-content-faint' : accent ? 'text-accent' : 'text-content-faint'

  return (
    <div className={`p-6 ${bg}`}>
      <p className={`label-ui mb-2 ${labelColor}`}>{label}</p>
      <p className={`font-serif text-2xl font-light ${valueColor}`}>£{(pence/100).toFixed(2)}</p>
      <p className={`mt-1 text-ui-xs ${subColor}`}>{sub}</p>
    </div>
  )
}

function DashboardSkeleton() {
  return <div className="mx-auto max-w-content px-6 py-10"><div className="flex gap-2 mb-10">{[1,2,3,4].map(i => <div key={i} className="h-9 w-24 animate-pulse bg-card"/>)}</div><div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[1,2,3].map(i => <div key={i} className="bg-card p-6"><div className="h-3 w-20 animate-pulse bg-surface-deep mb-3"/><div className="h-7 w-28 animate-pulse bg-surface-deep"/></div>)}</div></div>
}
