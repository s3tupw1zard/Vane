import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import AzureOpenAILLM from './azureOpenAILLM';
import AzureOpenAIEmbedding from './azureOpenAIEmbedding';

interface AzureOpenAIConfig {
  apiKey: string;
  endpoint: string;
  deploymentName: string;
  embeddingDeployment?: string;
  apiVersion?: string;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your Azure OpenAI API key',
    required: true,
    placeholder: 'Azure OpenAI API Key',
    env: 'AZURE_OPENAI_API_KEY',
    scope: 'server',
  },
  {
    type: 'string',
    name: 'Endpoint',
    key: 'endpoint',
    description: 'Azure OpenAI endpoint URL (e.g., https://your-resource.openai.azure.com)',
    required: true,
    placeholder: 'https://your-resource.openai.azure.com',
    env: 'AZURE_OPENAI_ENDPOINT',
    scope: 'server',
  },
  {
    type: 'string',
    name: 'Deployment Name',
    key: 'deploymentName',
    description: 'Chat model deployment name',
    required: true,
    placeholder: 'gpt-4',
    env: 'AZURE_OPENAI_DEPLOYMENT_NAME',
    scope: 'server',
  },
  {
    type: 'string',
    name: 'Embedding Deployment',
    key: 'embeddingDeployment',
    description: 'Embedding model deployment name (optional)',
    required: false,
    placeholder: 'text-embedding-ada-002',
    env: 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT',
    scope: 'server',
  },
  {
    type: 'string',
    name: 'API Version',
    key: 'apiVersion',
    description: 'Azure OpenAI API version (default: 2024-02-01)',
    required: false,
    placeholder: '2024-02-01',
    env: 'AZURE_OPENAI_API_VERSION',
    scope: 'server',
  },
];

class AzureOpenAIProvider extends BaseModelProvider<AzureOpenAIConfig> {
  constructor(id: string, name: string, config: AzureOpenAIConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    const defaultChatModels: Model[] = [
      {
        key: this.config.deploymentName,
        name: this.config.deploymentName,
      },
    ];

    const defaultEmbeddingModels: Model[] = [];
    if (this.config.embeddingDeployment) {
      defaultEmbeddingModels.push({
        key: this.config.embeddingDeployment,
        name: this.config.embeddingDeployment,
      });
    }

    return {
      embedding: defaultEmbeddingModels,
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
      throw new Error('Error Loading Azure OpenAI Chat Model. Invalid Model Selected');
    }

    return new AzureOpenAILLM({
      apiKey: this.config.apiKey,
      model: key,
      endpoint: this.config.endpoint,
      apiVersion: this.config.apiVersion || '2024-02-01',
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    if (!this.config.embeddingDeployment) {
      throw new Error('Azure OpenAI embedding deployment not configured');
    }

    const modelList = await this.getModelList();

    const exists = modelList.embedding.find((m) => m.key === key);

    if (!exists) {
      throw new Error('Error Loading Azure OpenAI Embedding Model. Invalid Model Selected');
    }

    return new AzureOpenAIEmbedding({
      apiKey: this.config.apiKey,
      model: key,
      endpoint: this.config.endpoint,
      apiVersion: this.config.apiVersion || '2024-02-01',
    });
  }

  static parseAndValidate(raw: any): AzureOpenAIConfig {
    if (!raw || typeof raw !== 'object')
      throw new Error('Invalid config provided. Expected object');
    if (!raw.apiKey)
      throw new Error('Invalid config provided. API key must be provided');
    if (!raw.endpoint)
      throw new Error('Invalid config provided. Endpoint must be provided');
    if (!raw.deploymentName)
      throw new Error('Invalid config provided. Deployment name must be provided');

    return {
      apiKey: String(raw.apiKey),
      endpoint: String(raw.endpoint),
      deploymentName: String(raw.deploymentName),
      embeddingDeployment: raw.embeddingDeployment ? String(raw.embeddingDeployment) : undefined,
      apiVersion: raw.apiVersion ? String(raw.apiVersion) : undefined,
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'azure',
      name: 'Azure OpenAI',
    };
  }
}

export default AzureOpenAIProvider;
