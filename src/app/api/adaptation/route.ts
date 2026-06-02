import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { runAdaptation } from '@/lib/engine/adaptation'

export async function POST(req: NextRequest) {
  try {
    const { student_id } = await req.json()
    const supabase = createServerClient()
    const changes = await runAdaptation(student_id, supabase)
    return NextResponse.json({ changes })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
