import { BookOpen, ListChecks, PenLine, Sparkles, Users } from "lucide-react";
import { FeatureCard } from "@/components/public/PublicPage";

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {HOW.map((h, i) => (
        <FeatureCard key={h.title} icon={<h.icon className="w-6 h-6" />} title={h.title} delayMs={i * 80}>{h.text}</FeatureCard>
      ))}
    </div>
  );
}
