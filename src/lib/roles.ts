export type Role = 'student' | 'advisor';

// Prototype role rule: an email on this list is an advisor; everyone else is a student.
// This stands in for a real advisor directory until we store roles in the database.
// To see the advisor view while testing, add your own email here temporarily.
export const ADVISOR_EMAILS: string[] = [
  'jenkins.892@osu.edu', // Sarah Jenkins, the advisor in the prototype
];

export function getRole(email: string | undefined | null): Role {
  if (!email) return 'student';
  return ADVISOR_EMAILS.includes(email.trim().toLowerCase()) ? 'advisor' : 'student';
}
