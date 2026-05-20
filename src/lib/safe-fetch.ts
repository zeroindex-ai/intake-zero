import { isIP, type LookupFunction } from 'node:net';
import { lookup } from 'node:dns/promises';
import { Agent } from 'undici';

export type ResolvedAddress = { address: string; family: number };

// Blocked IPv4 CIDR ranges: loopback, private, link-local (incl. the cloud
// metadata host 169.254.169.254), CGNAT, multicast, and reserved space.
const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

function v4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let acc = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    acc = acc * 256 + n;
  }
  return acc >>> 0;
}

function v4InBlockedRange(ip: string): boolean {
  const addr = v4ToInt(ip);
  if (addr === null) return true; // unparseable → treat as unsafe
  return BLOCKED_V4.some(([base, bits]) => {
    const baseInt = v4ToInt(base);
    if (baseInt === null) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (addr & mask) === (baseInt & mask);
  });
}

// Expand an IPv6 literal to 16 bytes, resolving "::" compression and any
// trailing embedded IPv4 (e.g. ::ffff:1.2.3.4). Returns null if unparseable.
function v6ToBytes(ip: string): number[] | null {
  let str = ip;
  const zone = str.indexOf('%');
  if (zone !== -1) str = str.slice(0, zone); // strip scope id

  // Rewrite a trailing embedded IPv4 (e.g. ::ffff:1.2.3.4) into two hextets so
  // the rest of the expansion is uniform.
  const lastColon = str.lastIndexOf(':');
  const tail = str.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4 = v4ToInt(tail);
    if (v4 === null) return null;
    const hi = ((v4 >>> 16) & 0xffff).toString(16);
    const lo = (v4 & 0xffff).toString(16);
    str = str.slice(0, lastColon + 1) + `${hi}:${lo}`;
  }

  const halves = str.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tailGroups = halves.length === 2 && halves[1] ? halves[1].split(':') : [];

  const toBytes = (groups: string[]): number[] | null => {
    const out: number[] = [];
    for (const g of groups) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
      const n = parseInt(g, 16);
      out.push((n >>> 8) & 0xff, n & 0xff);
    }
    return out;
  };

  const headBytes = toBytes(head);
  const tailBytes = toBytes(tailGroups);
  if (headBytes === null || tailBytes === null) return null;

  let bytes: number[];
  if (halves.length === 2) {
    const fill = 16 - headBytes.length - tailBytes.length;
    if (fill < 0) return null;
    bytes = [...headBytes, ...new Array(fill).fill(0), ...tailBytes];
  } else {
    bytes = headBytes;
  }
  return bytes.length === 16 ? bytes : null;
}

function v6InBlockedRange(ip: string): boolean {
  const b = v6ToBytes(ip);
  if (b === null) return true; // unparseable → treat as unsafe

  // IPv4-mapped (::ffff:0:0/96) → validate the embedded v4 instead.
  const mappedPrefix = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff];
  if (mappedPrefix.every((v, i) => b[i] === v)) {
    return v4InBlockedRange(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`);
  }

  const isAll = (n: number) => b.every((v) => v === n);
  if (isAll(0)) return true; // unspecified ::
  if (b.slice(0, 15).every((v) => v === 0) && b[15] === 1) return true; // loopback ::1
  if ((b[0] & 0xfe) === 0xfc) return true; // ULA fc00::/7
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true; // link-local fe80::/10
  return false;
}

export function isPublicAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return !v4InBlockedRange(ip);
  if (kind === 6) return !v6InBlockedRange(ip);
  return false; // not a valid IP literal
}

// Resolve a hostname and require every returned address to be public. Returns
// the validated URL together with the resolved addresses (so the caller can
// connect to exactly those — see safeFetch). Rejects non-http(s) schemes.
export async function assertPublicUrl(
  raw: string,
): Promise<{ url: URL; addresses: ResolvedAddress[] }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('invalid url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`blocked scheme: ${url.protocol}`);
  }

  const host = url.hostname;
  if (isIP(host)) {
    if (!isPublicAddress(host)) throw new Error('blocked: non-public IP literal');
    return { url, addresses: [{ address: host, family: isIP(host) }] };
  }

  const addrs = await lookup(host, { all: true });
  if (addrs.length === 0) throw new Error('blocked: host did not resolve');
  for (const { address } of addrs) {
    if (!isPublicAddress(address))
      throw new Error(`blocked: ${host} resolves to non-public ${address}`);
  }
  return { url, addresses: addrs.map((a) => ({ address: a.address, family: a.family })) };
}

// A dns.lookup replacement that always returns the pre-validated addresses,
// ignoring the hostname. Pinning the connection to these exact addresses closes
// the DNS-rebinding TOCTOU: without it, fetch would re-resolve the hostname and
// could connect to an internal IP that appeared public microseconds earlier.
export function pinnedLookup(addresses: ResolvedAddress[]): LookupFunction {
  return ((_hostname, options, callback) => {
    const all =
      typeof options === 'object' && options !== null && (options as { all?: boolean }).all;
    if (all) {
      (callback as unknown as (e: NodeJS.ErrnoException | null, a: ResolvedAddress[]) => void)(
        null,
        addresses,
      );
    } else {
      const first = addresses[0]!;
      callback(null, first.address, first.family);
    }
  }) as LookupFunction;
}

type SafeFetchOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRedirects?: number;
};

// Fetch a user-supplied URL with SSRF protection. Each hop is validated, and
// the TCP connection is pinned to the validated IP (the Host header and TLS SNI
// remain the hostname, so HTTPS still verifies). Redirects are followed manually
// so every hop is re-validated and re-pinned — neither a redirect nor a DNS
// rebind can bounce the connection to an internal address.
export async function safeFetch(raw: string, opts: SafeFetchOptions = {}): Promise<Response> {
  const { headers, timeoutMs = 8_000, maxRedirects = 3 } = opts;
  let current = raw;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const { url, addresses } = await assertPublicUrl(current);
    // One dispatcher per hop, pinned to the validated IP. It's always closed in
    // the finally — for the final hop we buffer the body first so the returned
    // Response outlives the dispatcher and no keep-alive socket leaks.
    const dispatcher = new Agent({ connect: { lookup: pinnedLookup(addresses) } });
    try {
      const res = await fetch(url, {
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        dispatcher,
      } as RequestInit);

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (location) {
          current = new URL(location, url).toString();
          continue;
        }
      }
      return new Response(await res.arrayBuffer(), {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    } finally {
      await dispatcher.close();
    }
  }
  throw new Error('too many redirects');
}
