'use client'
import { useState } from 'react'
import { LoadingScreen } from './LoadingScreen'

interface Props {
  children: React.ReactNode
}

export function LandingWrapper({ children }: Props) {
  const [showContent, setShowContent] = useState(false)

  const contentStyle: React.CSSProperties = {
    opacity: showContent ? 1 : 0,
    transform: showContent ? 'translateY(0)' : 'translateY(14px)',
    transition: showContent
      ? 'opacity 600ms ease-out, transform 600ms ease-out'
      : 'none',
  }

  return (
    <>
      <LoadingScreen onComplete={() => setShowContent(true)} />
      <div style={contentStyle}>
        {children}
      </div>
    </>
  )
}
