require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { URL } = require('url');
const { OpenAI } = require('openai');
const util = require('util');
const fs = require('fs').promises;
const { marked } = require('marked');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class SEOCrawler {
  constructor(baseUrl, maxDepth = 3) {
    this.baseUrl = new URL(baseUrl).href;
    this.baseDomain = new URL(baseUrl).hostname;
    this.maxDepth = maxDepth;
    this.visited = new Set();
    this.results = [];
    this.internalLinks = new Set();
  }

  async crawl(url = this.baseUrl, depth = 0) {
    if (depth > this.maxDepth || this.visited.has(url)) {
      console.log(`Skipping ${url} (Depth: ${depth}, Already Visited: ${this.visited.has(url)})`);
      return;
    }
    this.visited.add(url);
    console.log(`Crawling: ${url} (Depth: ${depth})`);

    try {
      const response = await axios.get(url, { timeout: 5000 });
      const html = response.data;
      const $ = cheerio.load(html);

      const analysis = await this.analyzePage(url, html, $);
      this.results.push(analysis);

      const links = new Set();
      $('a[href]').each((i, elem) => {
        const link = $(elem).attr('href');
        try {
          const absoluteUrl = new URL(link, this.baseUrl).href;
          const linkDomain = new URL(absoluteUrl).hostname;
          if (linkDomain === this.baseDomain && !absoluteUrl.includes('#')) {
            links.add(absoluteUrl);
            this.internalLinks.add(absoluteUrl);
          }
        } catch (e) {
          console.log(`Invalid URL skipped: ${link}`);
        }
      });

      for (const link of links) {
        if (!this.visited.has(link)) {
          await this.crawl(link, depth + 1);
        }
      }
    } catch (error) {
      console.log(`Error crawling ${url}: ${error.message}`);
      this.results.push({ url, error: `Failed to fetch: ${error.message}` });
    }
  }

  async analyzePage(url, html, $) {
    const analysis = { 
      url, 
      issues: [], 
      suggestions: [], 
      metrics: { 
        title: '', 
        metaDesc: '', 
        h1: '', 
        wordCount: 0, 
        internalLinks: 0, 
        loadTime: 'N/A',
        performanceDetails: {}
      } 
    };

    const title = $('title').text() || '';
    if (!title) analysis.issues.push('Missing <title> tag');
    else if (title.length > 60) analysis.issues.push(`Title too long (${title.length} chars)`);
    else if (title.length < 30) analysis.issues.push('Title too short for keyword optimization');
    analysis.metrics.title = title;

    const metaDesc = $('meta[name="description"]').attr('content') || '';
    if (!metaDesc) analysis.issues.push('Missing meta description');
    else if (metaDesc.length > 160) analysis.issues.push(`Meta description too long (${metaDesc.length} chars)`);
    else if (metaDesc.length < 70) analysis.issues.push('Meta description too short');
    analysis.metrics.metaDesc = metaDesc;

    const h1Count = $('h1').length;
    if (h1Count === 0) analysis.issues.push('No H1 tag found');
    else if (h1Count > 1) analysis.issues.push(`Multiple H1 tags found (${h1Count})`);
    analysis.metrics.h1 = $('h1').first().text() || '';

    const textContent = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = textContent.split(' ').length;
    if (wordCount < 300) analysis.issues.push(`Low word count (${wordCount})`);
    analysis.metrics.wordCount = wordCount;

    const internalLinkCount = $('a[href]').filter((i, el) => {
      const href = $(el).attr('href');
      try {
        return new URL(href, this.baseUrl).hostname === this.baseDomain;
      } catch {
        return false;
      }
    }).length;
    analysis.metrics.internalLinks = internalLinkCount;

    let imagesWithoutAlt = 0;
    $('img').each((i, img) => {
      if (!$(img).attr('alt')) imagesWithoutAlt++;
    });
    if (imagesWithoutAlt > 0) analysis.issues.push(`${imagesWithoutAlt} image(s) missing alt text`);

    try {
      const browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      const performanceTiming = JSON.parse(
        await page.evaluate(() => JSON.stringify(performance.timing))
      );
      const loadTime = (performanceTiming.loadEventEnd - performanceTiming.navigationStart) / 1000;
      if (loadTime > 3) analysis.issues.push(`Page load time too slow (${loadTime.toFixed(2)}s)`);
      analysis.metrics.loadTime = loadTime.toFixed(2);

      const performanceData = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        return {
          dnsLookup: (performance.timing.domainLookupEnd - performance.timing.domainLookupStart) / 1000,
          tcpConnect: (performance.timing.connectEnd - performance.timing.connectStart) / 1000,
          requestTime: (performance.timing.responseEnd - performance.timing.requestStart) / 1000,
          domContentLoaded: (performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart) / 1000,
          largeResources: resources
            .filter(r => r.transferSize > 100000)
            .map(r => ({ name: r.name, size: r.transferSize / 1024 }))
        };
      });
      analysis.metrics.performanceDetails = performanceData;

      const viewport = await page.evaluate(() => ({
        mobileFriendly: !!document.querySelector('meta[name="viewport"][content*="width=device-width"]')
      }));
      if (!viewport.mobileFriendly) analysis.issues.push('Not mobile-friendly');

      await browser.close();
    } catch (error) {
      console.log(`Puppeteer error for ${url}: ${error.message}`);
      analysis.issues.push(`Page speed analysis failed: ${error.message}`);
      analysis.metrics.loadTime = 'N/A';
    }

    await this.generateSuggestions(analysis);
    return analysis;
  }

  async generateSuggestions(analysis) {
    const { metrics } = analysis;

    const ruleBasedSuggestions = [];
    const llmSuggestions = [];

    analysis.issues.forEach(issue => {
      switch (true) {
        case issue.includes('Missing <title>'):
          ruleBasedSuggestions.push('Craft a unique <title> (50-60 chars) incorporating your primary keyword to boost relevance.');
          break;
        case issue.includes('Title too long'):
          ruleBasedSuggestions.push(`Trim the title to 60 chars max, prioritizing your main keyword (e.g., "${metrics.title.slice(0, 57)}...").`);
          break;
        case issue.includes('Title too short'):
          ruleBasedSuggestions.push('Expand the title to 50-60 chars with a secondary keyword to improve ranking potential.');
          break;
        case issue.includes('Missing meta description'):
          ruleBasedSuggestions.push('Add a compelling meta description (150-160 chars) with a call-to-action and target keywords.');
          break;
        case issue.includes('No H1 tag'):
          ruleBasedSuggestions.push('Add a single H1 with your primary keyword, aligning with user intent (e.g., "Shane Larson - Software & Games").');
          break;
        case issue.includes('Page load time too slow'):
          ruleBasedSuggestions.push(`Optimize assets: compress images, lazy-load offscreen content, and leverage browser caching (current: ${metrics.loadTime}s).`);
          break;
        case issue.includes('Not mobile-friendly'):
          ruleBasedSuggestions.push('Add `<meta name="viewport" content="width=device-width, initial-scale=1">` and test responsiveness across devices.');
          break;
      }
    });

    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not found in .env file');
      }
      const prompt = `
        Given the following SEO analysis for ${analysis.url}:
        Issues: ${JSON.stringify(analysis.issues)}
        Metrics: ${JSON.stringify(analysis.metrics)}
        Provide detailed, actionable suggestions to improve SEO and page performance. Focus on specific causes of slow load times (if applicable) and advanced SEO strategies.
      `;
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
      });
      llmSuggestions.push(...response.choices[0].message.content.split('\n').filter(s => s.trim()));
    } catch (error) {
      console.log(`LLM suggestion error for ${analysis.url}: ${error.message}`);
      llmSuggestions.push('Could not generate advanced suggestions due to LLM error.');
    }

    analysis.suggestions = { ruleBased: ruleBasedSuggestions, llm: llmSuggestions };
  }

  async generateSitemap() {
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    let sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    // Only include URLs that were successfully crawled (no errors)
    const validUrls = this.results.filter(result => !result.error);
    validUrls.forEach((result, index) => {
      // Assign priority: 1.0 for homepage, 0.8 for first-level pages, 0.6 for deeper pages
      const depth = result.url.split('/').filter(segment => segment).length - this.baseUrl.split('/').filter(segment => segment).length;
      const priority = depth === 0 ? '1.0' : depth === 1 ? '0.8' : '0.6';

      sitemapContent += `
  <url>
    <loc>${result.url}</loc>
    <lastmod>${currentDate}</lastmod>
    <priority>${priority}</priority>
  </url>`;
    });

    sitemapContent += `
</urlset>`;

    const outputFile = 'sitemap.xml';
    await fs.writeFile(outputFile, sitemapContent);
    console.log(`Sitemap saved to ${outputFile}`);
  }

  async run() {
    await this.crawl();

    // Generate Sitemap
    await this.generateSitemap();

    // Generate HTML report
    let htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SEO Analysis Report - ${this.baseUrl}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
          h1 { color: #333; }
          .url-section { margin-bottom: 40px; padding: 20px; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          h2 { color: #007bff; }
          h3 { color: #555; }
          ul { list-style-type: disc; padding-left: 20px; }
          pre { background-color: #f8f9fa; padding: 10px; border-radius: 5px; overflow-x: auto; }
          .error { color: #dc3545; }
          .markdown-content { line-height: 1.6; }
          .markdown-content h1, .markdown-content h2, .markdown-content h3 { margin-top: 20px; }
          .markdown-content ul { list-style-type: disc; padding-left: 20px; }
          .markdown-content li { margin-bottom: 8px; }
          .markdown-content strong { font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>SEO Analysis Report</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
        <p>Base URL: <a href="${this.baseUrl}" target="_blank">${this.baseUrl}</a></p>
        <p>Total Pages Analyzed: ${this.results.length}</p>
    `;

    this.results.forEach(result => {
      htmlContent += `
        <div class="url-section">
          <h2>URL: <a href="${result.url}" target="_blank">${result.url}</a></h2>
      `;
      if (result.error) {
        htmlContent += `
          <h3>Error</h3>
          <p class="error">${result.error}</p>
        `;
      } else {
        const llmMarkdownContent = result.suggestions.llm.join('\n');
        const llmHtmlContent = marked.parse(llmMarkdownContent);

        htmlContent += `
          <h3>Issues</h3>
          ${result.issues.length ? `<ul>${result.issues.map(issue => `<li>${issue}</li>`).join('')}</ul>` : '<p>No issues found.</p>'}
          <h3>Rule-Based Suggestions</h3>
          ${result.suggestions.ruleBased.length ? `<ul>${result.suggestions.ruleBased.map(suggestion => `<li>${suggestion.replace(/</g, '<').replace(/>/g, '>')}</li>`).join('')}</ul>` : '<p>No rule-based suggestions.</p>'}
          <h3>AI-Generated Suggestions</h3>
          <div class="markdown-content">${llmHtmlContent}</div>
          <h3>Metrics</h3>
          <pre>${util.inspect(result.metrics, { depth: null, colors: false })}</pre>
        `;
      }
      htmlContent += `</div>`;
    });

    htmlContent += `
      </body>
      </html>
    `;

    const outputFile = 'seo_report.html';
    await fs.writeFile(outputFile, htmlContent);
    console.log(`\nSEO Analysis Report saved to ${outputFile}`);
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Please provide a URL, e.g., node seoCrawler.js https://example.com');
  process.exit(1);
}

const targetUrl = args[0];
try {
  new URL(targetUrl);
} catch (error) {
  console.error('Invalid URL provided. Please use a valid URL (e.g., https://example.com)');
  process.exit(1);
}

const crawler = new SEOCrawler(targetUrl);
crawler.run().catch(error => {
  console.error('An error occurred:', error.message);
});