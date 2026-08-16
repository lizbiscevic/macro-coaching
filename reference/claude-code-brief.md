# Project brief — Macro Coaching With Liz

Original brief + prototype, kept here for reference now that the build is
underway. The math and copy decisions below are still the source of truth —
just no longer the first message, since step 1 is already scaffolded.

---

## What we're building

A self-serve macro coaching site. Right now I coach clients over text and get
buried in it — 100 messages a day answering the same questions. This site
replaces the texting with a product.

The funnel:

1. **Free timeline calculator.** A visitor enters their stats and goal weight.
   The site tells them exactly how long it will realistically take — including
   diet breaks and the reverse diet at the end, which no other coach shows them.
2. **Paywall.** They pick a plan: DIY one-time, or 1 / 3 / 6 month coaching.
3. **Checkout** via Stripe.
4. **Client area.** Week 1 is a baseline week — they log food and do one weigh-in.
   After that it's a weekly check-in. Their macros get set from their real data,
   not from a formula.
5. **Coach dashboard (private, me only).** Every client's week on one page so I
   read one screen on Sunday instead of scrolling threads.

**Everything lives in the portal — I don't email clients anything.** Picking a
tier on the pricing screen opens one combined screen: create a profile (name +
email) and pay, in that order, on that screen. There's no separate "sign up"
step before or after checkout. Once they're in, their macros, their protocol,
their check-in history, their call info — all of it renders in the portal.
Nothing gets sent to their inbox as content.

The one exception is infrastructure, not content: Supabase's magic-link auth
has to send an email to log them in — that's unavoidable and fine. The line is
"I don't manually send you things by email," not "no email software touches
this app." Don't build any flow (macros delivery, protocol delivery, call
scheduling, reminders) that depends on me or the system emailing a client
something to read. If it's information they need, it renders on a page they
can load.

I have a working single-file React prototype of screens 1–4 (`PhasePlan.jsx`).
Use it as the source of truth for the math, the copy, and the visual design.
Don't redesign it — port it.

---

## Positioning (this drives the copy)

The whole pitch is honesty about time. Most coaching sells ambiguity: big
optimism, no real end date, because the longer you need a coach the more that
coach makes. I'm selling the opposite — you see your finish date before you pay,
and the plan is built to end.

The reverse diet is the differentiator. Everyone sells the cut. Nobody explains
that if you hit goal and go back to eating "normally," normal is now above the
maintenance you actually have, and that's the bounce-back. I coach the walk back
up.

**Voice:** first person, casual, direct, a little blunt. Longer sentences are
fine. Not polished marketing copy, not AI-sounding.

**Two hard rules:** never use the word "particular" or the word "quietly"
anywhere in the site copy.

---

## Stack

- **Next.js (App Router) on Vercel.** I need serverless functions in the same
  repo as the frontend, env vars, and deploy on git push.
- **Supabase** for the database and auth. Use magic-link email login — no
  passwords for clients.
- Keep the existing CSS approach from the prototype (CSS variables in a style
  block). Don't swap it for Tailwind or a component library.

Set it up so `npm run dev` works from a clean clone with a `.env.example` listing
every variable.

---

## The math (port this exactly — it's already correct in the prototype)

- Maintenance calories: Mifflin-St Jeor, multiplied by activity level.
- Loss rate: **0.7% of the midpoint bodyweight per week.**
- Deficit is capped at **25% below maintenance** — never deeper.
- Hard calorie floor: `max(BMR × 1.05, 1500 male / 1200 female)`. If the math
  wants to go below the floor, hold at the floor and **extend the timeline**
  instead of cutting harder.
- No diet breaks by default — straight through the cut. Only once the total
  loss is **more than 20 lb** does a maintenance **diet break week per 8 weeks**
  of deficit kick in.
- **Reverse diet:** raise ~75 cal/week from deficit calories back up to
  maintenance at the new goal weight. Clamp to 4–16 weeks.
- Week 1 is always a baseline week, before any deficit starts.
- Gaining: 0.35% bodyweight/week, then a 6-week maintenance hold.

### Safety guardrails — keep these, do not "improve" them

