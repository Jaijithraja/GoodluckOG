'use client'
import { useState, useEffect, useRef } from 'react'
import { LoadingScreen } from './LoadingScreen'
import { useLoadingStore } from '@/store/loading'

interface Props {
  children: React.ReactNode
}

export function LandingWrapper({ children }: Props) {
  const [showContent, setShowContent] = useState(false)
  const { play, phase, playing } = useLoadingStore()
  const isFirstMount = useRef(true)

  useEffect(() => {
    if (phase === 'done' && !playing) {
      play()
    } else if (phase === 'out' || phase === 'done') {
      setShowContent(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (phase === 'out' || phase === 'done') {
      if (!isFirstMount.current) {
        setShowContent(true)
      }
    }
    isFirstMount.current = false
  }, [phase])

  const contentStyle: React.CSSProperties = {
    opacity: showContent ? 1 : 0,
    transform: showContent ? 'translateY(0)' : 'translateY(14px)',
    transition: showContent
      ? 'opacity 800ms ease-out, transform 800ms ease-out'
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
