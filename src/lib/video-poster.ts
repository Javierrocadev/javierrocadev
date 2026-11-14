/** Optimize video covers without changing full-size project images. */
export function getVideoPoster(src?: string): string | undefined {
  if (!src) return undefined;
  const url = new URL(src);
  if (url.hostname !== 'cdn.sanity.io' || !url.pathname.startsWith('/images/')) return src;
  url.searchParams.set('auto', 'format');
  url.searchParams.set('w', '1200');
  url.searchParams.set('q', '75');
  url.searchParams.set('fit', 'max');
  return url.toString();
}
