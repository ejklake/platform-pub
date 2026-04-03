'use client'

import { useState, useEffect } from 'react'
import { freePasses, giftLinks, type FreePass, type GiftLink } from '../../lib/api'
import { UserSearch, type UserSearchResult } from '../ui/UserSearch'

export function FreePassManager({ articleId }: { articleId: string }) {
  const [passes, setPasses] = useState<FreePass[]>([])
  const [links, setLinks] = useState<GiftLink[]>([])
  const [loading, setLoading] = useState(true)
  const [granting, setGranting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchData() {
    setLoading(true)
    try {
      const [passData, linkData] = await Promise.all([
        freePasses.list(articleId),
        giftLinks.list(articleId),
      ])
      setPasses(passData.passes)
      setLinks(linkData.giftLinks)
    } catch {
      setError('Failed to load data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [articleId])

  async function handleGrant(user: UserSearchResult) {
    setGranting(true); setError(null)
    try {
      await freePasses.grant(articleId, user.id)
      fetchData()
    } catch {
      setError('Failed to grant access.')
    } finally {
      setGranting(false)
    }
  }

  async function handleRevoke(userId: string) {
    try {
      await freePasses.revoke(articleId, userId)
      setPasses(prev => prev.filter(p => p.userId !== userId))
    } catch {
      setError('Failed to revoke access.')
    }
  }

  async function handleRevokeLink(linkId: string) {
    try {
      await giftLinks.revoke(articleId, linkId)
      setLinks(prev => prev.map(l => l.id === linkId ? { ...l, revoked: true } : l))
    } catch {
      setError('Failed to revoke gift link.')
    }
  }

  return (
    <div className="border-t border-grey-200 px-4 py-4 bg-grey-100/50">
      <p className="label-ui text-grey-400 mb-3">Free passes</p>

      {error && <p className="text-[13px] font-sans text-crimson mb-3">{error}</p>}

      {/* Grant form */}
      <div className="flex items-center gap-2 mb-4">
        <UserSearch
          onSelect={handleGrant}
          placeholder="Search users to grant access…"
          className="flex-1"
        />
        {granting && <span className="text-[12px] font-mono text-grey-400">Granting…</span>}
      </div>

      {/* Existing passes */}
      {loading ? (
        <div className="h-6 animate-pulse bg-grey-200 w-32" />
      ) : passes.length === 0 ? (
        <p className="text-[13px] font-sans text-grey-300">No free passes granted.</p>
      ) : (
        <div className="space-y-1">
          {passes.map(p => (
            <div key={p.userId} className="flex items-center justify-between py-1.5">
              <div>
                <span className="text-[13px] font-sans text-black">{p.displayName ?? p.username}</span>
                <span className="text-[12px] font-mono text-grey-300 ml-2">@{p.username}</span>
              </div>
              <button onClick={() => handleRevoke(p.userId)} className="text-[12px] font-sans text-grey-300 hover:text-black">
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Gift links */}
      {!loading && links.length > 0 && (
        <div className="mt-4 pt-4 border-t border-grey-200">
          <p className="label-ui text-grey-400 mb-2">Gift links</p>
          <div className="space-y-1">
            {links.map(l => (
              <div key={l.id} className="flex items-center justify-between py-1.5">
                <div>
                  <span className="text-[12px] font-mono text-grey-400">
                    {l.redemptionCount} of {l.maxRedemptions} used
                  </span>
                  {l.revoked && <span className="text-[11px] font-mono text-crimson ml-2">revoked</span>}
                </div>
                {!l.revoked && (
                  <button onClick={() => handleRevokeLink(l.id)} className="text-[12px] font-sans text-grey-300 hover:text-black">
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
