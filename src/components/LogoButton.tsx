'use client'
import { useLoadingStore } from '@/store/loading'
import { useRouter } from 'next/navigation'

export function LogoButton() {
  const { play } = useLoadingStore()
  const router = useRouter()

  function handleClick() {
    play()
    setTimeout(() => {
      router.push('/')
    }, 1950)
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
        gap: 10
      }}
      aria-label="Go to Goodluck home"
    >
      <img
        src="/Goodluck_.png"
        alt=""
        aria-hidden="true"
        style={{ width: 32, height: 32, objectFit: 'contain' }}
      />
      <span style={{
        fontWeight: 700,
        fontSize: 16,
        letterSpacing: '0.1em',
        color: '#ADFF2F'
      }}>
        GOODLUCK
      </span>
    </button>
  )
}
