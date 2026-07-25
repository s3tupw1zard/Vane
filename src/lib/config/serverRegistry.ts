import configManager from './index';
import { ConfigModelProvider } from './types';

export const getConfiguredModelProviders = (): ConfigModelProvider[] => {
  return configManager.getConfig('modelProviders', []);
};

export const getConfiguredModelProviderById = (
  id: string,
): ConfigModelProvider | undefined => {
  return getConfiguredModelProviders().find((p) => p.id === id) ?? undefined;
};

export const getSearxngURL = () =>
  configManager.getConfig('search.searxngURL', '');

export const getTavilyAPIKey = (): string =>
  configManager.getConfig('search.tavilyAPIKey', '');

export const getSearchProvider = (): 'searxng' | 'crw' | 'youcom' | 'tavily' => {
  const provider = configManager.getConfig('search.searchProvider', 'searxng');
  if (provider === 'crw') return 'crw';
  if (provider === 'youcom') return 'youcom';
  if (provider === 'tavily') return 'tavily';
  return 'searxng';
};

export const getCrwURL = () =>
  configManager.getConfig('search.crwURL', 'https://fastcrw.com/api');

export const getCrwApiKey = () => configManager.getConfig('search.crwApiKey', '');

export const getYoucomApiKey = (): string => {
  return (
    configManager.getConfig('search.youcomApiKey', '') ||
    process.env.YDC_API_KEY ||
    ''
  );
};
