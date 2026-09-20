/**
 * Menu item id → dish photo URL.
 *
 * The files are named `<id>-<slug>.webp`, so Vite's glob gives us the whole
 * map for free and adding a dish is a matter of dropping a file in. The
 * alternative — a hand-written `{ 1: dosa, 2: idli, ... }` object — is one
 * more place to forget to update.
 *
 * `eager: true` means these are resolved at build time into hashed URLs, not
 * fetched lazily at runtime.
 */

const files = import.meta.glob('./food/*.webp', { eager: true, query: '?url', import: 'default' });

const byId = new Map(
  Object.entries(files).map(([path, url]) => {
    // './food/13-paneer-butter-masala.webp' → 13
    const id = Number(path.split('/').pop().split('-')[0]);
    return [id, url];
  }),
);

/** Returns the photo URL for a menu item, or null when there isn't one yet. */
export function photoFor(id) {
  return byId.get(id) ?? null;
}
