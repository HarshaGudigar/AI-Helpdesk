# AI Helpdesk with Knowledge Base

A modern AI-powered helpdesk application that answers customer queries based on a knowledge base. The application crawls websites to build its knowledge base and uses local Ollama models to generate accurate, knowledge-based responses.

## Features

- **Modern Chat Interface**: Clean, professional UI with streaming responses and animations
- **Knowledge Base Management**: Add URLs, view entries, delete entries
- **Web Crawler**: Fetch and process website content for the knowledge base
- **AI Model Configuration**: Configure model type, temperature, top P, max tokens, and system prompt
- **Multiple Model Support**: Works with any Ollama model (Gemma, Llama, Mistral, etc.)
- **Source Citations**: Automatically cites knowledge base sources used in responses
- **Response Metadata**: Shows model used, response time, and token count
- **Smart Source Filtering**: Only shows sources actually used in the response
- **Improved Formatting**: Support for lists, code blocks, links, and text formatting
- **Customizable System Prompt**: Define how the AI should respond to queries

## Prerequisites

- Node.js 18+ and npm
- Ollama installed with at least one model (gemma3:1b recommended)

## Setup

1. Install Ollama if you haven't already:
   - Visit [ollama.ai](https://ollama.ai) for installation instructions

2. Pull an Ollama model:
   ```bash
   ollama pull gemma3:1b
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Adding to the Knowledge Base

1. Click on "Knowledge Base" button in the top toolbar
2. Enter a URL in the input field and click the "+" button
3. The application will crawl the website and add its content to the knowledge base

### Chatting with the AI

1. Type your question in the input field at the bottom of the chat area
2. Press Enter or click the send button
3. The AI will respond based on the knowledge base if relevant information is found
4. If no relevant information is found, the AI will respond with a message indicating it doesn't have that information

### Managing the Knowledge Base

1. Click on "Knowledge Base" button to view all entries
2. Click the trash icon next to an entry to delete it

### Configuring the AI Model

1. Click the settings icon in the top-right corner
2. Select your preferred model from the dropdown
3. Adjust temperature, top P, and max tokens using the sliders
4. Customize the system prompt if needed
5. Click "Save Configuration" to apply changes

### Clearing the Chat

1. Click the "Clear Chat" button to start a new conversation

## AI Model Configuration

The application allows you to configure several aspects of the AI model:

- **Model**: Choose from any model installed in your local Ollama instance
- **Temperature**: Controls randomness (0.1 = focused, 1.0 = creative)
- **Top P**: Controls diversity of responses
- **Max Tokens**: Maximum length of generated responses
- **System Prompt**: Instructions that guide how the AI responds

## Technical Details

- Built with Next.js and React
- Uses the Ollama API for local AI model inference
- Implements a streaming response mechanism for real-time answers
- Stores knowledge base entries as HTML files for efficient retrieval
- Uses semantic search to find relevant information in the knowledge base

## Future Enhancements

- Voice interface for spoken queries and responses
- Improved search algorithms for better knowledge retrieval
- User authentication and personalized responses
- Multi-language support
- Integration with customer support ticketing systems
- Knowledge base analytics and insights

## License

MIT
