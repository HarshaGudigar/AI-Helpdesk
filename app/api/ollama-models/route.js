import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function GET() {
  try {
    // Execute the ollama list command
    const { stdout, stderr } = await execPromise('ollama list');
    
    if (stderr) {
      console.error('Error executing ollama list:', stderr);
      return NextResponse.json({ 
        error: 'Failed to fetch Ollama models',
        details: stderr
      }, { status: 500 });
    }
    
    // Parse the output to extract model names
    const lines = stdout.trim().split('\n');
    
    // Skip the header line if it exists
    const modelLines = lines.length > 0 && lines[0].includes('NAME') ? lines.slice(1) : lines;
    
    // Extract model names from each line
    const models = modelLines.map(line => {
      // The model name is the first column before any whitespace
      const modelName = line.trim().split(/\s+/)[0];
      return modelName;
    }).filter(Boolean); // Remove any empty entries
    
    return NextResponse.json({ models });
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch Ollama models',
      details: error.message,
      fallbackModels: ['gemma3:1b', 'gemma:7b', 'llama3:8b', 'llama3:70b', 'mistral:7b']
    }, { status: 500 });
  }
} 