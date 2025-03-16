import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request) {
  try {
    const { message, history } = await request.json();
    
    // Check if we have knowledge base data for this query
    // For now, we'll just use Ollama directly
    // In a real implementation, you would first check your knowledge base
    
    const response = await axios.post('http://localhost:11434/api/chat', {
      model: 'gemma3:1b',
      messages: [
        ...history,
        { role: 'user', content: message }
      ],
      stream: false
    });
    
    return NextResponse.json({ 
      response: response.data.message.content,
      source: 'model'
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
} 