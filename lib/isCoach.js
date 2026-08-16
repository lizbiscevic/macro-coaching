export function isCoach(email) {
  const coachEmail = process.env.COACH_EMAIL;
  if (!coachEmail || !email) return false;
  return email.trim().toLowerCase() === coachEmail.trim().toLowerCase();
}
