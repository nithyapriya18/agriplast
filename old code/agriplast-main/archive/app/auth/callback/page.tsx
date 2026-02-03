'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { checkAuth } from '@/lib/auth';
import Image from 'next/image';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setTimeout(() => router.push('/?error=login_failed'), 2000);
      return;
    }

    if (code) {
      // Call our API to exchange the code for user info
      fetch('/api/auth/exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      })
        .then(response => response.json())
        .then(async (data) => {
          if (data.error) {
            setTimeout(() => router.push('/?error=login_failed'), 2000);
            return;
          }

          const email = data.email;
          const name = data.name;

          // Check if authorized
          if (checkAuth(email)) {
            // Set secure HTTP-only cookie via API route
            await fetch('/api/auth/set-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, name }),
            });
            
            // Also set in localStorage for client-side access (will be phased out)
            localStorage.setItem('agriplast_user_email', email);
            localStorage.setItem('agriplast_user_name', name);
            router.push('/map');
          } else {
            setTimeout(() => router.push('/?error=not_authorized'), 2000);
          }
        })
        .catch(err => {
          setTimeout(() => router.push('/?error=login_failed'), 2000);
        });
    } else {
      setTimeout(() => router.push('/?error=login_failed'), 2000);
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ minHeight: '100vh' }}>
      <Header />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Image 
            src="/logo.png" 
            alt="Agriplast" 
            width={360}
            height={360}
            className="object-contain mx-auto mb-8"
          />
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="font-body text-textMuted">Completing sign-in...</p>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col" style={{ minHeight: '100vh' }}>
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Image 
              src="/logo.png" 
              alt="Agriplast" 
              width={360}
              height={360}
              className="object-contain mx-auto mb-8"
            />
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="font-body text-textMuted">Loading...</p>
          </div>
        </div>
        <Footer />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
