// src/app/notifications/page.tsx
'use client';

import NotificationsSettings from '../../components/NotificationsSettings';

export default function NotificationsPage() {
  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-3 text-center">Notifications</h1>
      <NotificationsSettings />
    </main>
  );
}
