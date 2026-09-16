"use client";

import { useEffect, useState } from "react";
import { Database } from "lucide-react";
import { supabase } from "@/lib/supabase";
import DashboardShell from "@/components/DashboardShell";

export default function TestSupabasePage() {
  const [message, setMessage] = useState(
    "Testing Supabase connection..."
  );

  useEffect(() => {
    async function testConnection() {
      try {
        const { error } = await supabase
          .from("connection_test")
          .select("*")
          .limit(1);

        if (error) {
          // The table does not exist yet, which is expected.
          // Reaching this response means Supabase is reachable.
          if (
            error.message.toLowerCase().includes("connection_test") ||
            error.code === "PGRST205"
          ) {
            setMessage(
              "✓ Supabase connected successfully! Test table does not exist yet."
            );
          } else {
            setMessage(
              `Supabase responded with: ${error.message}`
            );
          }

          return;
        }

        setMessage(
          "✓ Supabase connected successfully!"
        );
      } catch (error) {
        console.error(error);

        setMessage(
          "Connection failed. Check your Supabase URL and key."
        );
      }
    }

    testConnection();
  }, []);

  return (
    <DashboardShell footerNote="Connection diagnostics">
      <div className="cp-state-wrap">
        <div className="cp-state cp-state--notice">

          <div className="result-icon result-icon-filled result-icon--sm mx-auto">
            <Database aria-hidden="true" />
          </div>

          <h1 className="cp-h-card mt-3">
            Supabase Connection Test
          </h1>

          <p className="cp-state__msg break-words">
            {message}
          </p>

        </div>
      </div>
    </DashboardShell>
  );
}
