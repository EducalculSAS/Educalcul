import Image from "next/image";

export default function AppAdminLoader() {
  return (
    <div className="min-h-screen bg-[var(--greek-cream)] flex items-center justify-center">
      <div className="text-center">
        <Image src="/logo.png" alt="Educalcul" width={64} height={64} className="w-16 h-16 mx-auto mb-4 animate-pulse" />
        <div className="flex gap-1.5 justify-center">
          <span className="w-2 h-2 bg-[var(--greek-blue)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-[var(--greek-gold)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-[var(--greek-blue)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
