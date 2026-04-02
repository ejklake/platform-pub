'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Generic error boundary for client component islands.
 * Catches render errors so that server-rendered content around the island
 * remains visible — critical for RESILIENCE canvas-mode pages.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="py-4 px-4 text-sm text-grey-400">
          Something went wrong loading this section.
        </div>
      )
    }
    return this.props.children
  }
}
