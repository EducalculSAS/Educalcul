import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // `const { motDePasse, ...sansMotDePasse } = x` est la façon d'écrire « tous les champs sauf celui-là » ;
      // un nom qui commence par _ est un paramètre ou une erreur volontairement ignoré.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none", ignoreRestSiblings: true }],
      // `let { a, b } = await req.json()` où seul `b` est réaffecté : on ne signale que si TOUT est constant.
      "prefer-const": ["error", { destructuring: "all" }],
      // Règle du compilateur React (non utilisé ici). Ses cas sont presque tous légitimes dans ce projet : drapeau « monté »
      // contre le décalage d'hydratation, détection d'API du navigateur (window, reconnaissance vocale), chargements de
      // données et remises à zéro quand une propriété change. Les autres règles du compilateur (pureté, refs, composants
      // créés pendant l'affichage, accès avant déclaration) restent actives et sont respectées.
      "react-hooks/set-state-in-effect": "off",
      // Le contenu des cours, exercices et quiz est du JSON libre dont la forme dépend du type de bloc : `any` y est
      // encore très présent. Signalé (warn) sans bloquer ; à typer au fil des évolutions.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
