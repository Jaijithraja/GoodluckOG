import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { computeBurnoutScore } from '@/lib/engine/burnout'

export async function POST(req: NextRequest) {
  try {
    const { student_id } = await req.json()
    const supabase = createServerClient()
    const result = await computeBurnoutScore(student_id, supabase)
    return NextResponse.json({ result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
