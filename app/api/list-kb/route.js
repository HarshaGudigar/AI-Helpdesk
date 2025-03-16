import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const KB_DIR = path.join(process.cwd(), 'knowledge-base');

export async function GET() {
  try {
    // Ensure knowledge base directory exists
    if (!fs.existsSync(KB_DIR)) {
      fs.mkdirSync(KB_DIR, { recursive: true });
      return NextResponse.json({ 
        entries: [],
        count: 0,
        message: 'Knowledge base is empty'
      });
    }
    
    // Get all files in the knowledge base
    const files = fs.readdirSync(KB_DIR).filter(file => file.endsWith('.html'));
    
    if (files.length === 0) {
      return NextResponse.json({ 
        entries: [],
        count: 0,
        message: 'Knowledge base is empty'
      });
    }
    
    // Extract metadata from each file
    const entries = [];
    
    for (const file of files) {
      const filePath = path.join(KB_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Parse HTML to extract metadata
      const $ = cheerio.load(content);
      const title = $('title').text();
      const url = $('.metadata a').attr('href');
      const crawledAt = $('.metadata p:nth-child(2)').text().replace('Crawled: ', '');
      
      entries.push({
        title,
        url,
        filename: file,
        crawledAt
      });
    }
    
    // Sort by crawled date (newest first)
    entries.sort((a, b) => new Date(b.crawledAt) - new Date(a.crawledAt));
    
    return NextResponse.json({ 
      entries,
      count: entries.length
    });
    
  } catch (error) {
    console.error('Error listing knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to list knowledge base', details: error.message },
      { status: 500 }
    );
  }
} 