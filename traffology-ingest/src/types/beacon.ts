import { z } from 'zod'

export const BeaconPayloadSchema = z.object({
  // Required on every beacon
  sessionToken: z.string().uuid(),
  articleId: z.string().uuid(),
  type: z.enum(['init', 'heartbeat', 'unload']),
  timestamp: z.number(),

  // Init-only fields (sent on first beacon)
  referrerUrl: z.string().max(2048).optional(),
  utmSource: z.string().max(255).optional(),
  utmMedium: z.string().max(255).optional(),
  utmCampaign: z.string().max(255).optional(),
  screenWidth: z.number().int().optional(),
  subscriberStatus: z.enum(['anonymous', 'free', 'paying']).optional(),

  // Updated on every beacon
  scrollDepth: z.number().min(0).max(1).optional(),
  readingTimeSeconds: z.number().int().min(0).optional(),
})

export type BeaconPayload = z.infer<typeof BeaconPayloadSchema>
