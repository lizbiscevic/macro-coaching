import LegalLayout from "@/components/LegalLayout";

export const metadata = { title: "Privacy Policy — Macro Coaching With Liz", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="August 23, 2026">
      <p>
        This page explains what information Macro Coaching With Liz ("I," "me") collects when you use
        yourmacrojourney.com, why, and who it's shared with. It's written in plain language on purpose —
        if anything here is unclear, email me and I'll clarify it.
      </p>

      <h2>What I collect</h2>
      <ul>
        <li>
          <strong>Profile info you enter:</strong> name, email, sex, age, height, weight, goal weight, and
          activity level, used to build your macro timeline and plan.
        </li>
        <li>
          <strong>Check-in data</strong> (if you become a client): weekly weigh-ins, daily calories/protein/
          fat/carbs, and — if you opt in — progress photos and your My Macros+ account email.
        </li>
        <li>
          <strong>Messages</strong> you send through the client portal.
        </li>
        <li>
          <strong>Payment info</strong> is handled entirely by Stripe — I never see or store your card
          number. I do receive your email, the plan you purchased, and the transaction status from Stripe.
        </li>
      </ul>

      <h2>Why I collect it</h2>
      <p>
        To calculate your macro timeline, run your coaching plan, communicate with you, and process
        payment. That's it — this isn't used for advertising, and I don't run ad trackers on this site.
      </p>

      <h2>Who it's shared with</h2>
      <p>Only the services that make the site work, each only for what they need to do their job:</p>
      <ul>
        <li><strong>Stripe</strong> — payment processing.</li>
        <li><strong>Supabase</strong> — the database and login system (magic-link email, no password stored).</li>
        <li><strong>Resend</strong> — sending your login link and account emails.</li>
        <li>
          <strong>My Macros+</strong> — only if you choose to connect your account so I can see your
          logged nutrition data. Nothing is shared with them unless you opt in.
        </li>
      </ul>
      <p>I don't sell your information to anyone, ever.</p>

      <h2>How long I keep it</h2>
      <p>
        For as long as you're an active client, plus a reasonable period after for your own records and
        my bookkeeping. Email me if you'd like your data deleted and I'll take care of it, minus whatever
        Stripe and I are legally required to keep for tax and payment records.
      </p>

      <h2>Your health data</h2>
      <p>
        Your weight, activity level, and check-in numbers are sensitive by nature. They're stored securely
        and only accessible to you and me (your coach) — never shared with a third party for marketing,
        research, or any purpose beyond running your coaching plan.
      </p>

      <h2>Questions</h2>
      <p>
        Email <a href="mailto:hello@yourmacrojourney.com">hello@yourmacrojourney.com</a> with anything —
        access, corrections, deletion, or just questions about how this works.
      </p>
    </LegalLayout>
  );
}
