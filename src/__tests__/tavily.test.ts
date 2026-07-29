import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSearch, mockTavily } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockTavily: vi.fn(),
}));

vi.mock('@tavily/core', () => ({
  tavily: mockTavily,
}));

vi.mock('@/lib/config/serverRegistry', () => ({
  getTavilyAPIKey: vi.fn(),
}));

import { getTavilyAPIKey } from '@/lib/config/serverRegistry';
import { searchTavily } from '@/lib/tavily';

const mockGetTavilyAPIKey = vi.mocked(getTavilyAPIKey);

describe('searchTavily', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTavily.mockReturnValue({ search: mockSearch });
  });

  it('throws when the API key is not configured', async () => {
    mockGetTavilyAPIKey.mockReturnValue('');

    await expect(searchTavily('test query')).rejects.toThrow(
      'Tavily API key is not configured. Please set TAVILY_API_KEY.',
    );
    expect(mockTavily).not.toHaveBeenCalled();
  });

  it('searches with the existing options and maps results', async () => {
    mockGetTavilyAPIKey.mockReturnValue('test-key');
    mockSearch.mockResolvedValue({
      results: [
        {
          title: 'Example',
          url: 'https://example.com',
          content: 'Example content',
          score: 0.9,
        },
      ],
    });

    await expect(searchTavily('test query')).resolves.toEqual({
      results: [
        {
          title: 'Example',
          url: 'https://example.com',
          content: 'Example content',
        },
      ],
      suggestions: [],
    });
    expect(mockTavily).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(mockSearch).toHaveBeenCalledWith('test query', {
      maxResults: 10,
      searchDepth: 'basic',
      topic: 'general',
    });
  });
});
