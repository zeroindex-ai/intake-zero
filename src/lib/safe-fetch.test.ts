import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isPublicAddress, assertPublicUrl, pinnedLookup, safeFetch } from './safe-fetch';

describe('isPublicAddress', () => {
  it('accepts ordinary public IPv4', () => {
    expect(isPublicAddress('1.1.1.1')).toBe(true);
    expect(isPublicAddress('8.8.8.8')).toBe(true);
    expect(isPublicAddress('93.184.216.34')).toBe(true);
  });

  it('blocks the cloud metadata address and link-local range', () => {
    expect(isPublicAddress('169.254.169.254')).toBe(false);
    expect(isPublicAddress('169.254.0.1')).toBe(false);
  });

  it('blocks loopback, private, and CGNAT IPv4 ranges', () => {
    expect(isPublicAddress('127.0.0.1')).toBe(false);
    expect(isPublicAddress('10.0.0.5')).toBe(false);
    expect(isPublicAddress('172.16.0.1')).toBe(false);
    expect(isPublicAddress('172.31.255.255')).toBe(false);
    expect(isPublicAddress('192.168.1.1')).toBe(false);
    expect(isPublicAddress('100.64.0.1')).toBe(false);
    expect(isPublicAddress('0.0.0.0')).toBe(false);
  });

  it('keeps 172.32.x.x (just outside the private /12) public', () => {
    expect(isPublicAddress('172.32.0.1')).toBe(true);
  });

  it('blocks IPv6 loopback, unspecified, ULA, and link-local', () => {
    expect(isPublicAddress('::1')).toBe(false);
    expect(isPublicAddress('::')).toBe(false);
    expect(isPublicAddress('fc00::1')).toBe(false);
    expect(isPublicAddress('fd12:3456::1')).toBe(false);
    expect(isPublicAddress('fe80::1')).toBe(false);
  });

  it('accepts a public IPv6 address', () => {
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
  });

  it('blocks IPv4-mapped IPv6 that wraps a private address', () => {
    expect(isPublicAddress('::ffff:127.0.0.1')).toBe(false);
    expect(isPublicAddress('::ffff:10.0.0.1')).toBe(false);
  });

  it('rejects non-IP strings', () => {
    expect(isPublicAddress('not-an-ip')).toBe(false);
    expect(isPublicAddress('999.999.999.999')).toBe(false);
  });
});

describe('assertPublicUrl', () => {
  it('rejects non-http(s) schemes', async () => {
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow(/blocked scheme/);
    await expect(assertPublicUrl('ftp://example.com')).rejects.toThrow(/blocked scheme/);
  });

  it('rejects a non-public IP literal host without a DNS lookup', async () => {
    await expect(assertPublicUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
      /non-public IP literal/,
    );
    await expect(assertPublicUrl('http://127.0.0.1:8080/')).rejects.toThrow(
      /non-public IP literal/,
    );
  });

  it('rejects malformed URLs', async () => {
    await expect(assertPublicUrl('not a url')).rejects.toThrow(/invalid url/);
  });

  it('returns the validated address for a public IP literal (no DNS lookup)', async () => {
    const out = await assertPublicUrl('https://1.1.1.1/path');
    expect(out.url.hostname).toBe('1.1.1.1');
    expect(out.addresses).toEqual([{ address: '1.1.1.1', family: 4 }]);
  });
});

describe('pinnedLookup', () => {
  // The connection must resolve to the pre-validated address regardless of what
  // the hostname would now resolve to — this is what defeats DNS rebinding.
  const call = (fn: ReturnType<typeof pinnedLookup>, options: unknown) => {
    const cb = vi.fn();
    (fn as (h: string, o: unknown, c: unknown) => void)('rebind.attacker.test', options, cb);
    return cb;
  };

  it('returns every validated address in all:true mode, ignoring the hostname', () => {
    const fn = pinnedLookup([{ address: '93.184.216.34', family: 4 }]);
    expect(call(fn, { all: true })).toHaveBeenCalledWith(null, [
      { address: '93.184.216.34', family: 4 },
    ]);
  });

  it('returns the first address in single-lookup mode', () => {
    const fn = pinnedLookup([{ address: '93.184.216.34', family: 4 }]);
    expect(call(fn, {})).toHaveBeenCalledWith(null, '93.184.216.34', 4);
  });
});

describe('safeFetch (redirect, re-validation, cap)', () => {
  // Mock global fetch and use IP-literal URLs (no DNS) so the redirect loop and
  // per-hop SSRF re-validation are exercised deterministically, offline.
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const redirectTo = (location: string) =>
    new Response(null, { status: 302, headers: { location } });
  const ok = (body: string) => new Response(body, { status: 200 });

  it('follows a redirect, re-validates each hop, and returns the final body', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectTo('http://1.1.1.1/next'))
      .mockResolvedValueOnce(ok('hello world'));
    const res = await safeFetch('http://93.184.216.34/start', { maxBytes: 1_000 });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('hello world');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a redirect that points at a non-public address', async () => {
    fetchMock.mockResolvedValueOnce(redirectTo('http://127.0.0.1/internal'));
    await expect(safeFetch('http://93.184.216.34/start')).rejects.toThrow(/non-public IP literal/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('enforces the redirect limit', async () => {
    fetchMock.mockResolvedValue(redirectTo('http://1.1.1.1/loop'));
    await expect(safeFetch('http://93.184.216.34/start', { maxRedirects: 2 })).rejects.toThrow(
      /too many redirects/,
    );
  });

  it('caps the body at maxBytes even when it arrives in one chunk', async () => {
    fetchMock.mockResolvedValueOnce(ok('x'.repeat(5_000)));
    const res = await safeFetch('http://93.184.216.34/big', { maxBytes: 100 });
    expect((await res.text()).length).toBe(100);
  });
});
