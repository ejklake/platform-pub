'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Avatar } from '../ui/Avatar'
import { formatDateFromISO } from '../../lib/format'

interface Following {
  id: string
  username: string
  displayName: string | null
  avatar: string | null
  followedAt: string
}

interface PublicSubscription {
  writerId: string
  writerUsername: string
  writerDisplayName: string | null
  writerAvatar: string | null
  startedAt: string
}

export function FollowingTab({ username }: { username: string }) {
  const [following, setFollowing] = useState<Following[]>([])
  const [total, setTotal] = useState(0)
  const [subscriptions, setSubscriptions] = useState<PublicSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [followRes, subRes] = await Promise.all([
          fetch(`/api/v1/writers/${username}/following?limit=30`, { credentials: 'include' }),
          fetch(`/api/v1/writers/${username}/subscriptions?limit=50`, { credentials: 'include' }),
        ])
        if (followRes.ok) {
          const data = await followRes.json()
          setFollowing(data.following ?? [])
          setTotal(data.total ?? 0)
        }
        if (subRes.ok) {
          const data = await subRes.json()
          setSubscriptions(data.subscriptions ?? [])
        }
      } catch { /* silently fail */ }
      finally { setLoading(false) }
    }
    load()
  }, [username])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/v1/writers/${username}/following?limit=30&offset=${following.length}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setFollowing(prev => [...prev, ...(data.following ?? [])])
      }
    } catch { /* silently fail */ }
    finally { setLoadingMore(false) }
  }

  if (loading) {
    return <div className="py-10 text-center text-ui-sm text-grey-300">Loading...</div>
  }

  return (
    <div>
      {/* Following list */}
      {following.length === 0 ? (
        <p className="text-ui-sm text-grey-400 py-10">Not following anyone yet.</p>
      ) : (
        <div className="space-y-1">
          {following.map(f => (
            <Link
              key={f.id}
              href={`/${f.username}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-grey-100 transition-colors"
            >
              <Avatar src={f.avatar} name={f.displayName ?? f.username} size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-sans text-black truncate">
                  {f.displayName ?? f.username}
                </p>
                <p className="text-ui-xs text-grey-300">@{f.username}</p>
              </div>
              <time className="text-ui-xs text-grey-300 flex-shrink-0">
                {formatDateFromISO(f.followedAt)}
              </time>
            </Link>
          ))}
        </div>
      )}

      {following.length < total && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-soft py-1.5 px-4 text-ui-xs disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : `Load more (${total - following.length} remaining)`}
          </button>
        </div>
      )}

      {/* Subscriptions section */}
      {subscriptions.length > 0 && (
        <>
          <div className="rule-inset my-8" />
          <h3 className="font-mono text-[12px] uppercase tracking-[0.06em] text-grey-300 mb-4">
            Subscribes to
          </h3>
          <div className="space-y-1">
            {subscriptions.map(s => (
              <Link
                key={s.writerId}
                href={`/${s.writerUsername}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-grey-100 transition-colors"
              >
                <Avatar src={s.writerAvatar} name={s.writerDisplayName ?? s.writerUsername} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-sans text-black truncate">
                    {s.writerDisplayName ?? s.writerUsername}
                  </p>
                  <p className="text-ui-xs text-grey-300">@{s.writerUsername}</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
