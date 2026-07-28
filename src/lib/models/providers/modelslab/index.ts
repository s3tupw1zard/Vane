import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import ModelsLabLLM from './modelsLabLLM';

interface ModelsLabConfig {
  apiKey: string;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your ModelsLab API key',
    required: true,
    placeholder: 'ModelsLab API Key',
    env: 'MODELSLAB_API_KEY',
    scope: 'server',
  },
];

class ModelsLabProvider extends BaseModelProvider<ModelsLabConfig> {
  constructor(id: string, name: string, config: ModelsLabConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    const res = await fetch(`https://modelslab.com/api/v1/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });

    const data = await res.json();

    const defaultChatModels: Model[] = [];

    if (data.data) {
      data.data.forEach((m: any) => {
        defaultChatModels.push({
          key: m.id || m.name,
          name: m.name || m.id,
        });
      });
    }

    return {
      embedding: [],
      chat: defaultChatModels,
    };
  }

  async getModelList(): Promise<ModelList> {
    const defaultModels = await this.getDefaultModels();
    const configProvider = getConfiguredModelProviderById(this.id)!;

    return {
      embedding: [
        ...defaultModels.embedding,
        ...configProvider.embeddingModels,
      ],
      chat: [...defaultModels.chat, ...configProvider.chatModels],
    };
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();

    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists) {
      throw new Error('Error Loading ModelsLab Chat Model. Invalid Model Selected');
    }

    return new ModelsLabLLM({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: 'https://modelslab.com/api/v1',
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    throw new Error('ModelsLab Provider does not support embedding models.');
  }

  static parseAndValidate(raw: any): ModelsLabConfig {
    if (!raw || typeof raw !== 'object')
      throw new Error('Invalid config provided. Expected object');
    if (!raw.apiKey)
      throw new Error('Invalid config provided. API key must be provided');

    return {
      apiKey: String(raw.apiKey),
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'modelslab',
      name: 'ModelsLab',
    };
  }
}

export default ModelsLabProvider;
