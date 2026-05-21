"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function PolitiqueConfidentialite() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />

      <main className="flex-grow pt-[100px] pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-white rounded-[15px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-[var(--greek-gold)] p-8 md:p-12">
            <h1 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-3xl md:text-4xl mb-8 border-b-2 border-[var(--greek-gold)] pb-4">
              Politique de Confidentialité
            </h1>

            <div className="space-y-8 text-gray-700">
              <section>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-4">
                  1. Collecte des données
                </h2>
                <p className="mb-4">
                  Nous collectons les informations suivantes lors de votre inscription et utilisation de notre plateforme :
                </p>
                <ul className="list-disc list-inside ml-4 space-y-2">
                  <li>Nom et prénom</li>
                  <li>Adresse email</li>
                  <li>Données de progression pédagogique (pour les comptes enfants)</li>
                  <li>Informations de paiement (gérées de manière sécurisée par notre prestataire Stripe)</li>
                </ul>
              </section>

              <section>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-4">
                  2. Utilisation des données
                </h2>
                <p className="mb-4">
                  Les données collectées sont utilisées pour :
                </p>
                <ul className="list-disc list-inside ml-4 space-y-2">
                  <li>Fournir et gérer nos services éducatifs</li>
                  <li>Suivre la progression des élèves</li>
                  <li>Communiquer avec les utilisateurs (support, mises Ã  jour)</li>
                  <li>Améliorer notre plateforme</li>
                </ul>
              </section>

              <section>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-4">
                  3. Protection des données
                </h2>
                <p>
                  Nous mettons en Å“uvre des mesures de sécurité appropriées pour protéger vos données personnelles contre tout accès, modification, divulgation ou destruction non autorisé. Toutes les communications sont chiffrées via le protocole SSL/TLS.
                </p>
              </section>

              <section>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-4">
                  4. Vos droits
                </h2>
                <p className="mb-4">
                  Conformément au RGPD, vous disposez des droits suivants concernant vos données personnelles :
                </p>
                <ul className="list-disc list-inside ml-4 space-y-2">
                  <li>Droit d'accès et de rectification</li>
                  <li>Droit Ã  l'effacement ("droit Ã  l'oubli")</li>
                  <li>Droit Ã  la limitation du traitement</li>
                  <li>Droit Ã  la portabilité des données</li>
                </ul>
                <p className="mt-4">
                  Pour exercer ces droits, vous pouvez nous contacter Ã  l'adresse : privacy@educalcul.com
                </p>
              </section>

              <section>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-4">
                  5. Cookies
                </h2>
                <p>
                  Notre site utilise des cookies pour améliorer l'expérience utilisateur, analyser le trafic et personnaliser le contenu. Vous pouvez contrôler l'acceptation des cookies via les paramètres de votre navigateur.
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
