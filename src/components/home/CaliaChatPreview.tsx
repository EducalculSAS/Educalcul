import Image from "next/image";
import katex from "katex";
import "katex/dist/katex.min.css";

/** Formule rendue AU BUILD (composant serveur) : la page d'accueil n'embarque plus KaTeX dans son JavaScript (≈ 100 Ko compressés). */
const math = (tex: string) => katex.renderToString(tex, { throwOnError: false });

const FIRST = `Je bloque sur ${math("2x + 5 = 11")}...`;
const SECOND = `Bien vu ! Pour isoler ${math("x")}, que peux-tu faire des deux côtés de l'égalité en premier ?`;

/** Mockup de conversation Calia pour la home — mêmes styles de bulles et même rendu LaTeX que le vrai chatbot
 * (src/components/child/AITutor.tsx), pour ne pas montrer une fausse interface qui ne ressemble pas au produit. */
export default function CaliaChatPreview() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex justify-end">
        <div
          className="calia-glass-gold max-w-[85%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed"
          style={{ color: "var(--greek-blue)", borderBottomRightRadius: 4 }}
          dangerouslySetInnerHTML={{ __html: FIRST }}
        />
      </div>

      <div className="flex gap-2 justify-start">
        <Image src="/logoAI.png" alt="" width={20} height={20} className="object-contain flex-shrink-0 mt-1" />
        <div
          className="calia-glass-soft max-w-[88%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed"
          style={{ color: "rgba(240,237,232,0.9)", borderBottomLeftRadius: 4 }}
          dangerouslySetInnerHTML={{ __html: SECOND }}
        />
      </div>
    </div>
  );
}
