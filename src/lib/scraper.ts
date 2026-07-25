import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { Mutex } from 'async-mutex';

function isBlockedIPv4(ip: string): boolean {
  const [a, b, c, d] = ip.split('.').map(Number);
  return (
    (a === 10) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isBlockedIPv6(ip: string): boolean {
  return ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:');
}

function isBlockedHostname(hostname: string): boolean {
  return hostname.endsWith('.localhost') ||
         hostname.endsWith('.local') ||
         hostname.endsWith('.internal') ||
         hostname.endsWith('.lan');
}

function assertSafeScrapeURL(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Only HTTP(S) protocols allowed: ${url}`);
  }

  if (parsed.hostname === 'localhost') {
    throw new Error(`Localhost scraping blocked: ${url}`);
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error(`Restricted hostname blocked: ${url}`);
  }

  const ipRegex = /^\d+\.\d+\.\d+\.\d+$/;
  if (ipRegex.test(parsed.hostname)) {
    if (isBlockedIPv4(parsed.hostname)) {
      throw new Error(`Private IP address blocked: ${url}`);
    }
  }

  if (parsed.hostname.includes(':')) {
    if (isBlockedIPv6(parsed.hostname)) {
      throw new Error(`Private IPv6 address blocked: ${url}`);
    }
  }
}

class Scraper {
  private static browser: any | undefined;
  private static IDLE_KILL_TIMEOUT = 30000;
  private static NAVIGATION_TIMEOUT = 20000;
  private static idleTimeout: NodeJS.Timeout | undefined;
  private static browserMutex = new Mutex();
  private static userCount = 0;

  private static async initBrowser() {
    await this.browserMutex.runExclusive(async () => {
      if (!this.browser) {
        const browserType = process.env.SCRAPER_BROWSER_TYPE || 'chromium';
        const playwright = await import('playwright');
        const engine = playwright[browserType as 'chromium' | 'firefox' | 'webkit'];
        const executablePath = process.env.SCRAPER_EXECUTABLE_PATH;
        this.browser = await engine.launch({
          headless: true,
          ...(browserType === 'chromium'
            ? {
                channel: 'chromium-headless-shell',
                args: [
                  '--no-sandbox',
                  '--disable-setuid-sandbox',
                  '--disable-dev-shm-usage',
                  '--disable-gpu',
                  '--disable-blink-features=AutomationControlled',
                ],
              }
            : {}),
          ...(executablePath ? { executablePath } : {}),
        });
      }

      if (this.idleTimeout) clearTimeout(this.idleTimeout);
    });
  }

  private static scheduleIdleKill() {
    if (this.idleTimeout) clearTimeout(this.idleTimeout);

    this.idleTimeout = setTimeout(async () => {
      await this.browserMutex.runExclusive(async () => {
        if (this.browser && this.userCount === 0) {
          {
            await this.browser.close();
            this.browser = undefined;
          }
        }
      });
    }, this.IDLE_KILL_TIMEOUT);
  }

  static async scrape(
    url: string,
  ): Promise<{ content: string; title: string }> {
    assertSafeScrapeURL(url);

    await this.initBrowser();

    if (!this.browser) throw new Error('Browser not initialized');

    const context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    this.userCount++;

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.NAVIGATION_TIMEOUT,
      });

      await page
        .waitForLoadState('load', { timeout: 5000 })
        .catch(() => undefined);
      await page.waitForTimeout(500);

      const html = await page.content();

      const dom = new JSDOM(html, {
        url,
      });

      const content = new Readability(dom.window.document).parse();

      const title = await page.title();

      return {
        content: `
        # ${title ?? 'No title'} - ${url}
        ${content?.textContent?.trim() ?? 'No content available'}
        `,
        title,
      };
    } catch (err) {
      console.log(`Error scraping ${url}:`, err);

      return {
        title: 'Failed to scrape',
        content: `# ${url}\n\nError scraping content.`,
      };
    } finally {
      this.userCount--;

      await context.close().catch(() => undefined);

      if (this.userCount === 0) {
        this.scheduleIdleKill();
      }
    }
  }
}

export default Scraper;
