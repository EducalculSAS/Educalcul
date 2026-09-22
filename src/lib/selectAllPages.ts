/**
 * Toutes les lignes d'une requête, par pages de 1000 : PostgREST plafonne
 * silencieusement un select à 1000 lignes (bug déjà rencontré deux fois sur ce
 * projet — dossiers qui semblaient vides).
 */
export async function selectAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return rows;
}
