import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { convert } from 'html-to-text';
import * as cheerio from 'cheerio';

const KB_DIR = path.join(process.cwd(), 'knowledge-base');

export async function POST(request) {
  try {
    const { query } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }
    
    // Ensure knowledge base directory exists
    if (!fs.existsSync(KB_DIR)) {
      return NextResponse.json({ 
        results: [],
        message: 'Knowledge base is empty'
      });
    }
    
    // Get all files in the knowledge base
    const files = fs.readdirSync(KB_DIR).filter(file => file.endsWith('.html'));
    
    if (files.length === 0) {
      return NextResponse.json({ 
        results: [],
        message: 'Knowledge base is empty'
      });
    }
    
    // Improved search implementation
    const results = [];
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    // If no meaningful words in query, return empty results
    if (queryWords.length === 0) {
      return NextResponse.json({ 
        results: [],
        message: 'Query too short or contains only common words'
      });
    }
    
    for (const file of files) {
      const filePath = path.join(KB_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Parse HTML to extract metadata
      const $ = cheerio.load(content);
      const title = $('title').text();
      const url = $('.metadata a').attr('href');
      
      // Convert to plain text for searching
      const plainText = convert(content, {
        wordwrap: false,
        selectors: [
          { selector: 'a', options: { ignoreHref: true } },
          { selector: 'img', format: 'skip' }
        ]
      });
      
      const lowerText = plainText.toLowerCase();
      
      // Check if the document contains any of the query words
      let matchCount = 0;
      let bestMatchIndex = -1;
      let bestMatchWord = '';
      
      for (const word of queryWords) {
        if (lowerText.includes(word)) {
          matchCount++;
          
          // Find the position of this word in the text
          const index = lowerText.indexOf(word);
          if (bestMatchIndex === -1 || index < bestMatchIndex) {
            bestMatchIndex = index;
            bestMatchWord = word;
          }
        }
      }
      
      // If we have matches, add to results
      if (matchCount > 0) {
        // Extract a snippet of text around the best match
        const start = Math.max(0, bestMatchIndex - 200);
        const end = Math.min(plainText.length, bestMatchIndex + bestMatchWord.length + 200);
        let snippet = plainText.substring(start, end);
        
        // Add ellipsis if we're not at the beginning or end
        if (start > 0) snippet = '...' + snippet;
        if (end < plainText.length) snippet = snippet + '...';
        
        // Highlight the matching words in the snippet
        let highlightedSnippet = snippet;
        for (const word of queryWords) {
          if (snippet.toLowerCase().includes(word)) {
            const regex = new RegExp(`(${word})`, 'gi');
            highlightedSnippet = highlightedSnippet.replace(regex, '<strong>$1</strong>');
          }
        }
        
        results.push({
          title,
          url,
          snippet: highlightedSnippet,
          filename: file,
          relevance: matchCount / queryWords.length // Calculate relevance score
        });
      }
    }
    
    // Sort results by relevance
    results.sort((a, b) => b.relevance - a.relevance);
    
    return NextResponse.json({ 
      results,
      count: results.length
    });
    
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to search knowledge base', details: error.message },
      { status: 500 }
    );
  }
} 