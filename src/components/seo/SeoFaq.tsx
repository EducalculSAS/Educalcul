import TarifsFaqItem from "@/components/tarifs/TarifsFaqItem";
import JsonLd from "@/components/JsonLd";

/** FAQ d'une page publique : accordéon du site + données structurées FAQPage (le texte reste dans le HTML). */
export default function SeoFaq({ items }: { items: { q: string; a: string }[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <>
      <JsonLd data={data} />
      <div className="space-y-3">
        {items.map((f) => <TarifsFaqItem key={f.q} question={f.q} answer={f.a} />)}
      </div>
    </>
  );
}
