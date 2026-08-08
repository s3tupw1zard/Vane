import BaseEmbedding from '@/lib/models/base/embedding';
import BaseLLM from '@/lib/models/base/llm';
import { searchSearxng, SearxngSearchOptions } from '@/lib/searxng';
import { searchCrw } from '@/lib/crw';
import { searchYoucom } from '@/lib/youcom';
import { searchTavily } from '@/lib/tavily';
import { getSearchProvider } from '@/lib/config/serverRegistry';
import SessionManager from '@/lib/session';
import { Chunk, ResearchBlock } from '@/lib/types';
import { SearchAgentConfig } from '../../../types';
import computeSimilarity from '@/lib/utils/computeSimilarity';

/*
 * Dispatches a general web search to the configured provider. Defaults to
 * SearXNG; fastCRW, You.com, and Tavily are selectable via search config.
 */
const searchWeb = async (query: string, opts?: SearxngSearchOptions) => {
  const provider = getSearchProvider();
  
  if (provider === 'crw') {
    return searchCrw(query);
  }
  
  if (provider === 'youcom') {
    return searchYoucom(query, opts);
  }

  if (provider === 'tavily') {
    return searchTavily(query);
  }
  
  return searchSearxng(query, opts);
};

export const executeSearch = async (input: {
  queries: string[];
  mode: SearchAgentConfig['mode'];
  searchConfig?: SearxngSearchOptions;
  researchBlock: ResearchBlock;
  session: InstanceType<typeof SessionManager>;
  llm: BaseLLM<any>;
  embedding: BaseEmbedding<any>;
  maxResultsPerQuery?: number;
  maxTotalResults?: number;
}) => {
  const researchBlock = input.researchBlock;

  researchBlock.data.subSteps.push({
    id: crypto.randomUUID(),
    type: 'searching',
    searching: input.queries,
  });

  input.session.updateBlock(researchBlock.id, [
    {
      op: 'replace',
      path: '/data/subSteps',
      value: researchBlock.data.subSteps,
    },
  ]);

  if (input.mode === 'speed' || input.mode === 'balanced') {
    const searchResultsBlockId = crypto.randomUUID();
    let searchResultsEmitted = false;
    const results: Chunk[] = [];

    const search = async (q: string) => {
      const res = await searchWeb(q, {
        ...(input.searchConfig ? input.searchConfig : {}),
      });

      let resultChunks: Chunk[] = [];

      try {
        const contents = res.results.map((r) => r.content || r.title);
        const embeddings = await input.embedding.embedText([q, ...contents]);
        const queryEmbedding = embeddings[0];
        const chunkEmbeddings = embeddings.slice(1);

        const allChunks = res.results.map((r, i) => ({
          content: contents[i],
          metadata: {
            title: r.title,
            url: r.url,
            similarity: computeSimilarity(queryEmbedding, chunkEmbeddings[i]),
            embedding: chunkEmbeddings[i],
          },
        }));

        resultChunks = allChunks.filter((c) => c.metadata.similarity > 0.5);

        if (resultChunks.length === 0 && allChunks.length > 0) {
          resultChunks = allChunks
            .sort((a, b) => b.metadata.similarity - a.metadata.similarity)
            .slice(0, 10);
        }
      } catch (_err) {
        resultChunks = res.results.map((r) => ({
          content: r.content || r.title,
          metadata: {
            title: r.title,
            url: r.url,
            similarity: 1,
            embedding: [],
          },
        }));
      } finally {
        if (
          Number.isInteger(input.maxResultsPerQuery) &&
          (input.maxResultsPerQuery as number) > 0
        ) {
          resultChunks = resultChunks.slice(0, input.maxResultsPerQuery);
        }
        results.push(...resultChunks);
      }

      if (!searchResultsEmitted) {
        searchResultsEmitted = true;
        researchBlock.data.subSteps.push({
          id: searchResultsBlockId,
          type: 'search_results',
          reading: resultChunks,
        });
        input.session.updateBlock(researchBlock.id, [
          {
            op: 'replace',
            path: '/data/subSteps',
            value: researchBlock.data.subSteps,
          },
        ]);
      } else {
        const subStepIndex = researchBlock.data.subSteps.findIndex(
          (step) => step.id === searchResultsBlockId,
        );
        if (subStepIndex !== -1) {
          const subStep = researchBlock.data.subSteps[subStepIndex] as { reading?: Chunk[] };
          const existingReading = subStep.reading ?? [];
          subStep.reading = [...existingReading, ...resultChunks];
          input.session.updateBlock(researchBlock.id, [
            {
              op: 'replace',
              path: '/data/subSteps',
              value: researchBlock.data.subSteps,
            },
          ]);
        }
      }
    };

    await Promise.all(input.queries.map((q) => search(q)));

    if (
      Number.isInteger(input.maxTotalResults) &&
      (input.maxTotalResults as number) > 0 &&
      results.length > (input.maxTotalResults as number)
    ) {
      results.length = input.maxTotalResults as number;
    }

    if (results.length === 0) {
      console.warn('[SearchAgent] No results found for queries:', input.queries);
    }

    researchBlock.data.subSteps.push({
      id: crypto.randomUUID(),
      type: 'search_results',
      reading: results,
    } as any);
    input.session.updateBlock(researchBlock.id, [
      {
        op: 'replace',
        path: '/data/subSteps',
        value: researchBlock.data.subSteps,
      },
    ]);

    return { results, researchBlock };
  } else if (input.mode === 'quality') {
    const results: Chunk[] = [];
    
    for (const query of input.queries) {
      const res = await searchWeb(query, {
        ...(input.searchConfig ? input.searchConfig : {}),
      });
      
      let resultChunks: Chunk[] = [];
      
      try {
        const contents = res.results.map((r) => r.content || r.title);
        const embeddings = await input.embedding.embedText([query, ...contents]);
        const queryEmbedding = embeddings[0];
        const chunkEmbeddings = embeddings.slice(1);
        
        const allChunks = res.results.map((r, i) => ({
          content: contents[i],
          metadata: {
            title: r.title,
            url: r.url,
            similarity: computeSimilarity(queryEmbedding, chunkEmbeddings[i]),
            embedding: chunkEmbeddings[i],
          },
        }));
        
        resultChunks = allChunks.filter((c) => c.metadata.similarity > 0.5);
        
        if (resultChunks.length === 0 && allChunks.length > 0) {
          resultChunks = allChunks
            .sort((a, b) => b.metadata.similarity - a.metadata.similarity)
            .slice(0, 10);
        }
      } catch (_err) {
        resultChunks = res.results.map((r) => ({
          content: r.content || r.title,
          metadata: {
            title: r.title,
            url: r.url,
            similarity: 1,
            embedding: [],
          },
        }));
      } finally {
        if (
          Number.isInteger(input.maxResultsPerQuery) &&
          (input.maxResultsPerQuery as number) > 0
        ) {
          resultChunks = resultChunks.slice(0, input.maxResultsPerQuery);
        }
        results.push(...resultChunks);
      }
    }
    
    if (
      Number.isInteger(input.maxTotalResults) &&
      (input.maxTotalResults as number) > 0 &&
      results.length > (input.maxTotalResults as number)
    ) {
      results.length = input.maxTotalResults as number;
    }
    
    return { results, researchBlock };
  }
  
  return { results: [], researchBlock };
};
