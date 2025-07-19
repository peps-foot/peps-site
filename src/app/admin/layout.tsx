'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSupabase } from '../../components/SupabaseProvider'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = useSupabase()

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email !== 'admin@peps.foot') {
        // Si pas connecté ou pas le bon email, on renvoie sur /connexion
        router.replace('/connexion');
      }
    })();
  }, [router]);

  return (
    <div className="font-sans antialiased bg-white text-gray-900 min-h-screen p-6">
      {children}
    </div>
  );
}
