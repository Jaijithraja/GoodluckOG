'use client'
import { useLoadingStore } from '@/store/loading'
import { useRouter } from 'next/navigation'
import { GoodluckIcon } from './GoodluckLogo'

interface LogoButtonProps {
  size?: number
  showTagline?: boolean
}

export function LogoButton({ size = 32, showTagline = false }: LogoButtonProps) {
  const { play } = useLoadingStore()
  const router = useRouter()

  function handleClick() {
    play()
    setTimeout(() => {
      router.push('/')
    }, 1500)
  }

  return (
    <button
      onClick={handleClick}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        textAlign: 'left'
      }}
      aria-label="Go to Goodluck home"
    >
      <GoodluckIcon size={size} />
      <span style={{
        fontFamily: 'var(--font-display), system-ui, sans-serif',
        fontWeight: 600,
        fontSize: size * 0.75,
        color: '#FFFFFF',
        letterSpacing: '-0.02em',
        lineHeight: 1
      }}>
        Goodluck
      </span>
    </button>
  )
}
