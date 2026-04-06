import { notFound } from 'next/navigation'
import { PublicationNav } from '../../../components/publication/PublicationNav'
import { PublicationFooter } from '../../../components/publication/PublicationFooter'

const GATEWAY = process.env.GATEWAY_INTERNAL_URL ?? process.env.GATEWAY_URL ?? 'http://localhost:3000'

async function getPublication(slug: string) {
  const res = await fetch(`${GATEWAY}/api/v1/publications/${slug}/public`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) return null
  return res.json()
}

export default async function PublicationLayout({
  params,
  children,
}: {
  params: { slug: string }
  children: React.ReactNode
}) {
  const pub = await getPublication(params.slug)
  if (!pub) return notFound()

  return (
    <div className="min-h-screen flex flex-col">
      <PublicationNav slug={pub.slug} name={pub.name} logo={pub.logo_blossom_url} />
      <main className="flex-1 mx-auto max-w-feed w-full px-4 sm:px-6 py-8">
        {children}
      </main>
      <PublicationFooter />
    </div>
  )
}
