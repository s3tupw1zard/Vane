import BaseEmbedding from '@/lib/models/base/embedding';
import BaseLLM from '@/lib/models/base/llm';
import { searchSearxng, SearxngSearchOptions } from '@/lib/searxng';
import { searchCrw } from '@/lib/crw';
import { searchYoucom } from '@/lib/youcom';
import { getSearchProvider } from '@/lib/config/serverRegistry';
import SessionManager from '@/lib/session';
import { Chunk, ResearchBlock, SearchResultsResearchBlock } from '@/lib/types';
import { SearchAgentConfig } from '../../../types';
import computeSimilarity from '@/lib/utils/computeSimilarity';
import z from 'zod';
import Scraper from '@/lib/scraper';
import { splitText } from '@/lib/utils/splitText';

/*
 * Dispatches a general web search to the configured provider. Defaults to
 * SearXNG; fastCRW and You.com are selectable via search config.
 */
const searchWeb = async (query: string, opts?: SearxngSearchOptions) => {
  const provider = getSearchProvider();
  
  if (provider === 'crw') {
    return searchCrw(query);
  }
  
  if (provider === 'youcom') {
    return searchYoucom(query, opts);
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

        // If the similarity filter removed all results, fall back to the
        // top results sorted by similarity so external SearXNG instances
        // where `number_of_results` may be 0 but `results` is non-empty
        // still produce useful output.
        if (resultChunks.length === 0 && allChunks.length > 0) {
          resultChunks = allChunks
            .sort((a, b) => b.metadata.similarity - a.metadata.similarity)
            .slice(0, 10);
        }
      } catch (err) {
        resultChunks = res.results.map((r) => {
          const content = r.content || r.title;

          return {
            content,
            metadata: {
              title: r.title,
              url: r.url,
              similarity: 1,
              embedding: [],
            },
          };
        });
      } finally {
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
      } else if (searchResultsEmitted) {
        const subStepIndex = researchBlock.data.subSteps.findIndex(
          (step) => step.id === searchResultsBlockId,
        );

        if (subStepIndex !== -1) {
          const existingReading =
            researchBlock.data.subSteps[subStepIndex].reading ?? [];

          researchBlock.data.subSteps[subStepIndex].reading = [
            ...existingReading,
            ...resultChunks,
          ];

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

    if (results.length === 0) {
      console.warn(
        '[SearchAgent] No results found for queries:',
        input.queries,
      );
    }

    researchBlock.data.subSteps.push({
      id: crypto.randomUUID(),
      type: 'results',
      results,
    });

    input.session.updateBlock(researchBlock.id, [
      {
        op: 'replace',
        path: '/data/subSteps',
        value: researchBlock.data.subSteps,
      },
    ]);

    return {
      results,
      researchBlock,
    };
  }

  if (input.mode === 'quality') {
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

        // If the similarity filter removed all results, fall back to the
        // top results sorted by similarity
        if (resultChunks.length === 0 && allChunks.length > 0) {
          resultChunks = allChunks
            .sort((a, b) => b.metadata.similarity - a.metadata.similarity)
            .slice(0, 10);
        }
      } catch (err) {
        resultChunks = res.results.map((r) => {
          const content = r.content || r.title;

          return {
            content,
            metadata: {
              title: r.title,
              url: r.url,
              similarity: 1,
              embedding: [],
            },
          };
        });
      } finally {
        results.push(...resultChunks);
      }
    };

    await Promise.all(input.queries.map((q) => search(q)));

    if (results.length === 0) {
      console.warn(
        '[SearchAgent] No results found for queries:',
        input.queries,
      );
    }

    return {
      results,
      researchBlock,
    };
  }

  return {
    results: [],
    researchBlock,
  };
};

export const executeScrape = async (input: {
  urls: string[];
  researchBlock: ResearchBlock;
  session: InstanceType<typeof SessionManager>;
  embedding: BaseEmbedding<any>;
}) => {
  const researchBlock = input.researchBlock;

  researchBlock.data.subSteps.push({
    id: crypto.randomUUID(),
    type: 'scraping',
    scraping: input.urls,
  });

  input.session.updateBlock(researchBlock.id, [
    {
      op: 'replace',
      path: '/data/subSteps',
      value: researchBlock.data.subSteps,
    },
  ]);

  const scraper = new Scraper();

  const chunks: Chunk[] = [];

  for (const url of input.urls) {
    try {
      const content = await scraper.scrapeUrl(url);

      if (!content) {
        continue;
      }

      const splitContent = await splitText(content);

      const embeddings = await input.embedding.embedText(splitContent);

      splitContent.forEach((c, i) => {
        chunks.push({
          content: c,
          metadata: {
            title: content.slice(0, 50),
            url,
            similarity: 1,
            embedding: embeddings[i],
          },
        });
      });
    } catch (err) {
      console.error(`[SearchAgent] Failed to scrape ${url}:`, err);
    }
  }

  researchBlock.data.subSteps.push({
    id: crypto.randomUUID(),
    type: 'scraped_results',
    results: chunks,
  });

  input.session.updateBlock(researchBlock.id, [
    {
      op: 'replace',
      path: '/data/subSteps',
      value: researchBlock.data.subSteps,
    },
  ]);

  return {
    chunks,
    researchBlock,
  };
};

export const executeSocialSearch = async (input: {
  queries: string[];
  mode: SearchAgentConfig['mode'];
  searchConfig?: SearxngSearchOptions;
  researchBlock: ResearchBlock;
  session: InstanceType<typeof SessionManager>;
  llm: BaseLLM<any>;
  embedding: BaseEmbedding<any>;
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

  const results: Chunk[] = [];

  const search = async (q: string) => {
    const res = await searchWeb(q, {
      ...(input.searchConfig ? input.searchConfig : {}),
      categories: ['social media'],
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

      // If the similarity filter removed all results, fall back to the
      // top results sorted by similarity
      if (resultChunks.length === 0 && allChunks.length > 0) {
        resultChunks = allChunks
          .sort((a, b) => b.metadata.similarity - a.metadata.similarity)
          .slice(0, 10);
      }
    } catch (err) {
      resultChunks = res.results.map((r) => {
        const content = r.content || r.title;

        return {
          content,
          metadata: {
            title: r.title,
            url: r.url,
            similarity: 1,
            embedding: [],
          },
        };
      });
    } finally {
      results.push(...resultChunks);
    }
  };

  await Promise.all(input.queries.map((q) => search(q)));

  if (results.length === 0) {
    console.warn(
      '[SearchAgent] No results found for queries:',
      input.queries,
    );
  }

  researchBlock.data.subSteps.push({
    id: crypto.randomUUID(),
    type: 'results',
    results,
  });

  input.session.updateBlock(researchBlock.id, [
    {
      op: 'replace',
      path: '/data/subSteps',
      value: researchBlock.data.subSteps,
    },
  ]);

  return {
    results,
    researchBlock,
  };
};
