import { redirect } from 'next/navigation';
import { getCurrentUser, isSystemInitialized } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const initialized = await isSystemInitialized();
  if (!initialized) {
    redirect('/setup');
  }

  const user = await getCurrentUser();
  if (user) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
