import { describe, expect, it } from 'vitest';
import { stripDeepSeekThinking } from '@/lib/models/providers/deepseek/deepseekLLM';

describe('stripDeepSeekThinking', () => {
  it('strips think tags with content', () => {
    const input = '<think>This is reasoning</think>The actual response';
    const result = stripDeepSeekThinking(input);
    expect(result).toBe('The actual response');
  });

  it('handles missing opening tag', () => {
    const input = 'This is reasoning</think>The actual response';
    const result = stripDeepSeekThinking(input);
    expect(result).toBe('The actual response');
  });

  it('returns unchanged content without think tags', () => {
    const input = 'Just a normal response without thinking';
    const result = stripDeepSeekThinking(input);
    expect(result).toBe('Just a normal response without thinking');
  });

  it('handles empty think tags', () => {
    const input = '<think></think>The actual response';
    const result = stripDeepSeekThinking(input);
    expect(result).toBe('The actual response');
  });

  it('handles think tags at the end', () => {
    const input = 'Response text<think>reasoning</think>';
    const result = stripDeepSeekThinking(input);
    expect(result).toBe('Response text');
  });

  it('handles multiple think tag pairs (removes first pair)', () => {
    const input = '<think>first</think>Middle<think>second</think>End';
    const result = stripDeepSeekThinking(input);
    expect(result).toBe('Middle<think>second</think>End');
  });

  it('handles think tags with newlines', () => {
    const input = '<think>\nreasoning\nwith\nnewlines\n</think>The response';
    const result = stripDeepSeekThinking(input);
    expect(result).toBe('The response');
  });

  it('handles empty input', () => {
    const result = stripDeepSeekThinking('');
    expect(result).toBe('');
  });

  it('preserves content before think tags', () => {
    const input = 'Before<think>reasoning</think>After';
    const result = stripDeepSeekThinking(input);
    expect(result).toBe('BeforeAfter');
  });

  it('handles only closing tag', () => {
    const input = '</think>Just response';
    const result = stripDeepSeekThinking(input);
    expect(result).toBe('Just response');
  });
});
