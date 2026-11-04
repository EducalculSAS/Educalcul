import Link from "next/link";
import { CheckCircle } from "lucide-react";

const LINK = "font-semibold text-[var(--greek-gold-text)] hover:underline";

/** Texte d'accompagnement de l'inscription (rendu serveur) : ce que l'on obtient, pour qui, et ce que deviennent les données. */
export default function InscriptionInfo() {
  return (
    <section className="w-full max-w-md bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)] text-sm text-gray-600 space-y-5">
      <div>
        <h2 className="text-base font-bold text-[var(--greek-blue)] mb-2">7 jours gratuits, sans carte bancaire</h2>
        <p>
          Le compte est créé par un parent, qui ajoute ensuite son ou ses enfants. L&apos;essai dure 7 jours, sans engagement :
          à la fin, vous choisissez une formule ou vous arrêtez simplement.
        </p>
      </div>
      <div>
        <h2 className="text-base font-bold text-[var(--greek-blue)] mb-2">Du CP à la Terminale</h2>
        <p>
          Primaire, collège et lycée, y compris la spécialité maths, les maths expertes et complémentaires.
          Voir <Link href="/programmes" className={LINK}>le programme de chaque niveau</Link>.
        </p>
      </div>
      <div>
        <h2 className="text-base font-bold text-[var(--greek-blue)] mb-2">Ce qui est inclus</h2>
        <ul className="space-y-1.5">
          {["Des cours, des exercices corrigés et des quiz", "Calia, le tuteur IA qui guide sans donner la réponse", "Un espace parent pour suivre la progression"].map((t) => (
            <li key={t} className="flex items-start gap-2"><CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--greek-gold)]" aria-hidden="true" />{t}</li>
          ))}
        </ul>
        <p className="mt-2">Le détail par formule est sur la page <Link href="/tarifs" className={LINK}>Tarifs</Link>.</p>
      </div>
      <div>
        <h2 className="text-base font-bold text-[var(--greek-blue)] mb-2">Vos données</h2>
        <p>
          Les données de l&apos;enfant servent à son apprentissage et à votre suivi. Vous pouvez les exporter ou supprimer le compte depuis
          l&apos;espace parent. Tout est expliqué dans la <Link href="/politique-confidentialite" className={LINK}>politique de confidentialité</Link>.
          Une question ? Consultez la <Link href="/faq" className={LINK}>FAQ</Link>.
        </p>
      </div>
    </section>
  );
}
