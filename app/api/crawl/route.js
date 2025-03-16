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

export async function POST(request) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    // Fetch the webpage
    const response = await axios.get(url);
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
      message: 'URL crawled and added to knowledge base',
      document: {
        title,
        url,
        filename
      }
    });
    
  } catch (error) {
    console.error('Error crawling URL:', error);
    return NextResponse.json(
      { error: 'Failed to crawl URL', details: error.message },
      { status: 500 }
    );
  }
} 