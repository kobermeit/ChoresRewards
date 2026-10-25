const NAMED_ENTITIES: Record<string, string> = {
  // Dashes, hyphens & horizontal bars
  ndash: '–',
  mdash: '—',
  minus: '−',
  hyphen: '‐',
  horbar: '―',

  // Quotes & apostrophes
  quot: '"',
  apos: "'",
  lsquo: '‘',
  rsquo: '’',
  sbquo: '‚',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  laquo: '«',
  raquo: '»',
  prime: '′',
  Prime: '″',

  // Common symbols & marks
  amp: '&',
  lt: '<',
  gt: '>',
  nbsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  bull: '•',
  hellip: '…',
  middot: '·',
  cent: '¢',
  pound: '£',
  euro: '€',
  yen: '¥',
  deg: '°',
  plusmn: '±',
  times: '×',
  divide: '÷',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  check: '✓',
  cross: '✗',
  star: '★',
  sect: '§',
  para: '¶',
};

export function decodeEntities(str: string): string {
  if (!str) return '';
  let result = String(str);

  // Perform up to 2 passes to handle double-escaped entities (e.g., &amp;ndash; -> &ndash; -> –)
  for (let pass = 0; pass < 2; pass++) {
    if (!result.includes('&')) break;

    // 1. Decimal entities: &#1234; or &#1234
    result = result.replace(/&#(\d+);?/g, (_, code) => {
      const n = Number(code);
      if (Number.isFinite(n) && n > 0 && n <= 0x10ffff) {
        try {
          return String.fromCodePoint(n);
        } catch {
          return String.fromCharCode(n);
        }
      }
      return _;
    });

    // 2. Hexadecimal entities: &#x1a2f; or &#X1A2F;
    result = result.replace(/&#x([0-9a-fA-F]+);?/gi, (_, hex) => {
      const n = parseInt(hex, 16);
      if (Number.isFinite(n) && n > 0 && n <= 0x10ffff) {
        try {
          return String.fromCodePoint(n);
        } catch {
          return String.fromCharCode(n);
        }
      }
      return _;
    });

    // 3. Named entities: &name; or &name
    result = result.replace(/&([a-zA-Z0-9]+);?/g, (match, entityName) => {
      const lower = entityName.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, lower)) {
        return NAMED_ENTITIES[lower];
      }
      return match;
    });
  }

  // Normalize Unicode non-breaking space (U+00A0) and exotic whitespace characters to regular spaces
  result = result.replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, ' ');

  return result.trim();
}

