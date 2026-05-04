import type { GiphyGifItem } from './giphyApi';

/** Curated CDN URLs — no API key. Lets the picker always show tappable GIFs. */
function giphyCdn(id: string, title: string): GiphyGifItem {
  const gifUrl = `https://media.giphy.com/media/${id}/giphy.gif`;
  return { id: `static-${id}`, title, gifUrl, previewUrl: gifUrl };
}

export const STATIC_GIF_PICKER_ITEMS: GiphyGifItem[] = [
  giphyCdn('JIX9t2j0ZTN9S', 'Keyboard cat'),
  giphyCdn('5GoVLqeAOo6PK', 'Applause'),
  giphyCdn('26BRvoyThCJ7PolcQ', 'Mind blown'),
  giphyCdn('ICOgUNjpvO0l9ccWg', 'Nice'),
  giphyCdn('mq5y2jHNB0ZEvVe95', 'Confused'),
  giphyCdn('l3q2K5jinAlCdCLS9', 'Celebrate'),
  giphyCdn('g9582DNuWppkelCFa', 'Relieved'),
  giphyCdn('yJFeycuhJgqOGvK1zg', 'Thumbs up'),
  giphyCdn('blSTtZehdjZS6Borf', 'Sad'),
  giphyCdn('3o7aCTPPm4OHfRLSH6', 'Happy dance'),
  giphyCdn('xUO4t2gkWB411n4LWw', 'Slow clap'),
  giphyCdn('mokFAJMS2myPglsTu', 'Heart'),
  giphyCdn('d2Za4w8nOSNQcgFK', 'Shrug'),
  giphyCdn('3ohzdJYVrEW68PDSQ8', 'Party time')
];

export function filterStaticGifs(query: string): GiphyGifItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return STATIC_GIF_PICKER_ITEMS;
  }
  return STATIC_GIF_PICKER_ITEMS.filter((item) => item.title.toLowerCase().includes(q));
}
