'use client'

import type { PledgeDrive } from '../../lib/api'
import { formatDateFromISO } from '../../lib/format'

export function ProfileDriveCard({ drive }: { drive: PledgeDrive }) {
  const progressPct = drive.targetAmountPence > 0
    ? Math.min(100, Math.round((drive.currentAmountPence / drive.targetAmountPence) * 100))
    : 0

  return (
    <div className="bg-white px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-grey-300">
              Pledge drive
            </span>
            {drive.pinnedOnProfile && (
              <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-crimson">Pinned</span>
            )}
            <span className={`font-mono text-[12px] uppercase tracking-[0.06em] ${
              drive.status === 'funded' ? 'text-black' : drive.status === 'cancelled' ? 'text-grey-300' : 'text-grey-400'
            }`}>
              {drive.status}
            </span>
          </div>
          <p className="font-serif text-lg font-medium text-black">{drive.title}</p>
          {drive.description && (
            <p className="text-[14px] text-grey-600 font-sans mt-1 line-clamp-2">{drive.description}</p>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <p className="font-serif text-lg text-black">
            £{(drive.currentAmountPence / 100).toFixed(2)}
          </p>
          <p className="font-mono text-[12px] text-grey-300 uppercase tracking-[0.06em]">
            of £{(drive.targetAmountPence / 100).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 bg-grey-100 w-full">
        <div
          className="h-full bg-crimson transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <p className="font-mono text-[12px] text-grey-300 uppercase tracking-[0.06em]">
          {progressPct}% · {drive.pledgeCount} {drive.pledgeCount === 1 ? 'pledge' : 'pledges'}
        </p>
        <time className="font-mono text-[12px] text-grey-300 uppercase tracking-[0.06em]">
          {formatDateFromISO(drive.createdAt)}
        </time>
      </div>
    </div>
  )
}
