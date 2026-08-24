/* ------------------------------------------------------------------
   Direct transactional email to the coach herself — not through
   Supabase Auth's SMTP (that's scoped to auth emails: magic link,
   etc.), a plain call to Resend's own API using the same verified
   domain. Degrades to a no-op if either env var is missing, same
   pattern as every other optional integration in this app — a failed
   or skipped notification should never block the check-in save that
   triggered it.
-------------------------------------------------------------------*/

const RESEND_URL = "https://api.resend.com/emails";

export async function notifyCoach(subject, body) {
  const apiKey = process.env.RESEND_API_KEY;
  const coachEmail = process.env.COACH_EMAIL;
  if (!apiKey || !coachEmail) return;

  try {
    await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Macro Coaching With Liz <hello@yourmacrojourney.com>",
        to: [coachEmail],
        subject,
        text: body,
      }),
    });
  } catch (e) {
    // best-effort
  }
}
