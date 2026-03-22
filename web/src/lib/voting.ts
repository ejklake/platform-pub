// =============================================================================
// Voting — client-side price computation helper
//
// Mirrors shared/src/lib/voting.ts. Duplicated here because the shared
// package is not directly importable from Next.js.
// =============================================================================

export function voteCostPence(direction: 'up' | 'down', sequenceNumber: number): number {
  if (direction === 'up' && sequenceNumber === 1) return 0
  if (direction === 'up') return Math.round(10 * Math.pow(2, sequenceNumber - 2))
  return Math.round(10 * Math.pow(2, sequenceNumber - 1))
}

export function formatPence(pence: number): string {
  if (pence === 0) return 'Free'
  if (pence < 100) return `${pence}p`
  return `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`
}
