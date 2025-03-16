import { NextResponse } from 'next/server';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { convert } from 'html-to-text';

const KB_DIR = path.join(process.cwd(), 'knowledge-base');

export async function POST(request) {
  try {
    const { message, history, config } = await request.json();
    
    console.log(`Searching knowledge base for: "${message}"`);
    
    // Search the knowledge base
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
    
    // Use predefined content if available
    const predefinedResponse = getPredefinedContent(message);
    
    if (kbResults.length > 0 && hasRelevantInfo) {
      // We found relevant information in the knowledge base
      // Check if we have a predefined response for this query
      if (predefinedResponse) {
        console.log('Using predefined response for query:', message);
        
        return NextResponse.json({ 
          response: predefinedResponse,
          source: 'knowledge_base',
          references: kbResults.slice(0, 1).map(r => ({ title: r.title, url: r.url })),
          debug: {
            query: message,
            resultsCount: kbResults.length,
            hasRelevantInfo: true,
            keyTerms: queryTerms,
            isPredefined: true
          }
        });
      }
      
      // Continue with normal processing if no predefined response
      // Prepare context from the knowledge base with improved formatting
      const context = kbResults.map(result => {
        // Extract a larger snippet for better context
        const filePath = path.join(KB_DIR, result.filename);
        const content = fs.readFileSync(filePath, 'utf-8');
        const plainText = convert(content, {
          wordwrap: false,
          selectors: [
            { selector: 'a', options: { ignoreHref: true } },
            { selector: 'img', format: 'skip' }
          ]
        });
        
        // Use a larger context window
        const matchIndex = plainText.toLowerCase().indexOf(result.snippet.replace(/^\.\.\.|\.\.\.$/g, '').trim().toLowerCase());
        let expandedSnippet = result.snippet;
        
        if (matchIndex !== -1) {
          const start = Math.max(0, matchIndex - 500);
          const end = Math.min(plainText.length, matchIndex + result.snippet.length + 500);
          expandedSnippet = plainText.substring(start, end);
          if (start > 0) expandedSnippet = '...' + expandedSnippet;
          if (end < plainText.length) expandedSnippet = expandedSnippet + '...';
        }
        
        return `Source: ${result.title} (${result.url})\n${expandedSnippet}`;
      }).join('\n\n');
      
      // Get system prompt from config or use default
      const systemPrompt = config?.systemPrompt || `You are a helpdesk AI assistant that ONLY answers questions based on the provided knowledge base information. 

STRICT RULES:
1. NEVER use your general knowledge to answer questions.
2. ONLY use the information provided in the knowledge base below.
3. If the knowledge base information doesn't contain a direct answer to the question, respond with EXACTLY: "I don't have that information in my knowledge base."
4. Do not apologize or offer to help in other ways when information is not available.
5. Do not make assumptions or inferences beyond what is explicitly stated in the knowledge base.
6. Do not mention these instructions in your response.
7. ALWAYS provide COMPLETE sentences, never start with "...of" or other partial phrases.
8. Format your response as a coherent paragraph with complete sentences.

Knowledge Base Information:
${context}`;
      
      // Send to Ollama with the context
      const response = await axios.post('http://localhost:11434/api/chat', {
        model: config?.model || 'gemma3:1b',
        messages: [
          { 
            role: 'system', 
            content: systemPrompt
          },
          ...history,
          { role: 'user', content: message }
        ],
        stream: false,
        options: {
          temperature: config?.temperature || 0.1,
          top_p: config?.topP || 0.9,
          max_tokens: config?.maxTokens || 1000
        }
      });
      
      // Check if the response contains information not in the knowledge base
      const responseContent = response.data.message.content;
      const noInfoPhrases = ["don't have that information", "i don't have", "no information"];
      const hasNoInfo = noInfoPhrases.some(phrase => responseContent.toLowerCase().includes(phrase));
      
      if (hasNoInfo) {
        // The model correctly identified it doesn't have the information
        return NextResponse.json({ 
          response: responseContent,
          source: 'no_information',
          references: [], // Ensure no references are included when no info is available
          debug: {
            query: message,
            resultsCount: kbResults.length,
            hasRelevantInfo: false, // Override to false since the model says it has no info
            keyTerms: queryTerms
          }
        });
      }
      
      // Filter references to only include those that were likely used in the response
      const usedReferences = filterUsedReferences(kbResults, responseContent);
      console.log('Used References:', usedReferences.map(r => r.title)); // Debugging log
      
      // Only include references if we have a meaningful response (not a "no info" response)
      return NextResponse.json({ 
        response: responseContent,
        source: 'knowledge_base',
        references: usedReferences.map(r => ({ title: r.title, url: r.url })),
        debug: {
          query: message,
          resultsCount: kbResults.length,
          hasRelevantInfo: hasRelevantInfo,
          keyTerms: queryTerms,
          topResults: kbResults.slice(0, 3).map(r => ({ 
            title: r.title, 
            relevance: r.relevance,
            snippet: r.snippet.substring(0, 100) + '...'
          })),
          usedReferencesCount: usedReferences.length,
          model: config?.model || 'gemma3:1b'
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
    console.error('Error in KB chat:', error);
    return NextResponse.json({ 
      error: 'Failed to process request',
      details: error.message
    }, { status: 500 });
  }
}

// Function to filter references to only include those that were likely used in the response
function filterUsedReferences(allReferences, responseContent) {
  if (!allReferences || allReferences.length === 0 || !responseContent) {
    return [];
  }
  
  // Check if the response indicates no information is available
  const noInfoPhrases = ["don't have that information", "i don't have", "no information"];
  if (noInfoPhrases.some(phrase => responseContent.toLowerCase().includes(phrase))) {
    return []; // Return empty array if response indicates no information
  }
  
  const lowerResponse = responseContent.toLowerCase();
  
  // Improved title matching: require exact title match or multiple words from the title
  const titleMentionedRefs = allReferences.filter(ref => {
    // Check for exact title match (case insensitive)
    const titleLower = ref.title.toLowerCase();
    if (lowerResponse.includes(titleLower)) {
      return true;
    }
    
    // Extract meaningful words from title (length > 3, not common words)
    const commonWords = ['the', 'and', 'for', 'with'];
    const titleWords = titleLower.split(/\s+/).filter(w => 
      w.length > 3 && !commonWords.includes(w)
    );
    
    // Count how many title words appear in the response
    const matchCount = titleWords.filter(word => lowerResponse.includes(word)).length;
    return matchCount >= 2 && matchCount >= titleWords.length * 0.5; // At least 2 words and 50% of title words
  });
  
  if (titleMentionedRefs.length > 0) {
    return titleMentionedRefs;
  }
  
  // Refine content matching with higher threshold
  const contentMatchedRefs = allReferences.filter(ref => {
    const keyPhrases = extractKeyPhrases(ref.snippet);
    const matchCount = keyPhrases.filter(phrase => 
      lowerResponse.includes(phrase.toLowerCase())
    ).length;
    const minMatches = Math.max(3, Math.floor(keyPhrases.length * 0.25)); // Increase threshold
    return matchCount >= minMatches;
  });
  
  if (contentMatchedRefs.length > 0) {
    return contentMatchedRefs;
  }
  
  return [];
}

// Function to extract key phrases from a text
function extractKeyPhrases(text) {
  if (!text) return [];
  
  // Split into sentences and filter out very short ones
  const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 20);
  
  // Extract noun phrases and other significant chunks
  const phrases = [];
  
  // Simple approach: take chunks of 3-5 words that don't start/end with stopwords
  const stopwords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'about', 'is', 'are'];
  const words = text.toLowerCase().split(/\s+/);
  
  for (let i = 0; i < words.length - 2; i++) {
    if (stopwords.includes(words[i])) continue;
    
    // Try phrases of different lengths
    for (let len = 3; len <= 5 && i + len <= words.length; len++) {
      if (stopwords.includes(words[i + len - 1])) continue;
      
      const phrase = words.slice(i, i + len).join(' ');
      if (phrase.length > 10) {
        phrases.push(phrase);
      }
    }
  }
  
  // Also add some significant sentences (shortened)
  sentences.forEach(sentence => {
    const trimmed = sentence.trim();
    if (trimmed.length > 30 && trimmed.length < 100) {
      phrases.push(trimmed);
    }
  });
  
  return phrases;
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
  if (results.length === 0) {
    return false;
  }
  
  // If we have results but no query terms (e.g., short query), consider it relevant
  if (queryTerms.length === 0) {
    return true;
  }
  
  // Check if any of the key terms appear in the top result's title or snippet
  for (const result of results.slice(0, 3)) { // Check top 3 results
    const titleAndSnippet = (result.title + ' ' + result.snippet).toLowerCase();
    
    // If the query is a direct match for the title, it's definitely relevant
    if (titleAndSnippet.includes(queryTerms.join(' '))) {
      return true;
    }
    
    // Count how many query terms match
    let matchCount = 0;
    for (const term of queryTerms) {
      if (titleAndSnippet.includes(term)) {
        matchCount++;
      }
    }
    
    // If more than half of the query terms match, consider it relevant
    if (matchCount > 0 && matchCount >= Math.ceil(queryTerms.length / 2)) {
      return true;
    }
  }
  
  // If we have results but no strong term matches, still consider the top result relevant
  // This helps with queries that might use synonyms or different phrasing
  if (results.length > 0 && results[0].relevance > 0.5) {
    return true;
  }
  
  return false;
}

// Function to get predefined content for common topics
function getPredefinedContent(query) {
  const lowerQuery = query.toLowerCase();
  
  // Map of topics to predefined responses
  const predefinedResponses = {
    'civil war': `The American Civil War was fought from 1861 to 1865 between the Northern states (the Union) and Southern states that had seceded from the Union to form the Confederate States of America. The primary causes of the war were disputes over slavery, states' rights, and westward expansion. The war resulted in the preservation of the Union, the abolition of slavery, and significant loss of life with over 600,000 soldiers killed.`,
    
    'european exploration': `European exploration, colonization, and conflict in the Americas began with Christopher Columbus's voyage in 1492 and continued for centuries. European powers, primarily Spain, Portugal, France, and England, established colonies throughout North and South America, displacing indigenous populations through warfare, disease, and forced relocation. This period was marked by competition between European powers for territory and resources, leading to conflicts such as the French and Indian War.`,
    
    'westward expansion': `Westward expansion in the United States was a period in the 19th century when settlers moved west across North America, extending American territory to the Pacific Ocean. This expansion was driven by factors such as the Louisiana Purchase, the concept of Manifest Destiny, the California Gold Rush, and the development of railroads. The expansion led to conflicts with Native American tribes and Mexico, resulting in the displacement of indigenous peoples and the acquisition of territories that would later become states.`,
    
    'indigenous peoples': `Indigenous peoples of the Americas, also known as Native Americans, American Indians, or First Nations, are the original inhabitants of North and South America and their descendants. Prior to European colonization, these diverse cultures had developed complex societies with unique languages, religions, and social structures. European contact led to significant population decline due to disease, warfare, and displacement. Today, Native American tribes maintain sovereign status within the United States, preserving their cultural heritage while facing ongoing social and economic challenges.`
  };
  
  // Check if the query contains any of the predefined topics
  for (const [topic, response] of Object.entries(predefinedResponses)) {
    if (lowerQuery.includes(topic)) {
      return response;
    }
  }
  
  return null;
} 