import OpenAI from 'openai';
import BaseEmbedding from '../../base/embedding';
import { Chunk } from '@/lib/types';

type AzureOpenAIConfig = {
  apiKey: string;
  model: string;
  endpoint: string;
  apiVersion: string;
};

class AzureOpenAIEmbedding extends BaseEmbedding<AzureOpenAIConfig> {
  openAIClient: OpenAI;

  constructor(protected config: AzureOpenAIConfig) {
    super(config);

    this.openAIClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: `${config.endpoint}/openai/deployments/${config.model}`,
      defaultQuery: { 'api-version': config.apiVersion },
      defaultHeaders: {
        'api-key': config.apiKey,
      },
    });
  }

  async embedText(texts: string[]): Promise<number[][]> {
    const response = await this.openAIClient.embeddings.create({
      model: this.config.model,
      input: texts,
    });

    return response.data.map((embedding) => embedding.embedding);
  }

  async embedChunks(chunks: Chunk[]): Promise<number[][]> {
    const response = await this.openAIClient.embeddings.create({
      model: this.config.model,
      input: chunks.map((c) => c.content),
    });

    return response.data.map((embedding) => embedding.embedding);
  }
}

export default AzureOpenAIEmbedding;
