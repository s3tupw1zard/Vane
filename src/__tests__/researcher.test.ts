import { describe, expect, it, vi } from 'vitest';
import Researcher from '@/lib/agents/search/researcher';
import type { ClassifierOutput, ResearcherInput } from '@/lib/agents/search/types';
import BaseEmbedding from '@/lib/models/base/embedding';
import BaseLLM from '@/lib/models/base/llm';
import type {
  GenerateTextInput,
  StreamTextOutput,
} from '@/lib/models/types';
import { searchSearxng } from '@/lib/searxng';
import SessionManager from '@/lib/session';

vi.mock('@/lib/searxng', () => ({
  searchSearxng: vi.fn(),
}));

class CapturingLLM extends BaseLLM<undefined> {
  readonly requests: GenerateTextInput[] = [];

  constructor() {
    super(undefined);
  }

  async generateText(): Promise<never> {
    throw new Error('generateText should not be called');
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    this.requests.push(input);

    yield {
      contentChunk: '',
      toolCallChunk: [
        {
          id: 'done',
          name: 'done',
          arguments: {},
        },
      ],
    };
  }

  async generateObject<T>(): Promise<never> {
    throw new Error('generateObject should not be called');
  }

  async *streamObject<T>(): AsyncGenerator<never> {
    throw new Error('streamObject should not be called');
  }
}

class UnusedEmbedding extends BaseEmbedding<undefined> {
  constructor() {
    super(undefined);
  }

  async embedText(): Promise<number[][]> {
    return [];
  }

  async embedChunks(): Promise<number[][]> {
    return [];
  }
}

class SearchThenDoneLLM extends BaseLLM<undefined> {
  constructor() {
    super(undefined);
  }

  async generateText(): Promise<never> {
    throw new Error('generateText should not be called');
  }

  async *streamText(): AsyncGenerator<StreamTextOutput> {
    yield {
      contentChunk: '',
      toolCallChunk: [
        {
          id: 'web-search',
          name: 'web_search',
          arguments: {
            queries: ['Vane web search'],
          },
        },
        {
          id: 'done',
          name: 'done',
          arguments: {},
        },
      ],
    };
  }

  async generateObject<T>(): Promise<T> {
    throw new Error('generateObject should not be called');
  }

  async *streamObject<T>(): AsyncGenerator<T> {
    throw new Error('streamObject should not be called');
  }
}

describe('Researcher', () => {
  it('uses the standalone rewrite without duplicating the original user query', async () => {
    const llm = new CapturingLLM();
    const originalQuery = 'What was the winner?';
    const standaloneQuery = 'Who won the 2024 Formula One World Championship?';
    const classification: ClassifierOutput = {
      classification: {
        skipSearch: false,
        personalSearch: false,
        academicSearch: false,
        discussionSearch: false,
        showWeatherWidget: false,
        showStockWidget: false,
        showCalculationWidget: false,
        showCurrencyWidget: false,
      },
      standaloneFollowUp: standaloneQuery,
    };
    const input: ResearcherInput = {
      chatHistory: [
        {
          role: 'user',
          content: 'Tell me about the 2024 Formula One season.',
        },
      ],
      followUp: originalQuery,
      classification,
      config: {
        llm,
        embedding: new UnusedEmbedding(),
        sources: [],
        fileIds: [],
        mode: 'speed',
        systemInstructions: '',
      },
    };

    await new Researcher().research(new SessionManager(), input);

    const request = llm.requests.at(0);
    if (!request) {
      throw new Error('Researcher did not request an LLM completion');
    }

    const userMessages = request.messages.filter(
      (message) => message.role === 'user',
    );
    const userMessage = userMessages.at(0);
    if (!userMessage) {
      throw new Error('Researcher request did not include a user message');
    }

    expect(userMessages).toHaveLength(1);
    expect(userMessage.content).toContain(standaloneQuery);
    expect(userMessage.content).not.toContain(originalQuery);
  });

  it('consults web results when web_search is followed by done', async () => {
    vi.mocked(searchSearxng).mockResolvedValue({
      results: [
        {
          title: 'Vane search result',
          url: 'https://example.com/vane',
          content: 'Vane searches the web.',
        },
      ],
      suggestions: [],
    });
    const classification: ClassifierOutput = {
      classification: {
        skipSearch: false,
        personalSearch: false,
        academicSearch: false,
        discussionSearch: false,
        showWeatherWidget: false,
        showStockWidget: false,
        showCalculationWidget: false,
        showCurrencyWidget: false,
      },
      standaloneFollowUp: 'How does Vane search the web?',
    };
    const input: ResearcherInput = {
      chatHistory: [],
      followUp: classification.standaloneFollowUp,
      classification,
      config: {
        llm: new SearchThenDoneLLM(),
        embedding: new UnusedEmbedding(),
        sources: ['web'],
        fileIds: [],
        mode: 'speed',
        systemInstructions: '',
      },
    };

    const output = await new Researcher().research(new SessionManager(), input);

    expect(searchSearxng).toHaveBeenCalledWith('Vane web search', {});
    expect(output.searchFindings).toMatchObject([
      {
        content: 'Vane searches the web.',
        metadata: {
          title: 'Vane search result',
          url: 'https://example.com/vane',
        },
      },
    ]);
  });
});
