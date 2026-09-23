/** Rejoué à chaque navigation dans cet espace : le nouveau contenu entre en
 * fondu avec un léger glissement (voir .page-enter dans globals.css), au lieu
 * d'apparaître d'un coup. La barre de navigation (dans le layout) ne bouge pas. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
