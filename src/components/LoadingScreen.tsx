'use client'
import { useEffect } from 'react'
import { useLoadingStore } from '@/store/loading'

interface Props {
  onComplete?: () => void
}

export function LoadingScreen({ onComplete }: Props) {
  const { phase } = useLoadingStore()

  useEffect(() => {
    if (phase === 'done') {
      onComplete?.()
    }
  }, [phase, onComplete])

  if (phase === 'done') return null

  const logoStyle: React.CSSProperties = {
    width: 120,
    height: 120,
    objectFit: 'contain',

    opacity: phase === 'hidden' ? 0
      : phase === 'zoom' || phase === 'out' ? 0
      : 1,

    transform: phase === 'hidden' ? 'scale(0.8) translateY(8px)'
      : phase === 'zoom' || phase === 'out' ? 'scale(14)'
      : 'scale(1) translateY(0)',

    filter: phase === 'glow'
      ? 'drop-shadow(0 0 18px #ADFF2F) drop-shadow(0 0 48px #ADFF2F99) drop-shadow(0 0 90px #ADFF2F44)'
      : phase === 'zoom'
      ? 'drop-shadow(0 0 32px #ADFF2F) drop-shadow(0 0 80px #ADFF2F)'
      : 'drop-shadow(0 0 0px transparent)',

    transition: phase === 'appear'
      ? 'opacity 400ms ease-out, transform 400ms ease-out, filter 400ms ease-out'
      : phase === 'glow'
      ? 'filter 700ms ease-out'
      : phase === 'zoom'
      ? 'opacity 750ms ease-in, transform 750ms cubic-bezier(0.55, 0, 1, 0.45), filter 500ms ease-in'
      : 'none',
  }

  const wordmarkStyle: React.CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    fontWeight: 700,
    fontSize: 22,
    letterSpacing: '0.18em',
    color: '#ADFF2F',
    opacity: phase === 'hidden' ? 0 : phase === 'zoom' || phase === 'out' ? 0 : 1,
    transform: phase === 'hidden' ? 'translateY(6px)' : phase === 'zoom' ? 'translateY(-4px)' : 'translateY(0)',
    textShadow: phase === 'glow'
      ? '0 0 16px #ADFF2F, 0 0 40px #ADFF2F66'
      : '0 0 0px transparent',
    transition: phase === 'appear'
      ? 'opacity 400ms ease-out 120ms, transform 400ms ease-out 120ms'
      : phase === 'glow'
      ? 'text-shadow 700ms ease-out'
      : phase === 'zoom'
      ? 'opacity 600ms ease-in, transform 600ms ease-in'
      : 'none',
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: '#000000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    zIndex: 9999,
    opacity: phase === 'out' ? 0 : 1,
    transition: phase === 'out' ? 'opacity 500ms ease-out' : 'none',
  }

  return (
    <div style={overlayStyle}>
      <img
        src="/Goodluck_.png"
        alt="Goodluck"
        style={logoStyle}
      />
      <div style={wordmarkStyle}>GOODLUCK</div>
    </div>
  )
}
