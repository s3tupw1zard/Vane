import OpenAI from 'openai';
import BaseLLM from '../../base/llm';
import { zodTextFormat, zodResponseFormat } from 'openai/helpers/zod';
import {
  GenerateObjectInput,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
  ToolCall,
} from '../../types';
import { parse } from 'partial-json';
import z from 'zod';
import {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from 'openai/resources/index.mjs';
import { Message } from '@/lib/types';
import { extractJsonObject } from '@/lib/utils/extractJson';

type OpenAIConfig = {
  apiKey: string;
  model: string;
  baseURL: string;
  options?: GenerateOptions;
};

class OpenAILLM extends BaseLLM<OpenAIConfig> {
  protected openAIClient: OpenAI;

  constructor(protected config: OpenAIConfig) {
    super(config);

    this.openAIClient = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
    });
  }

  protected convertToOpenAIMessages(
    messages: Message[],
  ): ChatCompletionMessageParam[] {
    const openaiMessages: ChatCompletionMessageParam[] = [];

    for (const message of messages) {
      if (message.role === 'tool') {
        openaiMessages.push({
          role: 'tool',
          tool_call_id: message.id,
          content: message.content,
        });
        continue;
      }

      if (message.role === 'assistant' && message.tool_calls?.length) {
        const toolCalls = message.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        }));

        openaiMessages.push({
          role: 'assistant',
          tool_calls: toolCalls,
          content: message.content || null,
        });
        continue;
      }

      openaiMessages.push({
        role: message.role,
        content: message.content ?? '',
      });
    }

    return openaiMessages;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const response = await this.openAIClient.chat.completions.create({
      model: this.config.model,
      messages: this.convertToOpenAIMessages(input.messages),
      tools:
        input.tools && input.tools.length > 0
          ? input.tools.map((tool) => ({
              type: 'function' as const,
              function: {
                name: tool.name,
                description: tool.description,
                parameters: z.toJSONSchema(tool.schema),
              },
            }))
          : undefined,
      temperature:
        input.options?.temperature ?? this.config.options?.temperature ?? 1.0,
      top_p: input.options?.topP ?? this.config.options?.topP,
      max_completion_tokens:
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
      const content = choice.message.content || '';
      const toolCalls =
        choice.message.tool_calls?.map((tc) => ({
          id: tc.id,
          name: 'function' in tc ? tc.function.name : '',
          arguments: JSON.parse('function' in tc ? (tc.function.arguments || '{}') : '{}'),
        })) || [];

      return {
        content,
        toolCalls,
        additionalInfo: {
          finishReason: choice.finish_reason,
        },
      };
    }

    return {
      content: '',
      toolCalls: [],
      additionalInfo: {},
    };
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    const openaiTools: ChatCompletionTool[] = (input.tools?.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: z.toJSONSchema(tool.schema),
      },
    })) ?? []) as ChatCompletionTool[];

    const stream = await this.openAIClient.chat.completions.create({
      model: this.config.model,
      messages: this.convertToOpenAIMessages(input.messages),
      tools: openaiTools.length > 0 ? openaiTools : undefined,
      temperature:
        input.options?.temperature ?? this.config.options?.temperature ?? 1.0,
      top_p: input.options?.topP ?? this.config.options?.topP,
      max_completion_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens,
      stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
      frequency_penalty:
        input.options?.frequencyPenalty ??
        this.config.options?.frequencyPenalty,
      presence_penalty:
        input.options?.presencePenalty ?? this.config.options?.presencePenalty,
      stream: true,
    });

    let recievedToolCalls: { name: string; id: string; arguments: string }[] =
      [];

    const parseToolArguments = (argumentsText: string) => {
      if (!argumentsText.trim()) return {};

      try {
        return parse(argumentsText);
      } catch (err) {
        // Some OpenAI-compatible providers stream an empty or partial arguments
        // chunk before the full JSON arrives. Keep streaming instead of failing.
        return {};
      }
    };

    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices.length > 0) {
        const toolCalls = chunk.choices[0].delta.tool_calls;
        yield {
          contentChunk: chunk.choices[0].delta.content || '',
          toolCallChunk:
            toolCalls
              ?.map((tc) => {
                const existingCall = recievedToolCalls[tc.index];

                if (!existingCall) {
                  if (!tc.id || !tc.function?.name) return undefined;

                  const call = {
                    name: tc.function.name,
                    id: tc.id,
                    arguments: tc.function.arguments ?? '',
                  };
                  recievedToolCalls[tc.index] = call;
                  return {
                    ...call,
                    arguments: parseToolArguments(call.arguments),
                  };
                }

                existingCall.arguments += tc.function?.arguments ?? '';
                // Some providers (e.g. Anthropic's OpenAI-compatible endpoint)
                // stream tool-call deltas where the accumulated arguments are
                // still empty. partial-json's parse() throws " is empty" on an
                // empty/whitespace string, so fall back to an empty object.
                return {
                  ...existingCall,
                  arguments: parseToolArguments(existingCall.arguments),
                };
              })
              .filter((tc) => tc !== undefined) || [],
          done: chunk.choices[0].finish_reason !== null,
          additionalInfo: {
            finishReason: chunk.choices[0].finish_reason,
          },
        };
      }
    }
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    const response = await this.openAIClient.chat.completions.create({
      messages: this.convertToOpenAIMessages(input.messages),
      model: this.config.model,
      temperature:
        input.options?.temperature ?? this.config.options?.temperature ?? 1.0,
      top_p: input.options?.topP ?? this.config.options?.topP,
      max_completion_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens,
      stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
      frequency_penalty:
        input.options?.frequencyPenalty ??
        this.config.options?.frequencyPenalty,
      presence_penalty:
        input.options?.presencePenalty ?? this.config.options?.presencePenalty,
      // Use the SDK's zodResponseFormat to build a strict, cleaned json_schema
      // rather than passing z.toJSONSchema output directly — the Draft-7 markers
      // it leaves in are the suspected trigger for the doubled-brace malformation
      // vLLM's strict-json_schema guided decoder emits (confirmed by direct
      // testing against vLLM 0.25 serving Qwen3.6 and GLM-5.2; llama-swap only
      // forwards vLLM's bytes unchanged, so it is not the source). But send via
      // .create() not .parse(): the SDK's built-in parse runs JSON.parse on the
      // raw content and crashes on reasoning models that emit thinking markers
      // before the JSON. We repair/extract JSON ourselves below.
      response_format: zodResponseFormat(input.schema, 'object'),
    });

    if (response.choices && response.choices.length > 0) {
      const choice = response.choices[0];
      // Preserve a genuine null/empty content as an explicit failure. The API
      // returns content === null on refusals and on some failed/truncated
      // completions; coercing that to '' would let extractJsonObject('') →
      // '{}' flow through schema.parse and, when the schema permits {} (e.g.
      // all-optional fields), return a valid empty object that masks the
      // refusal. Fail loudly instead so the caller sees the real outcome.
      const raw = choice.message.content;
      if (raw == null || raw === '') {
        throw new Error(
          `Error parsing response from OpenAI: empty content\n` +
            `finish_reason=${choice.finish_reason}\n` +
            `usage=${JSON.stringify((response as { usage?: unknown }).usage)}`,
        );
      }
      try {
        // extractJsonObject handles structural malformation (spurious braces
        // from vLLM strict-json_schema decoders) and delegates token-level
        // repair to jsonrepair, returning a parseable JSON string.
        return input.schema.parse(JSON.parse(extractJsonObject(raw))) as T;
      } catch (err) {
        throw new Error(
          `Error parsing response from OpenAI: ${err instanceof Error ? err.message : err}\n` +
            `finish_reason=${choice.finish_reason}\n` +
            `usage=${JSON.stringify((response as { usage?: unknown }).usage)}`,
        );
      }
    }

    throw new Error('Error parsing response from OpenAI: no choices');
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
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
}

export default OpenAILLM;
