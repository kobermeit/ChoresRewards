function decodeEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
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

  const parts = host.split('.');
  const name = parts[0] || 'Store';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function cleanTitle(rawTitle: string, storeName: string): string {
  let t = decodeEntities(rawTitle);
  // Remove common retail suffixes
  t = t.replace(/\s*:\s*Amazon\.[a-z.]+(?::.*)?$/i, '');
  t = t.replace(/^Amazon\.[a-z.]+\s*:\s*/i, '');
  t = t.replace(/\s*\|\s*Kmart Australia$/i, '');
  t = t.replace(/\s*\|\s*Kmart$/i, '');
  t = t.replace(/\s*-\s*Target Australia$/i, '');
  t = t.replace(/\s*\|\s*Target$/i, '');
  t = t.replace(/\s*\|\s*Big W$/i, '');
  t = t.replace(/\s*\|\s*JB Hi-Fi$/i, '');
  t = t.replace(/\s*\|\s*Official LEGO®? Shop.*$/i, '');
  t = t.replace(/\s*\|\s*eBay$/i, '');

  // Truncate overly long Amazon titles (e.g. 150+ chars of SEO keywords)
  if (t.length > 85) {
    const commaIdx = t.indexOf(',');
    const pipeIdx = t.indexOf('|');
    const dashIdx = t.indexOf(' - ');
    const breakIdx = [commaIdx, pipeIdx, dashIdx].filter((idx) => idx > 25 && idx < 85)[0];
    if (breakIdx) {
      t = t.slice(0, breakIdx).trim();
    } else {
      t = t.slice(0, 85).trim() + '…';
    }
  }

  return t || `${storeName} Reward`;
}

function cleanDescription(rawDesc: string): string {
  let d = decodeEntities(rawDesc);
  // Strip any HTML tags
  d = d.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (d.length > 130) {
    // Cut at sentence or word
    const periodIdx = d.indexOf('. ', 40);
    if (periodIdx !== -1 && periodIdx <= 130) {
      d = d.slice(0, periodIdx + 1).trim();
    } else {
      d = d.slice(0, 127).trim() + '…';
    }
  }
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
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);

    const res = await fetch(urlObj.toString(), {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-AU,en-US;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      html = await res.text();
    }
  } catch (err) {
    console.warn(`[scrapeRewardUrl] Fetch warning for ${rawUrl}:`, err);
  }

  let title = '';
  let description = '';
  let imageUrl: string | null = null;
  let price: number | null = null;

  if (html) {
    // 1. Title
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    const twitterTitleMatch = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
    const tagTitleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    const rawTitle = ogTitleMatch?.[1] || twitterTitleMatch?.[1] || tagTitleMatch?.[1] || '';
    title = cleanTitle(rawTitle, storeName);

    // 2. Description
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

    const rawDesc = ogDescMatch?.[1] || metaDescMatch?.[1] || '';
    description = cleanDescription(rawDesc);

    // 3. Image
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
      || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i);

    if (ogImageMatch?.[1]) {
      const rawImg = ogImageMatch[1].trim();
      try {
        imageUrl = new URL(rawImg, urlObj.origin).toString();
      } catch {
        imageUrl = rawImg;
      }
    }

    // 4. Price extraction
    // Check JSON-LD
    const jsonLdBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdBlocks) {
      for (const block of jsonLdBlocks) {
        const jsonContent = block.replace(/<script[^>]*>|<\/script>/gi, '').trim();
        try {
          const parsed = JSON.parse(jsonContent);
          const findPrice = (obj: any): number | null => {
            if (!obj || typeof obj !== 'object') return null;
            if (obj.price && !isNaN(Number(obj.price))) return Number(obj.price);
            if (obj.offers) {
              if (Array.isArray(obj.offers)) {
                for (const o of obj.offers) {
                  if (o?.price && !isNaN(Number(o.price))) return Number(o.price);
                }
              } else if (obj.offers.price && !isNaN(Number(obj.offers.price))) {
                return Number(obj.offers.price);
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
          const p = findPrice(parsed);
          if (p !== null && p > 0) {
            price = p;
            break;
          }
        } catch {
          // JSON-LD might contain syntax errors or multiple scripts; ignore parse fail
        }
      }
    }

    // Check meta tags if JSON-LD didn't have price
    if (price === null) {
      const priceMeta = html.match(/<meta[^>]+property=["'](?:product:price:amount|og:price:amount)["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["'](?:product:price:amount|og:price:amount)["']/i);
      if (priceMeta?.[1] && !isNaN(Number(priceMeta[1]))) {
        price = Number(priceMeta[1]);
      }
    }

    // Amazon price fallbacks
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

  if (!title) {
    title = `${storeName} Item`;
  }

  // Calculate points
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