- If the goal weight puts them under **18.5 BMI**, refuse to generate a plan.
  Show the message that's already in the prototype and route them to a
  conversation with me instead. This is deliberate. It stays.
- If they're within 2 lb of goal, don't generate a cut — tell them that's a
  maintenance conversation.
- Keep the footer disclaimer about pregnancy, medical conditions, and history
  with food.

---

## Stripe

Use **Stripe Payment Links** — I don't want a custom card form and I don't want
to handle card data.

- One link per tier (DIY, 1mo, 3mo, 6mo). Read the URLs from env vars.
- Prefill the customer email from the checkout screen.
- Pass a generated `client_reference_id` on the redirect (the prototype creates
  this the moment someone gets a valid timeline, before they've even picked a
  tier — see "Persist before payment" below) and use it, not just email, to
  match the webhook back to the right record. Someone can edit the prefilled
  email at Stripe's own checkout page, so email alone isn't reliable.
- Success URL returns them to the client area.
- Handle the `checkout.session.completed` webhook to mark the client as paid and
  create their record. Verify the webhook signature.
- The prices in the prototype are placeholders. Wire them to config so I can
  change them in one place.

### Persist before payment

Don't wait until a successful payment to save anything. The moment the free
calculator produces a valid timeline, create a draft record (keyed by the
generated id above) with their inputs and the computed plan. Update it again
when they pick a tier. That way someone who computes their timeline, gets
distracted, and comes back tomorrow — on the same browser — picks up where
they left off instead of re-entering everything. The prototype does this
client-side with `window.storage`; in the real app this should be a Supabase
row (or equivalent), not just local storage, since the whole point is that it
survives a lost tab/device before they've authenticated.

---

## My Macros+ integration

Docs: https://getmymacros.com/api/MM+_API_Documentation.pdf — **read this first,
in full.** Base URL is `https://getmymacros.com/api`.

This is the piece that kills the manual logging. What I need:

- `POST /user/fetchRange.php` — pull a client's `weight`, `macro`, `nutrition`,
  and `meal` data across a date range. This powers the coach dashboard.
- `POST /user/update.php` with `post_action=goal` — push protein/carb/fat targets
  to a client's account. This is how I set their macros after the baseline week.
  Build a button for it on the dashboard.

### Non-negotiable constraints

1. **The API key never touches the browser.** It lives in `MYMACROS_API_KEY` as a
   server-side env var, and every call goes through a Next.js route handler.
   Never in client components, never in `NEXT_PUBLIC_*`, never committed.
2. **Never collect a client's My Macros+ password.** The docs describe a
   `connect.php` endpoint that takes one — don't build any UI for it. Clients add
   me as their coach through My Circle inside their own app, and I identify them
   by email only.
3. **Never cache or store their food data.** The docs are explicit: food
   information must not be stored anywhere outside My Macros+ servers. Fetch it
   live on dashboard load. You may store my own records (their plan, weigh-ins,
   check-ins) — just not their food logs.
4. **Attribution required.** "Macros Powered by My Macros+" must appear on any
   page displaying their data. It's already in the prototype's client area.

I don't have the API key yet — I've requested it. Build against the env var and
make it degrade gracefully when the key is missing: the manual check-in form
should keep working on its own.

---

## Coach dashboard (`/coach`, private)

Protected route, just me. One page:

- Every active client as a row: name, current week and phase, latest weigh-in,
  change since last week, average calories this week, and whether they checked in.
- Flag anyone who's missed two check-ins or whose weight has moved the wrong way
  two weeks running — those are the people I actually need to text.
- Click a client → their full timeline, check-in history, and live My Macros+ data
  if they've connected.
- A "push macros" button that writes their targets back to My Macros+.

---

## Order of work

Do these one at a time and stop for review after each. Don't build it all at once.

1. Scaffold Next.js + Supabase, port `PhasePlan.jsx` into real routes, get the
   calculator and timeline working. No auth, no payments yet.
2. Supabase schema + magic-link auth + the client area with persistent check-ins.
3. Stripe Payment Links + webhook.
4. My Macros+ route handlers + the coach dashboard.
5. Deploy to Vercel with a real domain.

Start with step 1 and show me what you've got before moving on.
