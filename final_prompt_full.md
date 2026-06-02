<USER_REQUEST>
# GOODLUCK — FINAL ANTIGRAVITY BUILD PROMPT
# One paste. Full product. Real AI. Real database. No fake data.
# Deadline: June 2nd
# Stack: Next.js 14 + Supabase + Claude API (claude-sonnet-4-20250514)

---

You are building Goodluck — a fully functional, production-ready CAT exam execution companion. This is not a prototype. This is not a mockup. Every feature must work with real data flowing from Supabase, real AI responses from Claude API, and real-time updates across the app. No hardcoded values. No placeholder text. No fake charts.

Read every word of this prompt before writing a single line of code. Build in the exact order specified. Do not move to the next step until the current step works end-to-end with real Supabase data.

---

# PRODUCT BRIEF

Goodluck is a 12-month AI execution companion for CAT aspirants. The thesis: students don't fail CAT because of lack of content — they fail because execution collapses somewhere between month 2 and month 6. Static plans break. Burnout hits silently. No product in Indian exam prep solves this at the behavioral layer.

Goodluck solves it with:
1. Behavioral adaptation engine — learns from every session log, updates topic weights
2. Countdown-aware phase system — Foundation / Acceleration / Crunch / FinalWeek — plan logic shifts automatically
3. Passive burnout detection — 5-signal scoring, intervenes before collapse
4. Mock test intelligence — debriefs every mock, detects practice vs mock delta, flags choke risk
5. Accountability pods — small matched groups, silent daily execution visibility, weekly check-in

North star metric: % of users completing 90+ consecutive days of execution.

---

# DESIGN SYSTEM — WARM & FOCUSED

Philosophy: Every screen must feel like a calm, focused place to do hard work. Calm's softness + Linear's precision. No generic AI aesthetics. No corporate blue. Nothing that looks like it was built in an afternoon.

```css
:root {
  --bg-base:        #FAF8F5;
  --bg-surface:     #F5F2ED;
  --bg-elevated:    #FF
<truncated 45215 bytes>
{latest?.streak_breaks_7d || 0}

Write exactly 3-4 sentences that:
1. Acknowledge what the data shows without any judgment
2. Normalize the genuine difficulty of sustaining 12 months of focused preparation
3. Offer one small, concrete, achievable next step

Absolute rules:
- No greeting, no "Hey", no signature
- No JSON, no formatting — just the message text
- Never use: "you've got this", "keep going", "I believe in you", "hang in there", "you can do it"
- This student is intelligent. They will immediately detect hollow encouragement.
- Say something real and specific to their situation.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    })

    const message = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    return new Response(JSON.stringify({ message }), { headers: CORS })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
  }
})
```

---

# STEP 5 — NEXT.JS API ROUTES

## app/api/adaptation/route.ts
```typescript
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
```

## app/api/burnout/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { computeBurnout } from '@/lib/engine/burnout'

expor
<truncated 16798 bytes>

NOTE: The output was truncated because it was too long. Use a more targeted query or a smaller range to get the information you need.