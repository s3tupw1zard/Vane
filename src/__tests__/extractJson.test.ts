import { describe, expect, it } from 'vitest';
import { extractJsonObject, stripMarkdownFences } from '@/lib/utils/extractJson';

describe('extractJsonObject', () => {
  it('extracts valid JSON object', () => {
    const input = '{"key": "value"}';
    const result = extractJsonObject(input);
    expect(JSON.parse(result)).toEqual({ key: 'value' });
  });

  it('handles null input', () => {
    const result = extractJsonObject(null);
    expect(result).toBe('{}');
  });

  it('handles undefined input', () => {
    const result = extractJsonObject(undefined);
    expect(result).toBe('{}');
  });

  it('handles empty string', () => {
    const result = extractJsonObject('');
    expect(result).toBe('{}');
  });

  it('strips markdown code fences', () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = extractJsonObject(input);
    expect(JSON.parse(result)).toEqual({ key: 'value' });
  });

  it('strips JSON code fences with uppercase', () => {
    const input = '```JSON\n{"key": "value"}\n```';
    const result = extractJsonObject(input);
    expect(JSON.parse(result)).toEqual({ key: 'value' });
  });

  it('strips think tags before JSON', () => {
    const input = '<think>reasoning...</think>{"key": "value"}';
    const result = extractJsonObject(input);
    expect(JSON.parse(result)).toEqual({ key: 'value' });
  });

  it('strips thinking tags before JSON', () => {
    const input = '<thinking>reasoning...</thinking>{"key": "value"}';
    const result = extractJsonObject(input);
    expect(JSON.parse(result)).toEqual({ key: 'value' });
  });

  it('handles prose before JSON object', () => {
    const input = 'Here is the JSON: {"key": "value"}';
    const result = extractJsonObject(input);
    expect(JSON.parse(result)).toEqual({ key: 'value' });
  });

  it('handles nested objects', () => {
    const input = '{"outer": {"inner": "value"}}';
    const result = extractJsonObject(input);
    expect(JSON.parse(result)).toEqual({ outer: { inner: 'value' } });
  });

  it('handles arrays in objects', () => {
    const input = '{"items": [1, 2, 3]}';
    const result = extractJsonObject(input);
    expect(JSON.parse(result)).toEqual({ items: [1, 2, 3] });
  });

  it('returns empty object when no JSON found', () => {
    const input = 'This is just plain text without JSON';
    const result = extractJsonObject(input);
    expect(result).toBe('{}');
  });
});

describe('stripMarkdownFences', () => {
  it('strips json code fences', () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = stripMarkdownFences(input);
    expect(result).toBe('{"key": "value"}');
  });

  it('strips JSON code fences (uppercase)', () => {
    const input = '```JSON\n{"key": "value"}\n```';
    const result = stripMarkdownFences(input);
    expect(result).toBe('{"key": "value"}');
  });

  it('strips plain code fences', () => {
    const input = '```\n{"key": "value"}\n```';
    const result = stripMarkdownFences(input);
    expect(result).toBe('{"key": "value"}');
  });

  it('handles empty input', () => {
    const result = stripMarkdownFences('');
    expect(result).toBe('');
  });

  it('handles null input', () => {
    const result = stripMarkdownFences(null as any);
    expect(result).toBe(null);
  });

  it('returns unchanged string without fences', () => {
    const input = '{"key": "value"}';
    const result = stripMarkdownFences(input);
    expect(result).toBe('{"key": "value"}');
  });

  it('trims whitespace', () => {
    const input = '```json\n  {"key": "value"}  \n```';
    const result = stripMarkdownFences(input);
    expect(result).toBe('{"key": "value"}');
  });
});
