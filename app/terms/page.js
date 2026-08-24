import LegalLayout from "@/components/LegalLayout";

export const metadata = { title: "Terms of Service — Macro Coaching With Liz", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="August 23, 2026">
      <p>
        These are the terms for using yourmacrojourney.com and working with Macro Coaching With Liz. By
        creating a profile, purchasing a plan, or using the client portal, you're agreeing to them.
      </p>

      <h2>What this is</h2>
      <p>
        Macro coaching — a calorie and macro plan built from your numbers, and (on coached tiers) ongoing
        check-ins, adjustments, and messaging with a coach. It's nutrition coaching, not a medical service.
      </p>

      <h2>Not medical advice</h2>
      <p>
        Nothing here is medical advice, and I'm not a doctor or registered dietitian. The numbers this site
        produces are estimates based on standard formulas, not guarantees — real bodies respond
        differently, which is exactly why coached plans get adjusted from real data starting week two. If
        you're pregnant, managing a medical condition, or have a history with food and your body that
        makes numbers risky, talk to a doctor before starting.
      </p>

      <h2>Who can use this</h2>
      <p>
        You must be at least 16 years old. If you're under 18, you confirm you have a parent or guardian's
        permission to use this service and to purchase a plan.
      </p>

      <h2>Plans and billing</h2>
      <ul>
        <li>
          <strong>Do It Yourself ($89)</strong> and the <strong>3- and 6-month coached plans</strong> are
          one-time charges for a fixed term — not subscriptions, no auto-renewal.
        </li>
        <li>
          <strong>The 1-month plan</strong> is a recurring monthly subscription. It renews automatically
          until you cancel; you can cancel any time and it won't renew again after the current period ends.
        </li>
        <li>All charges are processed by Stripe. I never see or store your card details.</li>
        <li>
          Refunds follow the <a href="/refund">refund policy</a>.
        </li>
      </ul>

      <h2>Your account</h2>
      <p>
        The client portal uses email-based magic-link login — no password. Keep access to your email
        secure, since anyone with your email link can access your portal. Let me know right away if you
        think someone else has accessed your account.
      </p>

      <h2>Results aren't guaranteed</h2>
      <p>
        Timelines and outcomes shown by the calculator and in your plan are estimates, not promises.
        Adherence, biology, sleep, stress, and a dozen other things affect real-world results. I'll adjust
        your plan as real data comes in, but I can't guarantee a specific outcome by a specific date.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        This service is provided as-is. To the extent permitted by law, Macro Coaching With Liz isn't
        liable for indirect, incidental, or consequential damages arising from your use of the site or
        coaching service. Nothing here limits liability where the law doesn't allow it to be limited.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of [state/jurisdiction to be added].
      </p>

      <h2>Changes</h2>
      <p>
        I may update these terms as the service changes. If you're an active client, meaningful changes
        will be communicated by email or in the portal.
      </p>

      <h2>Questions</h2>
      <p>
        Email <a href="mailto:hello@yourmacrojourney.com">hello@yourmacrojourney.com</a> with anything
        that needs clarifying.
      </p>
    </LegalLayout>
  );
}
