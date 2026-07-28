import { describe, expect, it } from 'vitest';
import configManager from '@/lib/config';

describe('ConfigManager', () => {
  describe('uiConfigSections', () => {
    it('includes showWeatherWidget toggle in preferences', () => {
      const preferences = configManager.uiConfigSections.preferences;

      const weatherWidgetConfig = preferences.find(
        (pref) => pref.key === 'showWeatherWidget',
      );

      expect(weatherWidgetConfig).toBeDefined();
      expect(weatherWidgetConfig?.name).toBe('Show weather widget');
      expect(weatherWidgetConfig?.type).toBe('switch');
      expect(weatherWidgetConfig?.default).toBe(true);
      expect(weatherWidgetConfig?.scope).toBe('client');
      expect(weatherWidgetConfig?.description).toBe(
        'Display the weather card on the home screen.',
      );
    });

    it('includes showNewsWidget toggle in preferences', () => {
      const preferences = configManager.uiConfigSections.preferences;

      const newsWidgetConfig = preferences.find(
        (pref) => pref.key === 'showNewsWidget',
      );

      expect(newsWidgetConfig).toBeDefined();
      expect(newsWidgetConfig?.name).toBe('Show news widget');
      expect(newsWidgetConfig?.type).toBe('switch');
      expect(newsWidgetConfig?.default).toBe(true);
      expect(newsWidgetConfig?.scope).toBe('client');
    });

    it('includes autoMediaSearch toggle in preferences', () => {
      const preferences = configManager.uiConfigSections.preferences;

      const autoMediaConfig = preferences.find(
        (pref) => pref.key === 'autoMediaSearch',
      );

      expect(autoMediaConfig).toBeDefined();
      expect(autoMediaConfig?.type).toBe('switch');
      expect(autoMediaConfig?.default).toBe(true);
    });
  });
});
