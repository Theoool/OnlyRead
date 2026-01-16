"use client";

import { useEffect, useState } from "react";

export default function DebugAuthPage() {
  const [sessionData, setSessionData] = useState<any>(null);
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setLoading(true);

    try {
      // Check session
      const sessionRes = await fetch('/api/auth/session');
      const sessionData = await sessionRes.json();
      setSessionData(sessionData);

      // Check debug endpoint
      const debugRes = await fetch('/api/debug/auth');
      const debugData = await debugRes.json();
      setDebugData(debugData);
    } catch (error: any) {
      console.error('Debug error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Authentication Debug Page</h1>

        {/* Session Data */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Session Data (/api/auth/session)</h2>
          <pre className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded overflow-auto">
            {JSON.stringify(sessionData, null, 2)}
          </pre>
        </div>

        {/* Debug Data */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Debug Data (/api/debug/auth)</h2>
          <pre className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded overflow-auto">
            {JSON.stringify(debugData, null, 2)}
          </pre>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={checkAuth}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Refresh
          </button>
          <a
            href="/"
            className="px-4 py-2 bg-zinc-500 text-white rounded-lg hover:bg-zinc-600"
          >
            Back to Home
          </a>
          <a
            href="/auth"
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            Go to Login
          </a>
        </div>
      </div>
    </div>
  );
}
