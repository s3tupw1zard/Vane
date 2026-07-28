import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { searchSearxng } from '@/lib/searxng';

vi.mock('@/lib/config/serverRegistry', () => ({
  getSearxngURL: vi.fn(),
}));

import { getSearxngURL } from '@/lib/config/serverRegistry';

const mockGetSearxngURL = vi.mocked(getSearxngURL);

describe('searchSearxng', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws error when SearXNG URL is not configured', async () => {
    mockGetSearxngURL.mockReturnValue('');

    await expect(searchSearxng('test query')).rejects.toThrow(
      'SearXNG is not configured. Please set the SearXNG URL in Settings → Search.',
    );
  });

  it('throws error on HTTP failure', async () => {
    mockGetSearxngURL.mockReturnValue('http://localhost:4000');

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
    });

    await expect(searchSearxng('test query')).rejects.toThrow(
      'SearXNG error: Internal Server Error',
    );
  });

  it('throws error on timeout', async () => {
    mockGetSearxngURL.mockReturnValue('http://localhost:4000');

    global.fetch = vi.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          reject({ name: 'AbortError', message: 'The operation was aborted' });
        }, 11000);
      });
    });

    const searchPromise = searchSearxng('test query');

    vi.advanceTimersByTime(11000);

    await expect(searchPromise).rejects.toThrow('SearXNG search timed out');
  });

  it('returns results and suggestions on success', async () => {
    mockGetSearxngURL.mockReturnValue('http://localhost:4000');

    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            { title: 'Result 1', url: 'https://example.com/1' },
            { title: 'Result 2', url: 'https://example.com/2' },
          ],
          suggestions: ['suggestion 1', 'suggestion 2'],
        }),
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await searchSearxng('test query');

    expect(result).toEqual({
      results: [
        { title: 'Result 1', url: 'https://example.com/1' },
        { title: 'Result 2', url: 'https://example.com/2' },
      ],
      suggestions: ['suggestion 1', 'suggestion 2'],
    });
  });

  it('returns empty arrays when no results', async () => {
    mockGetSearxngURL.mockReturnValue('http://localhost:4000');

    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({}),
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await searchSearxng('test query');

    expect(result).toEqual({
      results: [],
      suggestions: [],
    });
  });

  it('passes search options to URL params', async () => {
    mockGetSearxngURL.mockReturnValue('http://localhost:4000');

    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ results: [], suggestions: [] }),
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    await searchSearxng('test query', {
      categories: ['general'],
      engines: ['google', 'bing'],
      language: 'en',
      pageno: 2,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        toString: expect.any(Function),
      }),
      expect.objectContaining({
        signal: expect.any(Object),
        headers: expect.objectContaining({
          'X-Forwarded-For': '127.0.0.1',
          'X-Real-IP': '127.0.0.1',
        }),
      }),
    );

    const calledUrl = (global.fetch as any).mock.calls[0][0];
    const urlString = calledUrl.toString();
    expect(urlString).toContain('q=test+query');
    expect(urlString).toContain('categories=general');
    expect(urlString).toContain('engines=google%2Cbing');
    expect(urlString).toContain('language=en');
    expect(urlString).toContain('pageno=2');
  });
});
