'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Plus, Loader2, Database, Bot, Trash2, Settings } from 'lucide-react';
import ConfigPanel from './ConfigPanel';

export default function ChatUI() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [kbEntries, setKbEntries] = useState([]);
  const [newUrl, setNewUrl] = useState('');
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const messagesEndRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [modelConfig, setModelConfig] = useState({
    model: 'gemma3:1b',
    temperature: 0.1,
    topP: 0.9,
    maxTokens: 1000,
    systemPrompt: ''
  });
  const [responseStartTime, setResponseStartTime] = useState(null);

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

  // Add a useEffect to handle window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Check on initial load
    checkMobile();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkMobile);
    
    // Clean up
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load config from localStorage on initial render
  useEffect(() => {
    const savedConfig = localStorage.getItem('aiHelpdeskConfig');
    if (savedConfig) {
      try {
        setModelConfig(JSON.parse(savedConfig));
      } catch (error) {
        console.error('Error parsing saved config:', error);
      }
    }
  }, []);

  // Handle sending a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!input.trim()) return;
    
    // Create a user message with the original input (preserving case)
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    // Record start time for response timing
    const startTime = Date.now();
    setResponseStartTime(startTime);
    
    try {
      // Create a new AbortController
      const controller = new AbortController();
      const signal = controller.signal;
      
      // Add a temporary assistant message that will be updated as we receive chunks
      setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);
      
      // Make the streaming request with model configuration
      const response = await fetch('/api/kb-chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage.content, 
          history: messages.map(m => ({ role: m.role, content: m.content })),
          config: modelConfig // Include the model configuration
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
              // Store the metadata and update the message with it
              metadata = {
                source: data.source,
                references: data.references,
                debug: data.debug || {}
              };
              
              // Update the assistant message with the metadata
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.role === 'assistant') {
                  lastMessage.source = metadata.source;
                  lastMessage.references = metadata.references;
                  lastMessage.debug = metadata.debug;
                }
                return newMessages;
              });
            } else if (data.type === 'content') {
              accumulatedContent += data.content;
              
              // Update the assistant message with the accumulated content
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.role === 'assistant') {
                  lastMessage.content = accumulatedContent;
                  // Preserve metadata if it exists
                  if (metadata) {
                    lastMessage.source = metadata.source;
                    lastMessage.references = metadata.references;
                    lastMessage.debug = metadata.debug;
                  }
                }
                return newMessages;
              });
            } else if (data.type === 'done') {
              // Calculate response time
              const responseTime = Date.now() - startTime;
              
              // Remove the streaming flag when done and add metadata
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.role === 'assistant') {
                  lastMessage.isStreaming = false;
                  lastMessage.responseTime = responseTime;
                  // Make sure debug exists
                  if (!lastMessage.debug) {
                    lastMessage.debug = {};
                  }
                  // Add response time to debug
                  lastMessage.debug.responseTime = responseTime;
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
      setResponseStartTime(null);
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
  const handleClearChat = () => {
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

  // Add a function to format the current date
  const formatDate = () => {
    const date = new Date();
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'long' }).toUpperCase();
    const year = date.getFullYear();
    return `${day}, ${month}, ${year}`;
  };

  // Handle saving config
  const handleSaveConfig = (config) => {
    setModelConfig(config);
    console.log('Model configuration updated:', config);
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      backgroundColor: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif'
    }}>
      {/* Header with title and badge */}
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        padding: '0 20px'
      }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold',
          color: '#4263eb',
          margin: 0
        }}>
          AI Helpdesk
        </h1>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ 
            fontSize: '14px',
            color: '#4a5568',
            padding: '4px 10px',
            backgroundColor: '#e2e8f0',
            borderRadius: '16px',
            fontWeight: '500',
            marginRight: '10px'
          }}>
            Knowledge Base Assistant
          </span>
          <button
            onClick={() => setShowConfigPanel(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#f0f4f8',
              border: 'none',
              cursor: 'pointer'
            }}
            title="AI Model Settings"
          >
            <Settings size={18} style={{ color: '#4a5568' }} />
          </button>
        </div>
      </div>

      {/* Buttons row */}
      <div style={{ 
        display: 'flex', 
        marginBottom: '20px',
        padding: '0 20px'
      }}>
        <button 
          onClick={handleClearChat}
          style={{ 
            display: 'flex',
            alignItems: 'center',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '8px',
            backgroundColor: '#f0f4f8',
            color: '#4a5568',
            marginRight: '12px',
            cursor: 'pointer',
            fontWeight: '500',
            boxShadow: 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <Trash2 size={16} style={{ marginRight: '8px', color: '#4a5568' }} />
          Clear Chat
        </button>
        
        <button 
          onClick={() => setShowKnowledgeBase(!showKnowledgeBase)}
          style={{ 
            display: 'flex',
            alignItems: 'center',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '8px',
            backgroundColor: showKnowledgeBase ? '#e7f5ff' : '#f0f4f8',
            color: '#4a5568',
            cursor: 'pointer',
            fontWeight: '500',
            boxShadow: 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <Database size={16} style={{ marginRight: '8px', color: '#4263eb' }} />
          Knowledge Base ({kbEntries.length})
        </button>
      </div>
      
      {showKnowledgeBase && (
        <div style={{ 
          margin: '0 20px 20px',
          border: 'none',
          borderRadius: '12px',
          padding: '16px',
          backgroundColor: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <form onSubmit={handleAddUrl} style={{ marginBottom: '16px', display: 'flex' }}>
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Add URL to knowledge base..."
              style={{ 
                flex: 1,
                padding: '10px 16px',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                marginRight: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
              disabled={isAddingUrl}
            />
            <button
              type="submit"
              disabled={isAddingUrl || !newUrl.trim()}
              style={{ 
                padding: '10px 16px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: '#4263eb',
                color: '#fff',
                cursor: isAddingUrl || !newUrl.trim() ? 'not-allowed' : 'pointer',
                opacity: isAddingUrl || !newUrl.trim() ? 0.6 : 1,
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              {isAddingUrl ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={16} />}
            </button>
          </form>
          
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {kbEntries.length === 0 ? (
              <p style={{ 
                color: '#6c757d', 
                fontStyle: 'italic', 
                fontSize: '14px',
                textAlign: 'center',
                padding: '20px 0'
              }}>
                No entries yet. Add URLs to build your knowledge base.
              </p>
            ) : (
              kbEntries.map((entry) => (
                <div key={entry.filename} style={{ 
                  padding: '12px',
                  marginBottom: '8px',
                  border: '1px solid #e9ecef',
                  borderRadius: '8px',
                  backgroundColor: '#f8f9fa',
                  fontSize: '14px',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <h4 style={{ 
                        margin: '0 0 6px 0',
                        fontWeight: '600',
                        color: '#212529',
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
                          color: '#4263eb',
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
                        color: '#adb5bd',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease'
                      }}
                      title="Delete entry"
                    >
                      <Trash2 size={16} />
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
        border: 'none',
        borderRadius: '12px',
        overflow: 'hidden',
        backgroundColor: '#fff',
        margin: '0 auto',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        width: '800px',
        maxWidth: '100%'
      }} className="chat-container">
        {/* Messages */}
        <div style={{ 
          flex: 1,
          padding: '24px',
          overflowY: 'auto',
          backgroundColor: '#f0f4f8'
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
              <div style={{
                backgroundColor: '#e7f5ff',
                borderRadius: '50%',
                width: '80px',
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px'
              }}>
                <Bot size={40} style={{ color: '#4263eb' }} />
              </div>
              <h2 style={{ 
                fontSize: '24px',
                fontWeight: '700',
                color: '#212529',
                marginBottom: '16px'
              }}>Welcome to AI Helpdesk</h2>
              <p style={{ 
                color: '#495057', 
                maxWidth: '500px', 
                marginBottom: '16px', 
                lineHeight: '1.5',
                textAlign: 'center'
              }}>
                Ask me anything about topics in our knowledge base. I'll only answer questions based on information that's available in the knowledge base.
              </p>
              <p style={{ 
                color: '#6c757d', 
                maxWidth: '500px', 
                lineHeight: '1.5',
                textAlign: 'center'
              }}>
                If I don't have the information you're looking for, I'll let you know. To expand my knowledge, add URLs to the knowledge base using the button above.
              </p>
            </div>
          ) : (
            <>
              {/* Date header */}
              <div style={{
                textAlign: 'center',
                margin: '0 0 20px 0',
                color: '#4a5568',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                {formatDate()}
              </div>
              
              {messages.map((message, index) => (
                <div 
                  key={index}
                  style={{ 
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  {message.role !== 'user' && (
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#4263eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '12px',
                      flexShrink: 0
                    }}>
                      <Bot size={20} style={{ color: '#fff' }} />
                    </div>
                  )}
                  
                  <div style={{ 
                    maxWidth: '70%',
                    padding: '14px 18px',
                    borderRadius: message.role === 'user' ? '18px 18px 0 18px' : '0 18px 18px 18px',
                    backgroundColor: message.role === 'user' ? '#4263eb' : 
                                    message.role === 'system' ? '#f1f3f5' : '#fff',
                    color: message.role === 'user' ? '#fff' : '#212529',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ 
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.5',
                      fontSize: '15px'
                    }} dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}></div>
                    
                    {message.isStreaming && (
                      <span style={{ 
                        display: 'inline-block', 
                        marginLeft: '5px',
                        animation: 'blink 1s infinite'
                      }}>▋</span>
                    )}
                    
                    {message.role === 'assistant' && message.references && message.references.length > 0 && (
                      <div style={{ 
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid #e9ecef',
                        fontSize: '13px',
                        color: '#6c757d'
                      }}>
                        <p style={{ fontWeight: '600', marginBottom: '6px' }}>Sources:</p>
                        <ul style={{ 
                          listStyleType: 'none',
                          padding: '0',
                          margin: '0'
                        }}>
                          {message.references.map((ref, i) => (
                            <li key={i} style={{ marginTop: '4px', display: 'flex', alignItems: 'center' }}>
                              <span style={{ 
                                display: 'inline-block', 
                                width: '6px', 
                                height: '6px', 
                                borderRadius: '50%', 
                                backgroundColor: '#4263eb',
                                marginRight: '8px'
                              }}></span>
                              <a 
                                href={ref.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ 
                                  color: '#4263eb', 
                                  textDecoration: 'none',
                                  fontWeight: '500',
                                  borderBottom: '1px solid #4263eb'
                                }}
                              >
                                {ref.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Response metadata section */}
                    {message.role === 'assistant' && !message.isStreaming && (
                      <div style={{ 
                        marginTop: '12px',
                        paddingTop: '8px',
                        borderTop: '1px dashed #e9ecef',
                        fontSize: '11px',
                        color: '#adb5bd',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <span style={{ fontWeight: '500', marginRight: '4px' }}>Model:</span> 
                          {message.debug?.model || 'unknown'}
                        </span>
                        
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <span style={{ fontWeight: '500', marginRight: '4px' }}>Time:</span> 
                          {message.responseTime ? (message.responseTime / 1000).toFixed(2) + 's' : '0.00s'}
                        </span>
                        
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <span style={{ fontWeight: '500', marginRight: '4px' }}>Tokens:</span> 
                          {message.debug?.tokenCount || 0}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {message.role === 'user' && (
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: '12px',
                      flexShrink: 0
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="#4a5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="#4a5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input */}
        <div style={{ 
          borderTop: '1px solid #e9ecef',
          padding: '16px',
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
                padding: '12px 16px',
                border: '1px solid #dee2e6',
                borderRadius: '24px',
                marginRight: '12px',
                fontSize: '15px',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{ 
                padding: '12px',
                width: '48px',
                height: '48px',
                backgroundColor: '#6b8afc',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: isLoading || !input.trim() ? 0.6 : 1,
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              {isLoading ? 
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : 
                <Send size={20} />
              }
            </button>
          </form>
        </div>
      </div>
      
      {/* Config Panel */}
      <ConfigPanel 
        isOpen={showConfigPanel} 
        onClose={() => setShowConfigPanel(false)} 
        onSave={handleSaveConfig}
      />
    </div>
  );
} 