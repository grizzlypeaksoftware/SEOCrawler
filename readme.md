# SEO Crawler

A powerful JavaScript-based SEO crawler that analyzes websites, generates detailed SEO reports, and creates a sitemap. It uses modern tools like Puppeteer for performance analysis and OpenAI's GPT-4o-mini for AI-generated suggestions.

## Features
- **Website Crawling**: Recursively crawls a website up to a specified depth, analyzing main pages and subpages.
- **SEO Analysis**: Identifies SEO issues such as missing titles, meta descriptions, H1 tags, low word count, and more.
- **Performance Analysis**: Measures page load times and identifies bottlenecks (e.g., large resources, slow server response).
- **AI Suggestions**: Uses OpenAI's GPT-4o-mini to provide advanced, context-aware SEO and performance optimization suggestions.
- **HTML Report**: Generates a styled HTML report with issues, rule-based suggestions, AI-generated suggestions (rendered from Markdown), and metrics.
- **Sitemap Generation**: Creates a `sitemap.xml` file for all successfully crawled pages, including metadata like `lastmod` and `priority`.

## Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/grizzlypeaksoftware/SEOCrawler.git
   cd seo-crawler
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
   This installs required packages: `axios`, `cheerio`, `puppeteer`, `openai`, `marked`, and `dotenv`.

3. Set up your OpenAI API key:
   - Create a `.env` file in the project root.
   - Add your OpenAI API key:
     ```
     OPENAI_API_KEY=your-openai-api-key
     ```
   - **Note**: Do not commit `.env` to version control. Add it to `.gitignore`.

## Usage
Run the script with a target URL:
```bash
node seoCrawler.js https://example.com
```
- Optionally, specify a crawling depth (default is 3):
  ```bash
  node seoCrawler.js https://example.com 5
  ```

### Output
- **HTML Report**: A detailed report is saved as `seo_report.html`, including SEO issues, suggestions, and metrics for each page.
- **Sitemap**: A `sitemap.xml` file is generated with all crawled URLs, ready to submit to search engines.

### Example Output
- **Console**:
  ```
  Crawling: https://example.com/ (Depth: 0)
  Crawling: https://example.com/about (Depth: 1)
  Sitemap saved to sitemap.xml
  SEO Analysis Report saved to seo_report.html
  ```
- **Sitemap (`sitemap.xml`)**:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://example.com/</loc>
      <lastmod>2025-03-01</lastmod>
      <priority>1.0</priority>
    </url>
    <!-- More URLs -->
  </urlset>
  ```
- **HTML Report**: Open `seo_report.html` in a browser to view a styled report with sections for each page.

## Dependencies
- `axios`: For making HTTP requests to fetch pages.
- `cheerio`: For parsing HTML and extracting elements.
- `puppeteer`: For performance analysis and mobile-friendliness checks.
- `openai`: For AI-generated suggestions using GPT-4o-mini.
- `marked`: For rendering Markdown suggestions as HTML.
- `dotenv`: For managing environment variables (e.g., API keys).

## Configuration
- **Crawling Depth**: Adjust `maxDepth` in the constructor or pass it as a command-line argument.
- **OpenAI API Key**: Ensure `OPENAI_API_KEY` is set in `.env`.
- **Timeouts**: Axios timeout is set to 5s, and Puppeteer navigation timeout is 30s. Adjust in the code if needed.

## Contributing
Contributions are welcome! To contribute:
1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature`).
3. Make your changes and commit (`git commit -m 'Add your feature'`).
4. Push to your branch (`git push origin feature/your-feature`).
5. Open a Pull Request.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Author
Built with ❤️ by Shane Larson. For questions, reach out at [shane@cortexagent.com]