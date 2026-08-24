import LegalLayout from "@/components/LegalLayout";

export const metadata = { title: "Refund Policy — Macro Coaching With Liz", alternates: { canonical: "/refund" } };

export default function RefundPage() {
  return (
    <LegalLayout title="Refund Policy" updated="August 23, 2026">
      <p>
        Short version: if it's not right for you in week one, I'll refund it. Here's how that works for
        each plan.
      </p>

      <h2>Do It Yourself, 3-month, and 6-month plans</h2>
      <p>
        These are one-time purchases, not subscriptions. If your plan isn't a fit, email me within{" "}
        <strong>7 days of purchase</strong> and I'll refund it in full — no forms, no runaround. After
        that first week, purchases are final, since by then a coached plan is already in motion and a
        DIY plan has already been generated.
      </p>

      <h2>1-month plan (subscription)</h2>
      <p>
        This one renews monthly until you cancel — cancel any time and it simply won't renew again after
        the period you already paid for ends. The same week-one guarantee applies to your first charge:
        email me within 7 days of your first payment and I'll refund it and cancel the subscription.
        Later monthly renewals aren't refunded once they've processed, but canceling always stops the
        <em> next</em> one.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Email <a href="mailto:hello@yourmacrojourney.com">hello@yourmacrojourney.com</a> with the email
        address you purchased under. Refunds go back to the original payment method through Stripe and
        typically show up within 5–10 business days, depending on your bank.
      </p>
    </LegalLayout>
  );
}
