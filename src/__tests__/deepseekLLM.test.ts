import { describe, expect, it, vi } from 'vitest';

const openAiMocks = vi.hoisted(() => ({
  createCompletion: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: {
        create: openAiMocks.createCompletion,
      },
    };
  },
}));

import DeepSeekLLM, {
  stripDeepSeekThinking,
} from '../lib/models/providers/deepseek/deepseekLLM';

type DeepSeekStreamChunk = {
  readonly choices: readonly {
    readonly delta: {
      readonly content: string;
    };
    readonly finish_reason: string | null;
  }[];
};

const streamChunks = async function* (
  chunks: readonly DeepSeekStreamChunk[],
): AsyncGenerator<DeepSeekStreamChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
};

describe('stripDeepSeekThinking', () => {
  it('removes content enclosed by think tags', () => {
    // Given: a response containing an explicit reasoning block
    const response = 'Before<think>Hidden reasoning</think>Visible answer';

    // When: the response is sanitized
    const result = stripDeepSeekThinking(response);

    // Then: only the reasoning block is removed
    expect(result).toBe('BeforeVisible answer');
  });

  it('removes content before a closing think tag without an opening tag', () => {
    // Given: a DeepSeek R1 response with only a closing reasoning tag
    const response = 'Hidden reasoning</think>Visible answer';

    // When: the response is sanitized
    const result = stripDeepSeekThinking(response);

    // Then: the content before the closing tag does not leak
    expect(result).toBe('Visible answer');
  });

  it('preserves responses without think tags', () => {
    // Given: a normal response
    const response = 'Visible answer';

    // When: the response is sanitized
    const result = stripDeepSeekThinking(response);

    // Then: the response remains unchanged
    expect(result).toBe(response);
  });

  it('does not yield reasoning before a closing think tag during streaming', async () => {
    // Given: a DeepSeek R1 stream with a closing reasoning tag but no opening tag
    openAiMocks.createCompletion.mockResolvedValueOnce(
      streamChunks([
        {
          choices: [
            {
              delta: { content: 'Hidden reasoning' },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [
            {
              delta: { content: '</think>Visible answer' },
              finish_reason: 'stop',
            },
          ],
        },
      ]),
    );
    const llm = new DeepSeekLLM({ apiKey: 'key', model: 'deepseek-r1-671b' });
    const contentChunks: string[] = [];

    // When: the response is streamed
    for await (const chunk of llm.streamText({ messages: [] })) {
      contentChunks.push(chunk.contentChunk);
    }

    // Then: only the answer is yielded after the closing tag
    expect(contentChunks).toEqual(['', 'Visible answer']);
  });

  it('preserves the full response when a stream has no think tag', async () => {
    // Given: a normal DeepSeek stream
    openAiMocks.createCompletion.mockResolvedValueOnce(
      streamChunks([
        {
          choices: [
            {
              delta: { content: 'Visible ' },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [
            {
              delta: { content: 'answer' },
              finish_reason: 'stop',
            },
          ],
        },
      ]),
    );
    const llm = new DeepSeekLLM({ apiKey: 'key', model: 'deepseek-chat' });
    const contentChunks: string[] = [];

    // When: the response is streamed
    for await (const chunk of llm.streamText({ messages: [] })) {
      contentChunks.push(chunk.contentChunk);
    }

    // Then: the response content is preserved
    expect(contentChunks.join('')).toBe('Visible answer');
  });
});
