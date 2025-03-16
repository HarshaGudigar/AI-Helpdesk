'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Plus, Loader2, Database, Bot, Trash2 } from 'lucide-react';

export default function ChatUI() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [kbEntries, setKbEntries] = useState([]);
  const [newUrl, setNewUrl] = useState('');
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const messagesEndRef = useRef(null);

  // Fetch knowledge base entries
  const fetchKnowledgeBase = async () => {
    try {
      const response = await fetch('/api/list-kb');
      const data = await response.json();
      setKbEntries(data.entries || []);
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
    }
  };

  // Load knowledge base on initial render
  useEffect(() => {
    fetchKnowledgeBase();
  }, []);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!input.trim()) return;
    
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Create a new AbortController
      const controller = new AbortController();
      const signal = controller.signal;
      
      // Add a temporary assistant message that will be updated as we receive chunks
      setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);
      
      // Make the streaming request
      const response = await fetch('/api/kb-chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage.content, 
          history: messages.map(m => ({ role: m.role, content: m.content }))
        }),
        signal
      });
      
      if (!response.ok) throw new Error('Failed to get response');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let metadata = null;
      let accumulatedContent = '';
      
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.type === 'metadata') {
              metadata = {
                source: data.source,
                references: data.references
              };
            } else if (data.type === 'content') {
              accumulatedContent += data.content;
              
              // Update the assistant message with the accumulated content
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.role === 'assistant') {
                  lastMessage.content = accumulatedContent;
                  lastMessage.source = metadata?.source;
                  lastMessage.references = metadata?.references;
                }
                return newMessages;
              });
            } else if (data.type === 'done') {
              // Remove the streaming flag when done
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.role === 'assistant') {
                  lastMessage.isStreaming = false;
                }
                return newMessages;
              });
            }
          } catch (error) {
            console.error('Error parsing chunk:', error, line);
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove the temporary message if there was an error
      setMessages(prev => prev.filter(m => !m.isStreaming));
      // Add an error message
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, there was an error processing your request. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle adding a URL to the knowledge base
  const handleAddUrl = async (e) => {
    e.preventDefault();
    
    if (!newUrl.trim()) return;
    
    setIsAddingUrl(true);
    
    try {
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl })
      });
      
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to add URL');
      
      // Add a system message
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: `Added "${data.document.title}" to the knowledge base.`
      }]);
      
      // Refresh knowledge base
      fetchKnowledgeBase();
      
      // Clear input
      setNewUrl('');
    } catch (error) {
      console.error('Error adding URL:', error);
      // Add an error message
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: `Error adding URL: ${error.message}`
      }]);
    } finally {
      setIsAddingUrl(false);
    }
  };

  // Handle deleting a knowledge base entry
  const handleDeleteEntry = async (filename) => {
    try {
      const response = await fetch('/api/delete-kb-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to delete entry');
      
      // Refresh knowledge base
      fetchKnowledgeBase();
      
      // Add a system message
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: 'Knowledge base entry deleted.'
      }]);
    } catch (error) {
      console.error('Error deleting entry:', error);
      // Add an error message
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: `Error deleting entry: ${error.message}`
      }]);
    }
  };

  // Start a new chat
  const handleNewChat = () => {
    setMessages([]);
  };

  // Update the formatMessage function
  const formatMessage = (text) => {
    if (!text) return '';
    
    // Replace asterisks with proper formatting
    // Bold: **text** -> <strong>text</strong>
    // Italic: *text* -> <em>text</em>
    // But avoid replacing asterisks in code blocks
    
    // First, split by code blocks to avoid formatting inside them
    const parts = [];
    let inCodeBlock = false;
    let currentPart = '';
    let codeLanguage = '';
    
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.trim().startsWith('```')) {
        // Code block delimiter
        if (!inCodeBlock) {
          // Start of code block
          inCodeBlock = true;
          // Extract language if specified
          codeLanguage = line.trim().substring(3).trim();
          if (currentPart.trim()) {
            parts.push({ type: 'text', content: currentPart });
            currentPart = '';
          }
          currentPart = line + '\n';
        } else {
          // End of code block
          inCodeBlock = false;
          currentPart += line + '\n';
          parts.push({ type: 'code', content: currentPart, language: codeLanguage });
          currentPart = '';
          codeLanguage = '';
        }
      } else {
        currentPart += line + '\n';
        
        if (i === lines.length - 1 && !inCodeBlock) {
          // End of text block
          if (currentPart.trim()) {
            parts.push({ type: 'text', content: currentPart });
          }
        }
      }
    }
    
    // If there's any remaining content
    if (currentPart.trim() && !parts.some(p => p.content.includes(currentPart))) {
      parts.push({ type: inCodeBlock ? 'code' : 'text', content: currentPart, language: codeLanguage });
    }
    
    // Format each part
    const formattedParts = parts.map(part => {
      if (part.type === 'code') {
        // Format code block
        const codeContent = part.content
          .replace(/^```.*\n/, '') // Remove opening ```
          .replace(/```$/, '')     // Remove closing ```
          .trim();
        
        return `<pre style="background-color: #f7f7f7; padding: 10px; border-radius: 4px; overflow-x: auto; margin: 10px 0;"><code>${codeContent}</code></pre>`;
      } else {
        // Format text part
        let formatted = part.content;
        
        // Bold: **text** -> <strong>text</strong>
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic: *text* -> <em>text</em> (but not if it's part of a bold pattern)
        formatted = formatted.replace(/\*([^*]*?)\*/g, '<em>$1</em>');
        
        // Format URLs: [text](url) or raw URLs like https://example.com
        formatted = formatted.replace(/\[(https?:\/\/[^\s\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, 
          '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #0066cc; text-decoration: none; font-weight: medium; border-bottom: 1px solid #0066cc;">$1</a>');
        
        // Format raw URLs
        formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, 
          '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #0066cc; text-decoration: none; font-weight: medium; border-bottom: 1px solid #0066cc;">$1</a>');
        
        // Lists: lines starting with "* " or "- "
        const lines = formatted.split('\n');
        let inList = false;
        let formattedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmedLine = line.trim();
          
          if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
            // List item
            const itemContent = trimmedLine.substring(2);
            
            if (!inList) {
              // Start a new list
              inList = true;
              formattedLines.push('<ul style="padding-left: 20px; margin: 10px 0;">');
            }
            
            formattedLines.push(`<li>${itemContent}</li>`);
          } else {
            if (inList && trimmedLine !== '') {
              // End the list
              inList = false;
              formattedLines.push('</ul>');
            }
            
            formattedLines.push(line);
          }
        }
        
        if (inList) {
          // Close the list if it's still open
          formattedLines.push('</ul>');
        }
        
        return formattedLines.join('\n');
      }
    });
    
    return formattedParts.join('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', marginBottom: '20px' }}>
        <button 
          onClick={handleNewChat}
          style={{ 
            display: 'flex',
            alignItems: 'center',
            padding: '5px 10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: '#f5f5f5',
            marginRight: '10px',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} style={{ marginRight: '5px' }} />
          New Chat
        </button>
        
        <button 
          onClick={() => setShowKnowledgeBase(!showKnowledgeBase)}
          style={{ 
            display: 'flex',
            alignItems: 'center',
            padding: '5px 10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: '#f5f5f5',
            cursor: 'pointer'
          }}
        >
          <Database size={16} style={{ marginRight: '5px' }} />
          Knowledge Base ({kbEntries.length})
        </button>
      </div>
      
      {showKnowledgeBase && (
        <div style={{ 
          marginBottom: '20px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '10px',
          backgroundColor: '#f5f5f5'
        }}>
          <form onSubmit={handleAddUrl} style={{ marginBottom: '10px', display: 'flex' }}>
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Add URL..."
              style={{ 
                flex: 1,
                padding: '5px 10px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                marginRight: '5px'
              }}
              disabled={isAddingUrl}
            />
            <button
              type="submit"
              disabled={isAddingUrl || !newUrl.trim()}
              style={{ 
                padding: '5px 10px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: '#f5f5f5',
                cursor: isAddingUrl || !newUrl.trim() ? 'not-allowed' : 'pointer',
                opacity: isAddingUrl || !newUrl.trim() ? 0.5 : 1
              }}
            >
              {isAddingUrl ? <Loader2 size={16} /> : <Plus size={16} />}
            </button>
          </form>
          
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {kbEntries.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic', fontSize: '14px' }}>No entries yet</p>
            ) : (
              kbEntries.map((entry) => (
                <div key={entry.filename} style={{ 
                  padding: '8px',
                  marginBottom: '5px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: '#fff',
                  fontSize: '14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ overflow: 'hidden' }}>
                      <h4 style={{ 
                        margin: '0 0 5px 0',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }} title={entry.title}>
                        {entry.title}
                      </h4>
                      <a 
                        href={entry.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          fontSize: '12px',
                          color: 'blue',
                          textDecoration: 'none',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block'
                        }}
                        title={entry.url}
                      >
                        {entry.url}
                      </a>
                    </div>
                    <button
                      onClick={() => handleDeleteEntry(entry.filename)}
                      style={{ 
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#999'
                      }}
                      title="Delete entry"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      <div style={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #ccc',
        borderRadius: '4px',
        overflow: 'hidden',
        backgroundColor: '#f5f5f5'
      }}>
        {/* Messages */}
        <div style={{ 
          flex: 1,
          padding: '20px',
          overflowY: 'auto'
        }}>
          {messages.length === 0 ? (
            <div style={{ 
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '20px'
            }}>
              <Bot size={48} style={{ color: '#ccc', marginBottom: '20px' }} />
              <h2 style={{ 
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#333',
                marginBottom: '10px'
              }}>Welcome to AI Helpdesk</h2>
              <p style={{ color: '#666', maxWidth: '500px', marginBottom: '15px' }}>
                Ask me anything about topics in our knowledge base. I'll only answer questions based on information that's available in the knowledge base.
              </p>
              <p style={{ color: '#666', maxWidth: '500px' }}>
                If I don't have the information you're looking for, I'll let you know. To expand my knowledge, add URLs to the knowledge base using the button above.
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div 
                key={index}
                style={{ 
                  marginBottom: '15px',
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{ 
                  maxWidth: '70%',
                  padding: '10px 15px',
                  borderRadius: '8px',
                  backgroundColor: message.role === 'user' ? '#1a73e8' : 
                                  message.role === 'system' ? '#f0f0f0' : '#fff',
                  color: message.role === 'user' ? '#fff' : '#333',
                  border: message.role === 'assistant' ? '1px solid #ddd' : 'none'
                }}>
                  <div style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}></div>
                  
                  {message.isStreaming && (
                    <span style={{ display: 'inline-block', marginLeft: '5px' }}>▋</span>
                  )}
                  
                  {message.role === 'assistant' && message.references && message.references.length > 0 && (
                    <div style={{ 
                      marginTop: '10px',
                      paddingTop: '10px',
                      borderTop: '1px solid #eee',
                      fontSize: '12px',
                      color: '#666'
                    }}>
                      <p style={{ fontWeight: 'bold' }}>Sources:</p>
                      <ul style={{ 
                        listStyleType: 'disc',
                        paddingLeft: '20px',
                        marginTop: '5px'
                      }}>
                        {message.references.map((ref, i) => (
                          <li key={i} style={{ marginTop: '3px' }}>
                            <a 
                              href={ref.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ 
                                color: '#0066cc', 
                                textDecoration: 'none',
                                fontWeight: 'medium',
                                borderBottom: '1px solid #0066cc'
                              }}
                            >
                              {ref.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input */}
        <div style={{ 
          borderTop: '1px solid #ccc',
          padding: '10px',
          backgroundColor: '#fff'
        }}>
          <form onSubmit={handleSendMessage} style={{ display: 'flex' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              style={{ 
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                marginRight: '10px'
              }}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{ 
                padding: '8px 15px',
                backgroundColor: '#1a73e8',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: isLoading || !input.trim() ? 0.5 : 1
              }}
            >
              {isLoading ? <Loader2 size={20} /> : <Send size={20} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 