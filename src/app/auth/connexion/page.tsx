import { Suspense } from "react";
import ConnexionClient from "./ConnexionClient";

export default function ConnexionPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md" />}>
      <ConnexionClient />
    </Suspense>
  );
}
