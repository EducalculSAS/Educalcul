/** « 1 leçon », « 3 leçons » : singulier pour 0 et 1, pluriel à partir de 2 (règle française). */
export function plural(count: number, singular: string, pluralForm: string = `${singular}s`): string {
  return `${count} ${count >= 2 ? pluralForm : singular}`;
}
