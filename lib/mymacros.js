/* ------------------------------------------------------------------
   My Macros+ integration — push side only. Server-only, the API key
   never touches the browser. Degrades to a silent no-op when the key
   isn't set yet, same shape as every other integration here.

   The exact request/response contract below is built from the brief's
   description of update.php (post_action=goal) — the full API docs
   (https://getmymacros.com/api/MM+_API_Documentation.pdf) haven't been
   read against this code, and it can't be tested at all without a real
   key. Verify field names against the real docs once the key exists.
-------------------------------------------------------------------*/

const BASE_URL = "https://getmymacros.com/api";

export async function pushMacroTargets(mymacrosEmail, { protein, carbs, fat }) {
  const apiKey = process.env.MYMACROS_API_KEY;
  if (!apiKey || !mymacrosEmail) return false;

  try {
    const res = await fetch(`${BASE_URL}/user/update.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        post_action: "goal",
        email: mymacrosEmail,
        protein,
        carbs,
        fat,
      }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}
