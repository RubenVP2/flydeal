// ============================================================
// MEILLEUR PRIX — cellule au prix le plus bas d'une fenêtre,
// AVEC sa source. Le badge « Meilleur prix » de la heatmap doit
// rester honnête : un minimum issu d'un relevé simulé ou de
// source inconnue est marqué explicitement (« (simulé) » /
// « (source inconnue) »), jamais présenté comme un prix réel.
// Choix retenu (le plus simple et sûr) : le minimum est calculé
// sur TOUTES les cellules (l'échelle de couleur est inchangée)
// et la mention de source est accolée au badge. Exclure les
// cellules simulées/inconnues du calcul ferait disparaître le
// badge en mode démo (100 % simulé) sans gain de clarté, et
// créerait une incohérence entre le badge et la cellule verte.
// ============================================================

export interface PricedCell {
  price: number;
  provider: string | null; // 'fast-flights' = réel · 'simulation' = fictif · null = source inconnue
}

/** Cellule au prix le plus bas (la première rencontrée en cas d'égalité), null si aucune cellule. */
export function findBestPriceCell<K>(
  cells: Iterable<[K, PricedCell]>,
): { key: K; price: number; provider: string | null } | null {
  let best: { key: K; price: number; provider: string | null } | null = null;
  for (const [key, c] of cells) {
    if (!best || c.price < best.price) best = { key, price: c.price, provider: c.provider };
  }
  return best;
}

/** Mention de source accolée au meilleur prix ; chaîne vide pour un relevé réel. */
export function bestPriceSourceLabel(provider: string | null): string {
  if (provider === 'simulation') return '(simulé)';
  if (provider == null) return '(source inconnue)';
  return '';
}