function deriveStoreName(hostname: string): string {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  if (host.includes('amazon.')) return 'Amazon';
  if (host.includes('target.')) return 'Target';
  if (host.includes('kmart.')) return 'Kmart';
  if (host.includes('bigw.')) return 'Big W';
  if (host.includes('jbhifi.')) return 'JB Hi-Fi';
  if (host.includes('ebgames.')) return 'EB Games';
  if (host.includes('lego.')) return 'LEGO';
  if (host.includes('coles.')) return 'Coles';
  if (host.includes('woolworths.')) return 'Woolworths';
  if (host.includes('ebay.')) return 'eBay';
  if (host.includes('bunnings.')) return 'Bunnings';
  if (host.includes('officeworks.')) return 'Officeworks';
  if (host.includes('apple.')) return 'Apple';
  if (host.includes('walmart.')) return 'Walmart';
  if (host.includes('etsy.')) return 'Etsy';
  if (host.includes('playmate')) return 'Playmate';

  const parts = host.split('.');
  const name = parts[0] || 'Store';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function cleanTitle(rawTitle: string, storeName: string): string {
  let t = decodeEntities(rawTitle);
  // Remove common retail suffixes
  t = t.replace(/\s*:\s*Amazon\.[a-z.]+(?::.*)?$/i, '');
  t = t.replace(/^Amazon\.[a-z.]+\s*:\s*/i, '');
  t = t.replace(/\s*\|\s*Kmart Australia$/i, '');
  t = t.replace(/\s*-\s*Kmart\s*$/i, '');
  t = t.replace(/\s*\|\s*Kmart$/i, '');
  t = t.replace(/\s*-\s*Target Australia$/i, '');
  t = t.replace(/\s*\|\s*Target$/i, '');
  t = t.replace(/\s*\|\s*Big W$/i, '');
  t = t.replace(/\s*-\s*Big W$/i, '');
  t = t.replace(/\s*\|\s*JB Hi-Fi$/i, '');
  t = t.replace(/\s*\|\s*Official LEGO®? Shop.*$/i, '');
  t = t.replace(/\s*\|\s*eBay$/i, '');
  t = t.replace(/\s*-\s*ASSORTED\s*-\s*NO SIZE/i, '');

  // Normalize duplicate whitespace
  t = t.replace(/\s+/g, ' ').trim();

  // Truncate overly long retail titles (e.g. 150+ chars of SEO keywords)
  if (t.length > 85) {
    const commaIdx = t.indexOf(',');
    const pipeIdx = t.indexOf('|');
    const dashes = [' - ', ' – ', ' — '];
    let dashIdx = -1;
    for (const d of dashes) {
      const idx = t.indexOf(d);
      if (idx !== -1 && (dashIdx === -1 || idx < dashIdx)) {
        dashIdx = idx;
      }
    }
    const candidates = [commaIdx, pipeIdx, dashIdx].filter((idx) => idx > 25 && idx < 85);
    const breakIdx = candidates.length > 0 ? Math.min(...candidates) : -1;
    if (breakIdx > 0) {
      t = t.slice(0, breakIdx).trim();
    } else {
      t = t.slice(0, 85).trim() + '…';
    }
  }

  // Remove any trailing dashes or punctuation left behind after trimming
  t = t.replace(/[\s\-_–—|:;,]+$/, '').trim();

  return t || `${storeName} Reward`;
}

export function cleanDescription(rawDesc: string): string {
  let d = decodeEntities(rawDesc);
  d = d.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  d = d.replace(/^\*Each sold separately\s*/i, '');
  // Remove common retail suffixes from descriptions
  d = d.replace(/\s*:\s*Amazon\.[a-z.]+(?::.*)?$/i, '');
  d = d.replace(/\s*\|\s*Kmart Australia$/i, '');
  d = d.replace(/\s*-\s*Kmart\s*$/i, '');
  d = d.replace(/\s*\|\s*Target.*$/i, '');
  d = d.replace(/\s*\|\s*Big W.*$/i, '');

  if (d.length > 130) {
    const periodIdx = d.indexOf('. ', 40);
    if (periodIdx !== -1 && periodIdx <= 130) {
      d = d.slice(0, periodIdx + 1).trim();
    } else {
      let sliced = d.slice(0, 127).trim();
      sliced = sliced.replace(/[\s\-_–—|:;,]+$/, '').trim();
      d = sliced + '…';
    }
  } else {
    d = d.replace(/[\s\-_–—|:;,]+$/, '').trim();
  }
  // Clean up any trailing ":…" or "-…" artifacts
  d = d.replace(/[:;,–—\-]\s*…$/, '…').trim();
  return d;
}

export interface ScrapedRewardInfo {
  title: string;
  description: string;
  image_url: string | null;
  price: number | null;
  points: number;
  source_url: string;
  source_name: string;
}

export async function scrapeRewardUrl(rawUrl: string, pointValue: number = 0.50): Promise<ScrapedRewardInfo> {
  const urlObj = new URL(rawUrl);
  const storeName = deriveStoreName(urlObj.hostname);

  let html = '';
  // Try crawler user agent first (whitelisted by Akamai on Kmart, Target, etc.)
  // and fall back to standard browser user agent
  const userAgents = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  ];

  for (const ua of userAgents) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7500);

      const res = await fetch(urlObj.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': ua,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-AU,en-US;q=0.9,en;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const text = await res.text();
        if (text.length > 1000 && !text.includes('Access Denied')) {
          html = text;
          break;
        }
      }
    } catch (err) {
      console.warn(`[scrapeRewardUrl] Fetch warning with UA for ${rawUrl}:`, err);
    }
  }

  let title = '';
  let description = '';
  let imageUrl: string | null = null;
  let price: number | null = null;

  if (html) {
    // 1. Check JSON-LD (Schema.org Product data)
    const jsonLdBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdBlocks) {
      for (const block of jsonLdBlocks) {
        const jsonContent = block.replace(/<script[^>]*>|<\/script>/gi, '').trim();
        try {
          const parsed = JSON.parse(jsonContent);
          const items = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed['@graph'])
            ? parsed['@graph']
            : [parsed];

          for (const item of items) {
            const isProduct =
              item['@type'] === 'Product' ||
              (Array.isArray(item['@type']) && item['@type'].includes('Product'));

            if (isProduct) {
              if (item.name && !title) title = String(item.name);
              if (item.description && !description) description = String(item.description);
              if (item.image && !imageUrl) {
                if (typeof item.image === 'string') imageUrl = item.image;
                else if (Array.isArray(item.image) && item.image[0]) {
                  imageUrl = typeof item.image[0] === 'string' ? item.image[0] : item.image[0].url || null;
                } else if (item.image.url) {
                  imageUrl = item.image.url;
                }
              }
            }

            const findPrice = (obj: any): number | null => {
              if (!obj || typeof obj !== 'object') return null;
              if (obj.price && !isNaN(Number(obj.price))) return Number(obj.price);
              if (obj.lowPrice && !isNaN(Number(obj.lowPrice))) return Number(obj.lowPrice);
              if (obj.highPrice && !isNaN(Number(obj.highPrice))) return Number(obj.highPrice);
              if (obj.offers) {
                if (Array.isArray(obj.offers)) {
                  for (const o of obj.offers) {
                    if (o?.price && !isNaN(Number(o.price))) return Number(o.price);
                    if (o?.lowPrice && !isNaN(Number(o.lowPrice))) return Number(o.lowPrice);
                  }
                } else if (typeof obj.offers === 'object') {
                  if (obj.offers.price && !isNaN(Number(obj.offers.price))) return Number(obj.offers.price);
                  if (obj.offers.lowPrice && !isNaN(Number(obj.offers.lowPrice))) return Number(obj.offers.lowPrice);
                  if (obj.offers.highPrice && !isNaN(Number(obj.offers.highPrice))) return Number(obj.offers.highPrice);
                }
              }
              for (const key of Object.keys(obj)) {
                if (typeof obj[key] === 'object') {
                  const found = findPrice(obj[key]);
                  if (found !== null) return found;
                }
              }
              return null;
            };

            const p = findPrice(item);
            if (p !== null && p > 0 && price === null) {
              price = p;
            }
          }
        } catch {
          // JSON-LD might contain syntax errors or non-standard scripts; ignore
        }
      }
    }

    // 2. OpenGraph / Meta Title
    if (!title) {
      const ogTitleMatch =
        html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
      const twitterTitleMatch = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
      const tagTitleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

      const rawTitle = ogTitleMatch?.[1] || twitterTitleMatch?.[1] || tagTitleMatch?.[1] || '';
      title = cleanTitle(rawTitle, storeName);
    } else {
      title = cleanTitle(title, storeName);
    }

    // 3. OpenGraph / Meta Description
    if (!description) {
      const ogDescMatch =
        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
      const metaDescMatch =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

      const rawDesc = ogDescMatch?.[1] || metaDescMatch?.[1] || '';
      description = cleanDescription(rawDesc);
    } else {
      description = cleanDescription(description);
    }

    // 4. OpenGraph / Meta Image
    if (!imageUrl) {
      const ogImageMatch =
        html.match(/<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
        html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i);

      if (ogImageMatch?.[1]) {
        const rawImg = ogImageMatch[1].trim();
        try {
          imageUrl = new URL(rawImg, urlObj.origin).toString();
        } catch {
          imageUrl = rawImg;
        }
      }
    }

    // 5. Price Meta Fallbacks
    if (price === null) {
      const priceMeta =
        html.match(/<meta[^>]+property=["'](?:product:price:amount|og:price:amount)["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["'](?:product:price:amount|og:price:amount)["']/i);
      if (priceMeta?.[1] && !isNaN(Number(priceMeta[1]))) {
        price = Number(priceMeta[1]);
      }
    }

    // 6. Amazon Price Fallbacks
    if (price === null && (urlObj.hostname.includes('amazon.') || html.includes('a-price'))) {
      const wholeMatch = html.match(/class=["']a-price-whole["']>([0-9,]+)/i);
      const fracMatch = html.match(/class=["']a-price-fraction["']>([0-9]+)/i);
      if (wholeMatch?.[1]) {
        const whole = wholeMatch[1].replace(/,/g, '');
        const frac = fracMatch?.[1] || '00';
        const parsedAmzPrice = Number(`${whole}.${frac}`);
        if (!isNaN(parsedAmzPrice) && parsedAmzPrice > 0) {
          price = parsedAmzPrice;
        }
      }
    }
  }

  // 7. URL Slug Fallback for Title
  if (!title || title === `${storeName} Item`) {
    const amazonSlugMatch = urlObj.pathname.match(/^\/([^/]+)\/dp\/[a-zA-Z0-9]+/i);
    const slugMatch = urlObj.pathname.match(/\/(?:product|p|item|dp)\/([a-zA-Z0-9_-]+)/i);
    const rawSlug = amazonSlugMatch?.[1] || slugMatch?.[1];

    if (rawSlug) {
      const cleanSlug = rawSlug.replace(/-\d+$/, '').replace(/[-_]/g, ' ');
      title = cleanSlug
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  }

  if (!title) {
    title = `${storeName} Item`;
  }

  // Calculate points from price and configured point value
  const pv = pointValue > 0 ? pointValue : 0.50;
  const points = price && price > 0 ? Math.ceil(price / pv) : 10;

  return {
    title,
    description,
    image_url: imageUrl,
    price,
    points,
    source_url: urlObj.toString(),
    source_name: storeName,
  };
}
