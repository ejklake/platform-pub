'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { PledgeDrive } from '../../lib/api'
import { useAuth } from '../../stores/auth'
import { drives } from '../../lib/api'

export function CommissionCard({ drive }: { drive: PledgeDrive }) {
  const { user } = useAuth()
  const [pledgeAmount, setPledgeAmount] = useState('')
  const [showPledge, setShowPledge] = useState(false)
  const [pledging, setPledging] = useState(false)
  const [pledgeError, setPledgeError] = useState<string | null>(null)
  const [pledged, setPledged] = useState(false)

  const progressPct = drive.targetAmountPence > 0
    ? Math.min(100, Math.round((drive.currentAmountPence / drive.targetAmountPence) * 100))
    : 0

  async function handlePledge(e: React.FormEvent) {
    e.preventDefault()
    const pence = Math.round(parseFloat(pledgeAmount) * 100)
    if (isNaN(pence) || pence < 1) { setPledgeError('Enter a valid amount.'); return }

    setPledging(true); setPledgeError(null)
    try {
      await drives.pledge(drive.id, pence)
      setPledged(true)
      setShowPledge(false)
    } catch {
      setPledgeError('Failed to pledge.')
    } finally {
      setPledging(false)
    }
  }

  return (
    <div className="bg-white border border-grey-200 px-6 py-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-crimson">
          Commission
        </span>
        <span className={`font-mono text-[12px] uppercase tracking-[0.06em] ${
          drive.status === 'funded' ? 'text-black' : 'text-grey-400'
        }`}>
          {drive.status}
        </span>
      </div>

      {/* Title and target writer */}
      <p className="font-serif text-lg font-medium text-black">{drive.title}</p>
      {drive.description && (
        <p className="text-[14px] text-grey-600 font-sans mt-1 line-clamp-3">{drive.description}</p>
      )}
      <p className="mt-2 font-mono text-[12px] text-grey-400 uppercase tracking-[0.04em]">
        For <Link href={`/${drive.writerUsername}`} className="hover:text-black transition-colors">{drive.writerUsername}</Link>
      </p>

      {/* Amount and progress */}
      <div className="mt-3 flex items-center justify-between">
        <p className="font-serif text-[22px] text-black">
          £{(drive.currentAmountPence / 100).toFixed(2)}
        </p>
        {drive.targetAmountPence > 0 && (
          <p className="font-mono text-[12px] text-grey-300 uppercase tracking-[0.06em]">
            of £{(drive.targetAmountPence / 100).toFixed(2)}
          </p>
        )}
      </div>

      {/* Progress bar */}
      {drive.targetAmountPence > 0 && (
        <div className="mt-2 h-1.5 bg-grey-100 w-full">
          <div className="h-full bg-crimson transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      <p className="mt-1 font-mono text-[12px] text-grey-300 uppercase tracking-[0.06em]">
        {drive.pledgeCount} {drive.pledgeCount === 1 ? 'pledge' : 'pledges'}
      </p>

      {/* Pledge action */}
      {user && !pledged && drive.status !== 'cancelled' && (
        <div className="mt-3">
          {!showPledge ? (
            <button
              onClick={() => setShowPledge(true)}
              className="font-mono text-[12px] uppercase tracking-[0.04em] text-grey-400 hover:text-black transition-colors"
            >
              Pledge
            </button>
          ) : (
            <form onSubmit={handlePledge} className="flex items-center gap-2">
              <span className="text-[13px] font-sans text-grey-400">£</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={pledgeAmount}
                onChange={(e) => setPledgeAmount(e.target.value)}
                placeholder="0.00"
                className="w-24 border border-grey-200 px-2 py-1 text-[13px] font-sans text-black bg-white"
                autoFocus
              />
              <button type="submit" disabled={pledging} className="btn text-sm disabled:opacity-50">
                {pledging ? '…' : 'Pledge'}
              </button>
              <button type="button" onClick={() => setShowPledge(false)} className="text-[12px] font-sans text-grey-300 hover:text-black">
                Cancel
              </button>
            </form>
          )}
          {pledgeError && <p className="mt-1 text-[12px] font-sans text-crimson">{pledgeError}</p>}
        </div>
      )}
      {pledged && (
        <p className="mt-3 font-mono text-[12px] text-grey-400">Pledged — added to your tab.</p>
      )}
    </div>
  )
}
