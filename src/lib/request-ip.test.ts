import { describe, it, expect } from 'vitest';
import { clientIp } from './request-ip';

function req(headers: Record<string, string>): Request {
  return new Request('https://intake.zeroindex.ai/api/intake', { headers });
}

describe('clientIp', () => {
  it('trusts x-real-ip over a caller-spoofed x-forwarded-for', () => {
    // attacker prepends a fake hop; x-real-ip is platform-set and must win
    const r = req({ 'x-forwarded-for': '1.2.3.4, 9.9.9.9', 'x-real-ip': '203.0.113.7' });
    expect(clientIp(r)).toBe('203.0.113.7');
  });

  it('falls back to the LAST x-forwarded-for hop (proxy-appended), not the first', () => {
    const r = req({ 'x-forwarded-for': '1.2.3.4, 9.9.9.9' });
    expect(clientIp(r)).toBe('9.9.9.9');
  });

  it('handles a single x-forwarded-for value', () => {
    expect(clientIp(req({ 'x-forwarded-for': '198.51.100.5' }))).toBe('198.51.100.5');
  });

  it('returns "unknown" when no IP headers are present', () => {
    expect(clientIp(req({}))).toBe('unknown');
  });

  it('ignores empty/whitespace hops', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, ,  ' }))).toBe('1.2.3.4');
  });
});
