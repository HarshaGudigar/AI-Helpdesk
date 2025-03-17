import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { convert } from 'html-to-text';
import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

// Create knowledge base directory if it doesn't exist
const KB_DIR = path.join(process.cwd(), 'knowledge-base');
if (!fs.existsSync(KB_DIR)) {
  fs.mkdirSync(KB_DIR, { recursive: true });
}

// Timeout for requests in milliseconds
const REQUEST_TIMEOUT = 30000;

export async function POST(request) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    console.log('Fetching URL:', url);
    
    try {
      // Validate URL format
      const urlObj = new URL(url);
      
      // Fetch the webpage with increased timeout and additional headers
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0'
        },
        timeout: REQUEST_TIMEOUT,
        maxRedirects: 5,
        validateStatus: status => status < 400
      });
      
      const html = response.data;
      
      // Parse the HTML
      const $ = cheerio.load(html);
      
      // Remove unnecessary elements
      $('script, style, nav, footer, header, aside, iframe').remove();
      
      // Extract the main content
      const title = $('title').text() || 'Untitled';
      const mainContent = $('main, article, .content, #content, .main').html() || $('body').html();
      
      // Convert HTML to plain text
      const plainText = convert(mainContent, {
        wordwrap: 130,
        selectors: [
          { selector: 'a', options: { ignoreHref: true } },
          { selector: 'img', format: 'skip' }
        ]
      });
      
      // Create a structured document
      const document = {
        title,
        url,
        content: plainText,
        crawledAt: new Date().toISOString()
      };
      
      // Save as HTML file in knowledge base
      const filename = `${Buffer.from(url).toString('base64').replace(/[/+=]/g, '_')}.html`;
      const filePath = path.join(KB_DIR, filename);
      
      // Convert to nice HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title}</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; }
            a { color: #0066cc; }
            .metadata { color: #666; margin-bottom: 20px; font-size: 0.9em; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="metadata">
            <p>Source: <a href="${url}">${url}</a></p>
            <p>Crawled: ${document.crawledAt}</p>
          </div>
          <div class="content">
            ${marked.parse(plainText)}
          </div>
        </body>
        </html>
      `;
      
      fs.writeFileSync(filePath, htmlContent);
      
      return NextResponse.json({
        success: true,
        document: {
          title,
          url,
          filename
        }
      });
    } catch (error) {
      console.error('Error crawling URL:', error);
      
      // Create a fallback document if there's an error
      try {
        const domain = new URL(url).hostname;
        const title = domain || 'Website';
        const filename = `${Buffer.from(url).toString('base64').replace(/[/+=]/g, '_')}.html`;
        const filePath = path.join(KB_DIR, filename);
        
        // Create a simple HTML document with the URL
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>${title}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
              h1 { color: #333; }
              a { color: #0066cc; }
              .metadata { color: #666; margin-bottom: 20px; font-size: 0.9em; }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <div class="metadata">
              <p>Source: <a href="${url}">${url}</a></p>
              <p>Crawled: ${new Date().toISOString()}</p>
            </div>
            <div class="content">
              <p>This is a placeholder for the website ${url} which could not be crawled automatically.</p>
              <p>The website may have security measures that prevent automated crawling.</p>
              <p>Error: ${error.message || 'Unknown error'}</p>
            </div>
          </body>
          </html>
        `;
        
        fs.writeFileSync(filePath, htmlContent);
        
        return NextResponse.json({
          success: true,
          document: {
            title,
            url,
            filename,
            isFallback: true
          }
        });
      } catch (fallbackError) {
        console.error('Error creating fallback document:', fallbackError);
        return NextResponse.json(
          { error: `Failed to crawl URL: ${error.message}`, details: error.toString() },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error('Error in crawl API:', error);
    return NextResponse.json(
      { error: 'Failed to crawl URL', details: error.message },
      { status: 500 }
    );
  }
} 