export type Role = 'student' | 'advisor';

// Prototype role rule: an email on this list is an advisor; everyone else is a student.
// This stands in for a real advisor directory until we store roles in the database.
// To see the advisor view while testing, add your own email here temporarily.
// Keep this list in sync with public.is_advisor() in supabase/migrations (it stops advisors adding faculty reviews).
export const ADVISOR_EMAILS: string[] = [
  'jenkins.892@osu.edu', // Sarah Jenkins, the advisor in the prototype
  'tylerrez3@gmail.com', // demo advisor account (rezabek.14@osu.edu is the student view)
];

export function getRole(email: string | undefined | null): Role {
  if (!email) return 'student';
  return ADVISOR_EMAILS.includes(email.trim().toLowerCase()) ? 'advisor' : 'student';
}
