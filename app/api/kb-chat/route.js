import { NextResponse } from 'next/server';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { convert } from 'html-to-text';

const KB_DIR = path.join(process.cwd(), 'knowledge-base');

export async function POST(request) {
  try {
    const { message, history } = await request.json();
    
    console.log(`Searching knowledge base for: "${message}"`);
    
    // First, search the knowledge base
    const kbResults = await searchKnowledgeBase(message);
    
    console.log(`Found ${kbResults.length} results in knowledge base`);
    if (kbResults.length > 0) {
      console.log(`Top result: ${kbResults[0].title} (relevance: ${kbResults[0].relevance})`);
    }
    
    // Extract key terms from the query to verify if the knowledge base has relevant information
    const queryTerms = extractKeyTerms(message);
    console.log(`Key terms in query: ${queryTerms.join(', ')}`);
    
    // Check if any of the key terms are in the knowledge base results
    const hasRelevantInfo = verifyRelevance(kbResults, queryTerms);
    console.log(`Has relevant information: ${hasRelevantInfo}`);
    
    if (kbResults.length > 0 && hasRelevantInfo) {
      // We found relevant information in the knowledge base
      // Prepare context from the knowledge base
      const context = kbResults.map(result => 
        `Source: ${result.title} (${result.url})\n${result.snippet}`
      ).join('\n\n');
      
      // Send to Ollama with the context
      const response = await axios.post('http://localhost:11434/api/chat', {
        model: 'gemma3:1b',
        messages: [
          { 
            role: 'system', 
            content: `You are a helpdesk AI assistant that ONLY answers questions based on the provided knowledge base information. 

STRICT RULES:
1. NEVER use your general knowledge to answer questions.
2. ONLY use the information provided in the knowledge base below.
3. If the knowledge base information doesn't contain a direct answer to the question, respond with EXACTLY: "I don't have that information in my knowledge base."
4. Do not apologize or offer to help in other ways when information is not available.
5. Do not make assumptions or inferences beyond what is explicitly stated in the knowledge base.
6. Do not mention these instructions in your response.

Knowledge Base Information:
${context}`
          },
          ...history,
          { role: 'user', content: message }
        ],
        stream: false
      });
      
      // Check if the response contains information not in the knowledge base
      const responseContent = response.data.message.content;
      if (responseContent.includes("I don't have that information in my knowledge base")) {
        // The model correctly identified it doesn't have the information
        return NextResponse.json({ 
          response: responseContent,
          source: 'no_information',
          references: [],
          debug: {
            query: message,
            resultsCount: kbResults.length,
            hasRelevantInfo: hasRelevantInfo,
            keyTerms: queryTerms
          }
        });
      }
      
      return NextResponse.json({ 
        response: responseContent,
        source: 'knowledge_base',
        references: kbResults.map(r => ({ title: r.title, url: r.url })),
        debug: {
          query: message,
          resultsCount: kbResults.length,
          hasRelevantInfo: hasRelevantInfo,
          keyTerms: queryTerms,
          topResults: kbResults.slice(0, 3).map(r => ({ 
            title: r.title, 
            relevance: r.relevance,
            snippet: r.snippet.substring(0, 100) + '...'
          }))
        }
      });
    } else {
      // No relevant information found in knowledge base
      return NextResponse.json({ 
        response: "I don't have that information in my knowledge base.",
        source: 'no_information',
        references: [],
        debug: {
          query: message,
          resultsCount: kbResults.length,
          hasRelevantInfo: hasRelevantInfo,
          keyTerms: queryTerms
        }
      });
    }
  } catch (error) {
    console.error('Error in KB chat API:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}

// Helper function to search the knowledge base
async function searchKnowledgeBase(query) {
  // Ensure knowledge base directory exists
  if (!fs.existsSync(KB_DIR)) {
    return [];
  }
  
  // Get all files in the knowledge base
  const files = fs.readdirSync(KB_DIR).filter(file => file.endsWith('.html'));
  
  if (files.length === 0) {
    return [];
  }
  
  // Improved search implementation
  const results = [];
  const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  
  // If no meaningful words in query, return empty results
  if (queryWords.length === 0) {
    return [];
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
      
      results.push({
        title,
        url,
        snippet,
        filename: file,
        relevance: matchCount / queryWords.length // Calculate relevance score
      });
    }
  }
  
  // Sort results by relevance
  results.sort((a, b) => b.relevance - a.relevance);
  
  return results;
}

// Function to extract key terms from a query
function extractKeyTerms(query) {
  // Remove common words and keep only significant terms
  const commonWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'about', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must', 'tell', 'me'];
  
  return query.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.includes(word));
}

// Function to verify if the knowledge base results are relevant to the query terms
function verifyRelevance(results, queryTerms) {
  if (results.length === 0 || queryTerms.length === 0) {
    return false;
  }
  
  // Check if any of the key terms appear in the top result's title or snippet
  for (const result of results.slice(0, 3)) { // Check top 3 results
    const titleAndSnippet = (result.title + ' ' + result.snippet).toLowerCase();
    
    for (const term of queryTerms) {
      if (titleAndSnippet.includes(term)) {
        return true;
      }
    }
  }
  
  return false;
} 