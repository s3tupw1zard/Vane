import { describe, expect, it } from 'vitest';
import { embedTextInBatches } from '@/lib/uploads/manager';

describe('embedTextInBatches', () => {
  it('preserves chunk order when a document exceeds the embedding batch size', async () => {
    // Given
    const chunks = Array.from({ length: 11 }, (_, index) => `chunk-${index}`);
    const batches: string[][] = [];
    const embeddingModel = {
      async embedText(texts: string[]): Promise<number[][]> {
        batches.push(texts);
        return texts.map((text) => [Number(text.slice('chunk-'.length))]);
      },
    };

    // When
    const embeddings = await embedTextInBatches(embeddingModel, chunks);

    // Then
    expect(batches).toEqual([chunks.slice(0, 10), chunks.slice(10)]);
    expect(embeddings).toEqual(chunks.map((_, index) => [index]));
  });

  it('embeds a small document in one request', async () => {
    // Given
    const chunks = ['first chunk', 'second chunk'];
    const batches: string[][] = [];
    const embeddingModel = {
      async embedText(texts: string[]): Promise<number[][]> {
        batches.push(texts);
        return texts.map((_, index) => [index]);
      },
    };

    // When
    const embeddings = await embedTextInBatches(embeddingModel, chunks);

    // Then
    expect(batches).toEqual([chunks]);
    expect(embeddings).toEqual([[0], [1]]);
  });
});
