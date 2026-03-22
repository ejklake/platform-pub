'use client'

import { useEffect, useRef, useState } from 'react'

// =============================================================================
// ShareButton
//
// On mobile / browsers that support the Web Share API, delegates to the native
// share sheet. On desktop, shows a small dropdown with three options:
//   - Copy link  → clipboard, brief "Copied!" confirmation
//   - Share on X → opens x.com/intent/tweet in a new tab
//   - Share via email → opens mailto:
// =============================================================================

interface ShareButtonProps {
  url: string
  title: string
}

export function ShareButton({ url, title }: ShareButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    // Use native share sheet if available (mobile / supported browsers)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        // User cancelled or share failed — silently ignore
      }
      return
    }

    setOpen((v) => !v)
  }

  async function copyLink(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
    setOpen(false)
  }

  function openX(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    window.open(
      `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      '_blank',
      'noopener,noreferrer'
    )
    setOpen(false)
  }

  function openEmail(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleClick}
        className="text-ui-xs text-content-muted hover:text-content-primary transition-colors"
        aria-label="Share"
      >
        {copied ? 'Copied!' : 'Share'}
      </button>

      {open && (
        <div className="absolute right-0 top-6 z-20 w-44 border border-surface-strong bg-surface shadow-lg py-1">
          <button
            onClick={copyLink}
            className="w-full text-left px-3 py-2 text-xs text-content-primary hover:bg-surface-raised transition-colors"
          >
            Copy link
          </button>
          <button
            onClick={openX}
            className="w-full text-left px-3 py-2 text-xs text-content-primary hover:bg-surface-raised transition-colors"
          >
            Share on X
          </button>
          <button
            onClick={openEmail}
            className="w-full text-left px-3 py-2 text-xs text-content-primary hover:bg-surface-raised transition-colors"
          >
            Share via email
          </button>
        </div>
      )}
    </div>
  )
}
