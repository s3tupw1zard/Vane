'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Loader from '@/components/ui/Loader';
import LoginPage from '@/components/auth/LoginPage';
import SetupWrapper from '@/components/Setup/SetupWrapper';
import Sidebar from '@/components/Sidebar';
import { ChatProvider } from '@/lib/hooks/useChat';

interface SetupStatus {
  setupComplete: boolean;
  hasUsers: boolean;
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);

  const isAuthRoute = pathname?.startsWith('/login');
  const isSetupRoute = pathname?.startsWith('/setup');

  useEffect(() => {
    fetch('/api/auth/setup-status')
      .then((response) => {
        if (!response.ok) throw new Error('Failed to fetch setup status');
        return response.json();
      })
      .then((data) => setSetupStatus(data))
      .catch(() => {
        console.error('Failed to fetch setup status');
        // Do not expose first-user registration when setup state is unknown.
        setSetupStatus({ setupComplete: false, hasUsers: true });
      });
  }, []);

  if (loading || setupStatus === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  if (!setupStatus.setupComplete) {
    if (setupStatus.hasUsers && !user) {
      return <LoginPage />;
    }

    if (!isSetupRoute) {
      window.location.href = '/setup';
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Loader />
        </div>
      );
    }

    return <SetupWrapper hasUsers={setupStatus.hasUsers} />;
  }

  // Not logged in → login page (unless already on login)
  if (!user && !isAuthRoute) {
    return <LoginPage />;
  }

  // Setup complete and logged in → show main app
  return (
    <ChatProvider>
      <Sidebar>{children}</Sidebar>
    </ChatProvider>
  );
}
