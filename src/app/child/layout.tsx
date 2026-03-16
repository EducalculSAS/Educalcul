import Navbar from "@/components/Navbar";
import { ReactNode } from "react";

export default function ChildLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="pt-[64px] min-h-screen bg-[var(--greek-cream)]">
        {children}
      </main>
    </>
  );
}
