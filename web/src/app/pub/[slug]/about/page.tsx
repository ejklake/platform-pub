import { notFound } from 'next/navigation'
import { renderMarkdown } from '../../../../lib/markdown'

const GATEWAY = process.env.GATEWAY_INTERNAL_URL ?? process.env.GATEWAY_URL ?? 'http://localhost:3000'

async function getPublication(slug: string) {
  const res = await fetch(`${GATEWAY}/api/v1/publications/${slug}/public`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) return null
  return res.json()
}

export default async function AboutPage({ params }: { params: { slug: string } }) {
  const pub = await getPublication(params.slug)
  if (!pub) return notFound()

  const aboutHtml = pub.about ? await renderMarkdown(pub.about) : null

  return (
    <div className="max-w-article mx-auto">
      <h1 className="font-serif text-3xl mb-6">About {pub.name}</h1>
      {aboutHtml ? (
        <div
          className="prose prose-sm"
          dangerouslySetInnerHTML={{ __html: aboutHtml }}
        />
      ) : (
        <p className="text-grey-400 text-sm">No about page yet.</p>
      )}
    </div>
  )
}
