// =============================================================================
// Voting — price computation helper
//
// Used by both the gateway (server-side pricing) and the web frontend
// (client-side pricing for the confirm modal). Keep this file free of any
// Node.js / browser-only imports so it can run in either environment.
// =============================================================================

/**
 * Compute the cost in pence for the nth vote in a given direction.
 *
 * Upvotes:
 *   1st: free (0p)
 *   2nd: 10p
 *   3rd: 20p
 *   nth (n ≥ 2): 10 × 2^(n-2) pence
 *
 * Downvotes:
 *   1st: 10p
 *   2nd: 20p
 *   nth: 10 × 2^(n-1) pence
 */
export function voteCostPence(direction: 'up' | 'down', sequenceNumber: number): number {
  if (direction === 'up' && sequenceNumber === 1) return 0
  if (direction === 'up') return Math.round(10 * Math.pow(2, sequenceNumber - 2))
  return Math.round(10 * Math.pow(2, sequenceNumber - 1))
}
