"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function CGU() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />

      <main className="flex-grow pt-[100px] pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-white rounded-[15px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-[var(--card-border-antique)] p-8 md:p-12">
            <h1 className="font-[family-name:var(--font-cinzel)] font-bold text-[var(--greek-blue)] text-3xl md:text-4xl mb-8 border-b-2 border-[var(--greek-gold)] pb-4">
              Conditions Générales d'Utilisation
            </h1>

            <div className="space-y-8 text-gray-700">
              <section>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-4">
                  1. Objet
                </h2>
                <p>
                  Les présentes Conditions Générales d'Utilisation (CGU) ont pour objet de définir les modalités de mise à disposition des services du site <strong>Educalcul</strong> et les conditions d'utilisation du service par l'utilisateur.
                </p>
              </section>

              <section>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-4">
                  2. Accès au service
                </h2>
                <p className="mb-4">
                  Le service est accessible gratuitement à tout utilisateur disposant d'un accès à internet. Tous les coûts afférents à l'accès au service, que ce soient les frais matériels, logiciels ou d'accès à internet sont exclusivement à la charge de l'utilisateur.
                </p>
                <p>
                  Certaines sections du site sont réservées aux membres après identification à l'aide de leur identifiant et de leur mot de passe.
                </p>
              </section>

              <section>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-4">
                  3. Responsabilité de l'utilisateur
                </h2>
                <p className="mb-4">
                  L'utilisateur est responsable des risques liés à l'utilisation de son identifiant de connexion et de son mot de passe. Le mot de passe de l'utilisateur doit rester secret. En cas de divulgation de mot de passe, l'éditeur décline toute responsabilité.
                </p>
                <p>
                  L'utilisateur assume l'entière responsabilité de l'utilisation qu'il fait des informations et contenus présents sur le site <strong>Educalcul</strong>.
                </p>
              </section>

              <section>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-4">
                  4. Propriété intellectuelle
                </h2>
                <p>
                  Les marques, logos, signes ainsi que tout le contenu du site (textes, images, son...) font l'objet d'une protection par le Code de la propriété intellectuelle et plus particulièrement par le droit d'auteur.
                </p>
              </section>

              <section>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-4">
                  5. Évolution du contrat
                </h2>
                <p>
                  Le site se réserve le droit de modifier les clauses de ces conditions générales d'utilisation à tout moment et sans justification.
                </p>
              </section>

              <section>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-4">
                  6. Droit applicable et juridiction compétente
                </h2>
                <p>
                  La législation française s'applique au présent contrat. En cas d'absence de résolution amiable d'un litige né entre les parties, les tribunaux français seront seuls compétents pour en connaître.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
