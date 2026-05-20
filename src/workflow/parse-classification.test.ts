import { describe, it, expect } from 'vitest';
import { parseClassification } from './parse-classification';

describe('parseClassification', () => {
  it('parses a well-formed bare JSON response', () => {
    const raw = JSON.stringify({
      engagementType: 'build',
      fitScore: 4,
      rationale: 'Strong signal in problem statement; matches RAG specialty.',
      suggestedCaseStudies: ['ask-zeroindex'],
    });
    const out = parseClassification(raw);
    expect(out).toEqual({
      engagementType: 'build',
      fitScore: 4,
      rationale: 'Strong signal in problem statement; matches RAG specialty.',
      suggestedCaseStudies: ['ask-zeroindex'],
    });
  });

  it('parses JSON wrapped in a ```json fence', () => {
    const raw =
      '```json\n{"engagementType":"advisory","fitScore":3,"rationale":"ok","suggestedCaseStudies":[]}\n```';
    expect(parseClassification(raw).engagementType).toBe('advisory');
    expect(parseClassification(raw).fitScore).toBe(3);
  });

  it('parses JSON wrapped in a bare ``` fence', () => {
    const raw =
      '```\n{"engagementType":"audit","fitScore":2,"rationale":"x","suggestedCaseStudies":[]}\n```';
    expect(parseClassification(raw).engagementType).toBe('audit');
  });

  it('extracts JSON when surrounded by prose', () => {
    const raw =
      'Sure — here is the result:\n{"engagementType":"training","fitScore":1,"rationale":"r","suggestedCaseStudies":[]}\nLet me know if you need more.';
    expect(parseClassification(raw).engagementType).toBe('training');
  });

  it('clamps fitScore to 0-5 and coerces non-integers', () => {
    const raw = JSON.stringify({
      engagementType: 'build',
      fitScore: 99,
      rationale: 'r',
      suggestedCaseStudies: [],
    });
    expect(parseClassification(raw).fitScore).toBe(5);

    const negative = JSON.stringify({
      engagementType: 'build',
      fitScore: -3,
      rationale: 'r',
      suggestedCaseStudies: [],
    });
    expect(parseClassification(negative).fitScore).toBe(0);

    const floaty = JSON.stringify({
      engagementType: 'build',
      fitScore: 3.7,
      rationale: 'r',
      suggestedCaseStudies: [],
    });
    expect(parseClassification(floaty).fitScore).toBe(3);
  });

  it('falls back to "unclear" for an unknown engagementType', () => {
    const raw = JSON.stringify({
      engagementType: 'unicorn-wrangling',
      fitScore: 2,
      rationale: 'r',
      suggestedCaseStudies: [],
    });
    expect(parseClassification(raw).engagementType).toBe('unclear');
  });

  it('defaults to "unclear" + empty arrays when fields are missing', () => {
    const raw = '{}';
    const out = parseClassification(raw);
    expect(out.engagementType).toBe('unclear');
    expect(out.fitScore).toBe(0);
    expect(out.rationale).toBe('');
    expect(out.suggestedCaseStudies).toEqual([]);
  });

  it('caps suggestedCaseStudies at 5 entries and coerces to string', () => {
    const raw = JSON.stringify({
      engagementType: 'build',
      fitScore: 4,
      rationale: 'r',
      suggestedCaseStudies: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    });
    expect(parseClassification(raw).suggestedCaseStudies).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('truncates rationale at 1000 chars', () => {
    const long = 'x'.repeat(2_000);
    const raw = JSON.stringify({
      engagementType: 'build',
      fitScore: 4,
      rationale: long,
      suggestedCaseStudies: [],
    });
    expect(parseClassification(raw).rationale.length).toBe(1_000);
  });

  it('throws FatalError on totally non-JSON garbage', () => {
    expect(() => parseClassification('this is just prose, no json at all')).toThrow(
      /classifier did not return JSON/,
    );
  });

  it('throws FatalError (not a raw SyntaxError) on brace-wrapped malformed JSON', () => {
    // a "{...}" substring that still isn't valid JSON must be Fatal, not
    // retryable — otherwise WDK retries a deterministic-failure step.
    expect(() => parseClassification('Here you go: {engagementType: build, fitScore: 4,}')).toThrow(
      /classifier did not return parseable JSON/,
    );
  });

  it('ignores non-array suggestedCaseStudies', () => {
    const raw = JSON.stringify({
      engagementType: 'build',
      fitScore: 4,
      rationale: 'r',
      suggestedCaseStudies: 'ask-zeroindex',
    });
    expect(parseClassification(raw).suggestedCaseStudies).toEqual([]);
  });
});
