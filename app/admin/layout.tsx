import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect('/signin');
  return <section className="pt-10 pb-24">{children}</section>;
}
