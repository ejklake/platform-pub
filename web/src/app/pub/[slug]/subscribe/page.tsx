import { notFound } from 'next/navigation'

const GATEWAY = process.env.GATEWAY_INTERNAL_URL ?? process.env.GATEWAY_URL ?? 'http://localhost:3000'

async function getPublication(slug: string) {
  const res = await fetch(`${GATEWAY}/api/v1/publications/${slug}/public`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) return null
  return res.json()
}

function formatPrice(pence: number): string {
  return `\u00a3${(pence / 100).toFixed(2)}`
}

export default async function SubscribePage({ params }: { params: { slug: string } }) {
  const pub = await getPublication(params.slug)
  if (!pub) return notFound()

  const monthlyPrice = pub.subscription_price_pence
  const annualDiscount = pub.annual_discount_pct ?? 0
  const annualMonthly = Math.round(monthlyPrice * (1 - annualDiscount / 100))

  return (
    <div className="max-w-sm mx-auto text-center py-12">
      <h1 className="font-serif text-3xl mb-2">Subscribe to {pub.name}</h1>
      {pub.tagline && <p className="text-grey-500 text-sm mb-8">{pub.tagline}</p>}

      <div className="space-y-4">
        <div className="border border-grey-200 rounded p-6">
          <p className="text-ui-xs text-grey-400 mb-1">Monthly</p>
          <p className="text-2xl font-medium">{formatPrice(monthlyPrice)}<span className="text-sm text-grey-400">/mo</span></p>
        </div>

        {annualDiscount > 0 && (
          <div className="border border-grey-200 rounded p-6">
            <p className="text-ui-xs text-grey-400 mb-1">Annual ({annualDiscount}% off)</p>
            <p className="text-2xl font-medium">{formatPrice(annualMonthly)}<span className="text-sm text-grey-400">/mo</span></p>
          </div>
        )}
      </div>

      <p className="text-ui-xs text-grey-400 mt-6">
        Full access to all articles. Cancel any time.
      </p>
    </div>
  )
}
