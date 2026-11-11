import Link from "@/components/AppLink";
import { ArrowRight } from "lucide-react";
import Emblem3D, { type EmblemKind } from "@/components/Emblem3D";

/**
 * Tuile de navigation des tableaux de bord élève et parent : une seule définition pour les deux espaces.
 * Sur téléphone la tuile est une ligne compacte (emblème, titre, flèche) pour que tout le menu tienne à l'écran ;
 * à partir de la tablette c'est une carte, avec l'action écrite en bas.
 */
export default function DashboardTile({ href, emblem, label, desc, action }: { href: string; emblem: EmblemKind; label: string; desc: string; action: string }) {
  return (
    <Link href={href} className="group block h-full">
      <div className="bg-white rounded-[20px] p-4 md:p-6 shadow-sm border border-[rgba(197,161,72,0.25)] hover:shadow-xl hover:-translate-y-1 transition-[transform,box-shadow] duration-300 h-full flex items-center gap-4 md:flex-col md:items-start md:gap-0">
        <span className="shrink-0 md:mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5">
          <Emblem3D kind={emblem} size={64} float={false} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg md:text-xl font-bold text-[var(--greek-blue)] md:mb-1">{label}</h3>
          <p className="text-gray-600 text-sm md:mb-4">{desc}</p>
        </div>
        <div className="hidden md:flex items-center text-[var(--greek-blue)] font-bold text-sm mt-auto">
          {action} <ArrowRight className="w-4 h-4 ml-1 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
        <ArrowRight className="md:hidden w-5 h-5 shrink-0 text-[var(--greek-gold)]" aria-hidden="true" />
      </div>
    </Link>
  );
}
