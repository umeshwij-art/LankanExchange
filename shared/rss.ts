// Minimal RSS 2.0 / Atom item extractor — enough for news headlines,
// without pulling in an XML dependency.

export interface NewsItem {
  title: string;
  link: string;
  summary: string;
  published: string; // ISO
  source: string;
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
}

export function parseFeed(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  for (const b of blocks) {
    const title = tag(b, 'title');
    let link = tag(b, 'link');
    if (!link) link = b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '';
    const dateRaw = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date');
    const d = dateRaw ? new Date(dateRaw) : null;
    if (!title || !/^https?:\/\//.test(link)) continue;
    const summary = (tag(b, 'description') || tag(b, 'summary')).slice(0, 280);
    items.push({ title, link, summary, published: d && !isNaN(+d) ? d.toISOString() : '', source });
  }
  return items;
}
