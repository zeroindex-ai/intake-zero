import { describe, it, expect } from 'vitest';
import { isPublicAddress, assertPublicUrl } from './safe-fetch';

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
});
