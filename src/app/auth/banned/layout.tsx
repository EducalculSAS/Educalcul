// Override : la page bannissement s'affiche seule, sans Navbar ni Footer
export default function BannedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
