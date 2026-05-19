import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect('/signin');
  // Pass-through: each admin page renders its own canonical section
  // (pt-10 pb-8 intro / pt-2 pb-24 content). Adding another section
  // wrapper here doubled the top padding before the Admin label.
  return <>{children}</>;
}
