"use client";

import { useEffect } from "react";
import NextError from "next/error";
import { reportClientError } from "@/instrumentation-client";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    reportClientError(error.message || "Erreur globale", error.stack);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
