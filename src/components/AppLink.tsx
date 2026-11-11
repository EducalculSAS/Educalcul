import NextLink from "next/link";
import type { ComponentProps, ComponentType } from "react";

type NextLinkProps = ComponentProps<typeof NextLink>;
// La propriété existe dans le lien de l'App Router mais pas dans le type public de `next/link`.
const IntentLink = NextLink as unknown as ComponentType<NextLinkProps & { unstable_dynamicOnHover?: boolean }>;

/**
 * Lien des espaces connectés : la page de destination est préchargée EN ENTIER dès que le pointeur survole le lien ou
 * que le doigt le touche (voir `experimental.dynamicOnHover` dans next.config.ts). Au clic, elle s'ouvre directement,
 * sans écran d'attente. `intent={false}` : lien ordinaire (page publique, lien externe).
 */
export default function AppLink({ intent = true, ...props }: NextLinkProps & { intent?: boolean }) {
  return <IntentLink unstable_dynamicOnHover={intent} {...props} />;
}
