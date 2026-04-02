'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '../../stores/auth'
import { NoteComposer } from '../feed/NoteComposer'
import { WorkTab } from './WorkTab'
import { SocialTab } from './SocialTab'
import { FollowersTab } from './FollowersTab'
import { FollowingTab } from './FollowingTab'
import type { WriterProfile } from '../../lib/api'
import type { QuoteTarget } from '../../lib/publishNote'

type ProfileTab = 'work' | 'social' | 'followers' | 'following'

const TABS: ProfileTab[] = ['work', 'social', 'followers', 'following']

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
  const searchParams = useSearchParams()
  const rawTab = searchParams.get('tab')
  const initialTab: ProfileTab = (rawTab && TABS.includes(rawTab as ProfileTab)) ? rawTab as ProfileTab : 'work'

  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab)
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null)
  const [subLoading, setSubLoading] = useState(false)
  const [pendingQuote, setPendingQuote] = useState<QuoteTarget | null>(null)

  // Sync tab from URL changes
  useEffect(() => {
    if (rawTab && TABS.includes(rawTab as ProfileTab)) {
      setActiveTab(rawTab as ProfileTab)
    }
  }, [rawTab])

  function switchTab(tab: ProfileTab) {
    setActiveTab(tab)
    const url = new URL(window.location.href)
    if (tab === 'work') {
      url.searchParams.delete('tab')
    } else {
      url.searchParams.set('tab', tab)
    }
    window.history.replaceState({}, '', url.toString())
  }

  // Check follow/subscription status
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

  const handleQuote = useCallback((target: QuoteTarget) => {
    setPendingQuote(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const isOwnProfile = user?.username === username

  // Check if writer has paywalled articles (for showing subscription UI)
  // We show the sub button if the writer has a subscription price set
  const hasPaywall = writer.subscriptionPricePence > 0

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

          {hasPaywall && subStatus && !subStatus.ownContent && (
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

      {/* Tab navigation */}
      <div className="flex gap-2 mb-8">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => switchTab(tab)}
            className={`tab-pill ${activeTab === tab ? 'tab-pill-active' : 'tab-pill-inactive'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'work' && (
        <WorkTab
          username={username}
          writer={writer}
          isOwnProfile={isOwnProfile}
          onQuote={handleQuote}
        />
      )}
      {activeTab === 'social' && (
        <SocialTab
          username={username}
          writer={writer}
          isOwnProfile={isOwnProfile}
          onQuote={handleQuote}
        />
      )}
      {activeTab === 'followers' && (
        <FollowersTab username={username} />
      )}
      {activeTab === 'following' && (
        <FollowingTab username={username} />
      )}
    </>
  )
}
