import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request) {
  const { message, history } = await request.json();

  // Set up streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Make a streaming request to Ollama
        const response = await axios.post('http://localhost:11434/api/chat', {
          model: 'gemma3:1b',
          messages: [
            ...history,
            { role: 'user', content: message }
          ],
          stream: true
        }, {
          responseType: 'stream'
        });

        // Process the streaming response
        response.data.on('data', (chunk) => {
          try {
            const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
            
            for (const line of lines) {
              const data = JSON.parse(line);
              
              if (data.message?.content) {
                controller.enqueue(encoder.encode(data.message.content));
              }
              
              // If done, close the stream
              if (data.done) {
                controller.close();
              }
            }
          } catch (error) {
            console.error('Error processing stream chunk:', error);
            controller.error(error);
          }
        });

        response.data.on('error', (error) => {
          console.error('Stream error:', error);
          controller.error(error);
        });

      } catch (error) {
        console.error('Error in streaming chat:', error);
        controller.error(error);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked'
    }
  });
} 