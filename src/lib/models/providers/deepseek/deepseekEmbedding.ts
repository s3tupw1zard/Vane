import BaseEmbedding from '../../base/embedding';
import OpenAI from 'openai';
import { Chunk } from '@/lib/types';

type DeepSeekEmbeddingConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
};

class DeepSeekEmbedding extends BaseEmbedding<DeepSeekEmbeddingConfig> {
  deepseekClient: OpenAI;

  constructor(protected config: DeepSeekEmbeddingConfig) {
    super(config);

    this.deepseekClient = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL || 'https://api.deepseek.com/v1',
    });
  }

  async embedText(texts: string[]): Promise<number[][]> {
    const response = await this.deepseekClient.embeddings.create({
      model: this.config.model,
      input: texts,
    });

    return response.data.map((item) => item.embedding);
  }

  async embedChunks(chunks: Chunk[]): Promise<number[][]> {
    return this.embedText(chunks.map((c) => c.content));
  }
}

export default DeepSeekEmbedding;
