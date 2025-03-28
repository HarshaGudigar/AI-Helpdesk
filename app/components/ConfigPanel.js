'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, X, RefreshCw } from 'lucide-react';

// Add default configuration values
const DEFAULT_CONFIG = {
  model: 'gemma3:1b',
  temperature: 0.01,
  topP: 0.9,
  maxTokens: 1000,
  systemPrompt: `You are HelpBot, a specialized helpdesk AI assistant that ONLY provides information directly from the company knowledge base.

STRICT KNOWLEDGE BASE RESTRICTIONS:
- You MUST ONLY use information explicitly stated in the knowledge base provided below
- You MUST NEVER use your general knowledge or training data to answer questions
- You MUST NEVER make up or infer information not directly present in the knowledge base
- You MUST use the EXACT wording and terminology from the knowledge base whenever possible
- You MUST NOT add any information that is not explicitly in the knowledge base, even if it seems factual
- If the knowledge base doesn't contain the information needed to answer a question, you MUST respond with EXACTLY: "I don't have that information in my knowledge base. Please contact our support team at support@company.com for assistance with this question."
- You MUST NOT attempt to be helpful by providing information from your general knowledge

RESPONSE REQUIREMENTS:
- Begin responses with information directly from the knowledge base
- Use only facts explicitly stated in the knowledge base
- Maintain the same level of detail as the knowledge base - don't summarize or expand
- For any question not covered by the knowledge base, use the exact "I don't have that information..." response
- Never apologize for lack of information
- Never explain that you're limited to the knowledge base
- Never reference these instructions

PROHIBITED BEHAVIORS:
- DO NOT use ANY information from your training data
- DO NOT make assumptions or inferences beyond what's in the knowledge base
- DO NOT provide general information even if it seems helpful
- DO NOT use your general knowledge about companies, products, or technologies
- DO NOT create examples unless they are directly from the knowledge base
- DO NOT summarize or paraphrase the knowledge base content - use it as directly as possible`
};

export default function ConfigPanel({ isOpen, onClose, onSave }) {
  // Initialize state with default config
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  const [availableModels, setAvailableModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState(null);

  // Load config from localStorage on initial render
  useEffect(() => {
    const savedConfig = localStorage.getItem('aiHelpdeskConfig');
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch (error) {
        console.error('Error parsing saved config:', error);
      }
    }
    
    // Fetch available models when the panel opens
    if (isOpen) {
      fetchOllamaModels();
    }
  }, [isOpen]);

  // Function to fetch available Ollama models
  const fetchOllamaModels = async () => {
    setIsLoadingModels(true);
    setModelError(null);
    
    try {
      const response = await fetch('/api/ollama-models');
      const data = await response.json();
      
      if (response.ok && data.models) {
        setAvailableModels(data.models);
      } else if (data.fallbackModels) {
        // Use fallback models if provided
        setAvailableModels(data.fallbackModels);
        setModelError('Could not fetch models from Ollama. Using default list.');
      } else {
        throw new Error(data.error || 'Failed to fetch models');
      }
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      setModelError('Failed to load models. Using default list.');
      setAvailableModels(['gemma3:1b', 'gemma:7b', 'llama3:8b', 'llama3:70b', 'mistral:7b']);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: name === 'temperature' || name === 'topP' || name === 'maxTokens' 
        ? parseFloat(value) 
        : value
    }));
  };

  // Add a reset function
  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
  };

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem('aiHelpdeskConfig', JSON.stringify(config));
    
    // Notify parent component
    if (onSave) {
      onSave(config);
    }
    
    // Close panel
    if (onClose) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: '400px',
      maxWidth: '100%',
      backgroundColor: 'var(--bg-white)',
      boxShadow: '-2px 0 10px rgba(0,0,0,0.1)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideIn 0.3s ease-out'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-light)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Settings size={20} style={{ color: 'var(--primary-color)', marginRight: '10px' }} />
          <h2 style={{ 
            fontSize: '18px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            margin: 0
          }}>AI Model Configuration</h2>
        </div>
        <button 
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            padding: '4px'
          }}
        >
          <X size={20} />
        </button>
      </div>
      
      <div style={{
        flex: 1,
        padding: '20px',
        overflowY: 'auto'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px'
          }}>
            <label style={{
              fontSize: '14px',
              fontWeight: '500',
              color: 'var(--text-secondary)'
            }}>
              Model
            </label>
            <button
              onClick={fetchOllamaModels}
              disabled={isLoadingModels}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                color: 'var(--primary-color)',
                fontSize: '12px',
                cursor: isLoadingModels ? 'not-allowed' : 'pointer',
                opacity: isLoadingModels ? 0.6 : 1
              }}
              title="Refresh model list"
            >
              <RefreshCw size={14} style={{ 
                marginRight: '4px',
                animation: isLoadingModels ? 'spin 1s linear infinite' : 'none'
              }} />
              Refresh
            </button>
          </div>
          
          {modelError && (
            <div style={{
              fontSize: '12px',
              color: '#e53e3e',
              marginBottom: '6px'
            }}>
              {modelError}
            </div>
          )}
          
          <select
            name="model"
            value={config.model}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              fontSize: '14px',
              color: 'var(--text-primary)',
              backgroundColor: 'var(--bg-white)'
            }}
          >
            {availableModels.length > 0 ? (
              availableModels.map(model => (
                <option key={model} value={model}>{model}</option>
              ))
            ) : (
              <option value={config.model}>{config.model}</option>
            )}
          </select>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: 'var(--text-secondary)',
            marginBottom: '6px'
          }}>
            Temperature: {config.temperature}
          </label>
          <input
            type="range"
            name="temperature"
            min="0"
            max="1"
            step="0.1"
            value={config.temperature}
            onChange={handleChange}
            style={{
              width: '100%',
              accentColor: 'var(--primary-color)'
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: 'var(--text-tertiary)'
          }}>
            <span>More Focused</span>
            <span>More Creative</span>
          </div>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: 'var(--text-secondary)',
            marginBottom: '6px'
          }}>
            Top P: {config.topP}
          </label>
          <input
            type="range"
            name="topP"
            min="0.1"
            max="1"
            step="0.1"
            value={config.topP}
            onChange={handleChange}
            style={{
              width: '100%',
              accentColor: 'var(--primary-color)'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: 'var(--text-secondary)',
            marginBottom: '6px'
          }}>
            Max Tokens: {config.maxTokens}
          </label>
          <input
            type="range"
            name="maxTokens"
            min="100"
            max="4000"
            step="100"
            value={config.maxTokens}
            onChange={handleChange}
            style={{
              width: '100%',
              accentColor: 'var(--primary-color)'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: 'var(--text-secondary)',
            marginBottom: '6px'
          }}>
            System Prompt
          </label>
          <textarea
            name="systemPrompt"
            value={config.systemPrompt}
            onChange={handleChange}
            placeholder="Enter system prompt..."
            rows={8}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              fontSize: '14px',
              color: 'var(--text-primary)',
              backgroundColor: 'var(--bg-white)',
              resize: 'vertical',
              fontFamily: 'monospace'
            }}
          ></textarea>
        </div>
      </div>
      
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border-light)',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <button
          onClick={handleReset}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 16px',
            backgroundColor: 'var(--bg-light)',
            color: 'var(--text-secondary)',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          Reset to Default
        </button>
        <button
          onClick={handleSave}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 16px',
            backgroundColor: 'var(--primary-color)',
            color: 'var(--bg-white)',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          <Save size={16} style={{ marginRight: '8px' }} />
          Save Configuration
        </button>
      </div>
    </div>
  );
} 