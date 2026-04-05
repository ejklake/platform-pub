'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="mx-auto max-w-article px-4 sm:px-6 py-20 text-center">
      <h1 className="font-serif text-2xl font-medium text-black mb-4">Something went wrong</h1>
      <p className="text-sm text-grey-400 mb-6">
        An unexpected error occurred. Please try again.
      </p>
      <button onClick={reset} className="btn py-2 px-5 text-ui-xs">
        Try again
      </button>
    </div>
  )
}
