"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function MentionsLegales() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />

      <main className="flex-grow pt-[100px] pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-white rounded-[15px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-[var(--card-border-antique)] p-8 md:p-12">
            <h1 className="font-[family-name:var(--font-cinzel)] font-bold text-[var(--greek-blue)] text-3xl md:text-4xl mb-8 border-b-2 border-[var(--greek-gold)] pb-4">
              Mentions Légales
            </h1>

            <div className="space-y-8 text-gray-700">
              <section>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-4">
                  1. Édition du site
                </h2>
                <p className="mb-2">
                  En vertu de l'article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique, il est précisé aux utilisateurs du site internet <strong>Educalcul</strong> l'identité des différents intervenants dans le cadre de sa réalisation et de son suivi :
                </p>
                <ul className="list-disc list-inside ml-4 space-y-2">
                  <li><strong>Propriétaire du site :</strong> Educalcul SAS</li>
                  <li><strong>Contact :</strong> contact@educalcul.com</li>
                  <li><strong>Adresse :</strong> 123 Avenue des Mathématiques, 75000 Paris</li>
                </ul>
              </section>

              <section>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-4">
                  2. Hébergement
                </h2>
                <p>
                  Le site est hébergé par :<br />
                  <strong>Vercel Inc.</strong><br />
                  340 S Lemon Ave #4133<br />
                  Walnut, CA 91789<br />
                  États-Unis
                </p>
              </section>

              <section>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-4">
                  3. Propriété intellectuelle et contrefaçons
                </h2>
                <p className="mb-4">
                  <strong>Educalcul</strong> est propriétaire des droits de propriété intellectuelle et détient les droits d'usage sur tous les éléments accessibles sur le site internet, notamment les textes, images, graphismes, logos, vidéos, architecture, icônes et sons.
                </p>
                <p>
                  Toute reproduction, représentation, modification, publication, adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite, sauf autorisation écrite préalable de <strong>Educalcul</strong>.
                </p>
                <p>
                  Toute exploitation non autorisée du site ou de l'un quelconque des éléments qu'il contient sera considérée comme constitutive d'une contrefaçon et poursuivie conformément aux dispositions des articles L.335-2 et suivants du Code de Propriété Intellectuelle.
                </p>
              </section>

              <section>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-4">
                  4. Limitations de responsabilité
                </h2>
                <p className="mb-4">
                  <strong>Educalcul</strong> ne pourra être tenu pour responsable des dommages directs et indirects causés au matériel de l'utilisateur, lors de l'accès au site internet.
                </p>
                <p>
                  <strong>Educalcul</strong> décline toute responsabilité quant à l'utilisation qui pourrait être faite des informations et contenus présents sur le site.
                </p>
                <p>
                  <strong>Educalcul</strong> s'engage à sécuriser au mieux le site, cependant sa responsabilité ne pourra être mise en cause si des données indésirables sont importées et installées sur son site à son insu.
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
