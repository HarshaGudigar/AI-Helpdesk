import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const KB_DIR = path.join(process.cwd(), 'knowledge-base');

export async function POST(request) {
  try {
    const { filename } = await request.json();
    
    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }
    
    // Ensure knowledge base directory exists
    if (!fs.existsSync(KB_DIR)) {
      return NextResponse.json({ error: 'Knowledge base directory does not exist' }, { status: 404 });
    }
    
    const filePath = path.join(KB_DIR, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found in knowledge base' }, { status: 404 });
    }
    
    // Delete the file
    fs.unlinkSync(filePath);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Entry deleted from knowledge base'
    });
    
  } catch (error) {
    console.error('Error deleting knowledge base entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete knowledge base entry', details: error.message },
      { status: 500 }
    );
  }
} 