import OpenAI from 'openai';
import BaseLLM from '../../base/llm';
import {
  GenerateObjectInput,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
} from '../../types';
import {
  ChatCompletionMessageParam,
} from 'openai/resources/index.mjs';
import { Message } from '@/lib/types';
import { repairJson } from '@toolsycc/json-repair';

type AzureOpenAIConfig = {
  apiKey: string;
  model: string;
  endpoint: string;
  apiVersion: string;
  options?: GenerateOptions;
};

class AzureOpenAILLM extends BaseLLM<AzureOpenAIConfig> {
  protected openAIClient: OpenAI;

  constructor(protected config: AzureOpenAIConfig) {
    super(config);

    this.openAIClient = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: `${this.config.endpoint}/openai/deployments/${this.config.model}`,
      defaultQuery: { 'api-version': this.config.apiVersion },
      defaultHeaders: {
        'api-key': this.config.apiKey,
      },
    });
  }

  protected convertToAzureMessages(
    messages: Message[],
  ): ChatCompletionMessageParam[] {
    const azureMessages: ChatCompletionMessageParam[] = [];

    for (const message of messages) {
      if (message.role === 'tool') {
        azureMessages.push({
          role: 'tool',
          tool_call_id: message.id,
          content: message.content,
        });
        continue;
      }

      if (message.role === 'user') {
        azureMessages.push({
          role: 'user',
          content: message.content,
        });
        continue;
      }

      if (message.role === 'assistant') {
        const assistantMessage: any = {
          role: 'assistant',
          content: message.content || '',
        };

        if (message.tool_calls && message.tool_calls.length > 0) {
          assistantMessage.tool_calls = message.tool_calls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          }));
        }

        azureMessages.push(assistantMessage);
        continue;
      }

      if (message.role === 'system') {
        azureMessages.push({
          role: 'system',
          content: message.content,
        });
      }
    }

    return azureMessages;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const response = await this.openAIClient.chat.completions.create({
      messages: this.convertToAzureMessages(input.messages),
      model: this.config.model,
      temperature:
        input.options?.temperature ?? this.config.options?.temperature ?? 1.0,
      top_p: input.options?.topP ?? this.config.options?.topP,
      max_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens,
      stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
      frequency_penalty:
        input.options?.frequencyPenalty ??
        this.config.options?.frequencyPenalty,
      presence_penalty:
        input.options?.presencePenalty ?? this.config.options?.presencePenalty,
    });

    if (response.choices && response.choices.length > 0) {
      const choice = response.choices[0];
      const toolCalls: any[] = [];
      
      if (choice.message.tool_calls) {
        for (const tc of choice.message.tool_calls) {
          if ('function' in tc && tc.function) {
            toolCalls.push({
              id: tc.id,
              name: tc.function.name,
              arguments: JSON.parse(tc.function.arguments || '{}'),
            });
          }
        }
      }
      
      return {
        content: choice.message.content || '',
        toolCalls: toolCalls,
        additionalInfo: {
          usage: response.usage,
          finishReason: choice.finish_reason,
        },
      };
    }

    throw new Error('No response from Azure OpenAI');
  }

  async *streamText(input: GenerateTextInput): AsyncGenerator<StreamTextOutput> {
    const stream = await this.openAIClient.chat.completions.create({
      messages: this.convertToAzureMessages(input.messages),
      model: this.config.model,
      temperature:
        input.options?.temperature ?? this.config.options?.temperature ?? 1.0,
      top_p: input.options?.topP ?? this.config.options?.topP,
      max_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens,
      stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
      frequency_penalty:
        input.options?.frequencyPenalty ??
        this.config.options?.frequencyPenalty,
      presence_penalty:
        input.options?.presencePenalty ?? this.config.options?.presencePenalty,
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices.length > 0) {
        const delta = chunk.choices[0].delta;
        const toolCallChunk: any[] = [];
        
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.function) {
              toolCallChunk.push({
                id: tc.id || '',
                name: tc.function.name || '',
                arguments: tc.function.arguments ? JSON.parse(tc.function.arguments) : {},
              });
            }
          }
        }
        
        yield {
          contentChunk: delta.content || '',
          toolCallChunk: toolCallChunk,
          done: chunk.choices[0].finish_reason !== null,
          additionalInfo: {
            finishReason: chunk.choices[0].finish_reason,
          },
        };
      }
    }
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<Partial<T>> {
    let receivedObject = '';

    for await (const chunk of this.streamText({
      ...input,
      options: {
        ...input.options,
        stopSequences: [],
      },
    })) {
      receivedObject += chunk.contentChunk;

      try {
        yield input.schema.parse(JSON.parse(receivedObject)) as T;
      } catch {
        continue;
      }
    }
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    const response = await this.openAIClient.chat.completions.create({
      messages: this.convertToAzureMessages(input.messages),
      model: this.config.model,
      temperature:
        input.options?.temperature ?? this.config.options?.temperature ?? 1.0,
      top_p: input.options?.topP ?? this.config.options?.topP,
      max_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens,
      stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
      frequency_penalty:
        input.options?.frequencyPenalty ??
        this.config.options?.frequencyPenalty,
      presence_penalty:
        input.options?.presencePenalty ?? this.config.options?.presencePenalty,
      response_format: { type: 'json_object' },
    });

    if (response.choices && response.choices.length > 0) {
      try {
        return input.schema.parse(
          JSON.parse(
            repairJson(response.choices[0].message.content || '', {
              extractJson: true,
            }) as string,
          ),
        ) as T;
      } catch (err) {
        throw new Error(`Error parsing response from Azure OpenAI: ${err}`);
      }
    }

    throw new Error('No response from Azure OpenAI');
  }
}

export default AzureOpenAILLM;
