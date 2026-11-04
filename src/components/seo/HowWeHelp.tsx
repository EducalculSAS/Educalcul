import { BookOpen, ListChecks, PenLine, Sparkles, Users } from "lucide-react";

const HOW = [
  { icon: BookOpen, title: "Des cours clairs", text: "Chaque notion est expliquée simplement, avec des exemples et des points d'attention." },
  { icon: PenLine, title: "Des exercices corrigés", text: "Chaque réponse est corrigée tout de suite, avec une explication de l'erreur." },
  { icon: ListChecks, title: "Des quiz de révision", text: "Des questions courtes pour vérifier qu'une notion est acquise." },
  { icon: Sparkles, title: "Calia, le tuteur IA", text: "Calia guide l'élève par questions et indices, sans donner la réponse." },
  { icon: Users, title: "Le suivi parent", text: "Le parent voit l'activité, les scores et les notions à retravailler." },
];

/** Les cinq piliers d'Educalcul, en cartes (pages publiques). */
export default function HowWeHelp() {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {HOW.map((h) => (
        <li key={h.title} className="rounded-2xl border border-[rgba(197,161,72,0.25)] bg-white p-4">
          <h.icon className="w-5 h-5 text-[var(--greek-gold)] mb-2" aria-hidden="true" />
          <h3 className="font-bold text-sm text-[var(--greek-blue)] mb-1">{h.title}</h3>
          <p className="text-xs text-gray-600 leading-relaxed">{h.text}</p>
        </li>
      ))}
    </ul>
  );
}
