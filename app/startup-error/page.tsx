"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function StartupErrorContent() {
  const searchParams = useSearchParams();
  const missing = searchParams.get("missing")?.split(",") || [];

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-lg p-8 border border-red-500">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-red-500 mb-4">System Not Ready</h1>
          <p className="text-gray-300 mb-6">
            The application is missing required configuration. Please add the following secrets in Replit:
          </p>
          
          <div className="bg-gray-900 rounded p-4 mb-6 text-left">
            <p className="text-sm text-gray-400 mb-3">Missing environment variables:</p>
            <ul className="space-y-2">
              {missing.length > 0 ? (
                missing.map((key) => (
                  <li key={key} className="text-red-400 font-mono text-sm">
                    • {key}
                  </li>
                ))
              ) : (
                <li className="text-gray-400 text-sm">
                  DATABASE_URL, AUTH_SECRET, SOLANA_RPC_URL, TELEGRAM_BOT_TOKEN, ENCRYPTION_KEY, INTERNAL_API_KEY
                </li>
              )}
            </ul>
          </div>

          <div className="bg-blue-900 bg-opacity-30 border border-blue-500 rounded p-4 mb-6 text-left">
            <p className="text-sm text-blue-300 font-mono">
              1. Go to Replit Secrets tab (⚙️)<br/>
              2. Add each variable<br/>
              3. Refresh the app<br/>
            </p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Retry Connection
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StartupErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900" />}>
      <StartupErrorContent />
    </Suspense>
  );
}
