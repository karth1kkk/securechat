/**
 * Giphy GIF Search API (public beta key is bundled in client — use env + dashboard restrictions).
 * @see https://developers.giphy.com/docs/api/endpoint#search
 */

const BASE = 'https://api.giphy.com/v1/gifs';

export type GiphyGifItem = {
  id: string;
  title: string;
  /** Direct GIF URL suitable for {@link serializeRichMessage} `type: 'gif'` */
  gifUrl: string;
  /** Thumbnail for picker grid */
  previewUrl: string;
};

type Img = { url?: string };

type GiphyImages = {
  downsized_medium?: Img;
  fixed_height?: Img;
  downsized?: Img;
  original?: Img;
  fixed_width_small?: Img;
  preview_gif?: Img;
};

type GiphyRaw = {
  id: string;
  title?: string;
  images?: GiphyImages;
};

function pickSendUrl(images: GiphyImages | undefined): string | undefined {
  if (!images) {
    return undefined;
  }
  return (
    images.downsized_medium?.url ||
    images.fixed_height?.url ||
    images.downsized?.url ||
    images.original?.url
  );
}

function pickPreviewUrl(images: GiphyImages | undefined, fallbackGif: string | undefined): string {
  if (!images) {
    return fallbackGif ?? '';
  }
  return (
    images.fixed_width_small?.url ||
    images.preview_gif?.url ||
    images.downsized?.url ||
    fallbackGif ||
    ''
  );
}

function mapItem(raw: GiphyRaw): GiphyGifItem | null {
  const gifUrl = pickSendUrl(raw.images);
  if (!gifUrl) {
    return null;
  }
  const previewUrl = pickPreviewUrl(raw.images, gifUrl);
  return {
    id: raw.id,
    title: (raw.title ?? '').trim() || 'GIF',
    gifUrl,
    previewUrl: previewUrl || gifUrl
  };
}

async function parseList(res: Response): Promise<GiphyGifItem[]> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Giphy HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: GiphyRaw[] };
  const list = json.data ?? [];
  return list.map(mapItem).filter((x): x is GiphyGifItem => x !== null);
}

export async function giphyTrending(apiKey: string): Promise<GiphyGifItem[]> {
  const url = new URL(`${BASE}/trending`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('limit', '30');
  url.searchParams.set('rating', 'pg-13');
  const res = await fetch(url.toString());
  return parseList(res);
}

export async function giphySearch(apiKey: string, query: string): Promise<GiphyGifItem[]> {
  const q = query.trim();
  if (!q) {
    return giphyTrending(apiKey);
  }
  const url = new URL(`${BASE}/search`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '30');
  url.searchParams.set('rating', 'pg-13');
  url.searchParams.set('lang', 'en');
  const res = await fetch(url.toString());
  return parseList(res);
}
