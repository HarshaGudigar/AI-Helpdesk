# AI Helpdesk with Knowledge Base

A modern AI-powered helpdesk application that can answer customer queries based on a knowledge base. The application crawls websites to build its knowledge base and uses the Ollama gemma3:1b model to generate responses.

## Features

- Modern, professional chat UI with streaming responses and animations
- Knowledge base management (add URLs, view entries, delete entries)
- Web crawler to fetch and process website content
- Integration with Ollama for AI responses
- Fallback to general AI responses when knowledge base doesn't have relevant information
- Citation of sources when answering from the knowledge base

## Prerequisites

- Node.js 18+ and npm
- Ollama installed with the gemma3:1b model

## Setup

1. Install Ollama if you haven't already:
   - Visit [ollama.ai](https://ollama.ai) for installation instructions

2. Pull the gemma3:1b model:
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

1. Click on "Knowledge Base" in the sidebar
2. Enter a URL in the input field and click the "+" button
3. The application will crawl the website and add its content to the knowledge base

### Chatting with the AI

1. Type your question in the input field at the bottom of the chat area
2. Press Enter or click the send button
3. The AI will respond based on the knowledge base if relevant information is found
4. If no relevant information is found, the AI will respond with a general answer or indicate that it doesn't have that information

### Managing the Knowledge Base

1. Click on "Knowledge Base" in the sidebar to view all entries
2. Click the trash icon next to an entry to delete it

## Future Enhancements

- Voice interface for spoken queries and responses
- Improved search algorithms for better knowledge retrieval
- User authentication and personalized responses
- Multi-language support
- Integration with customer support ticketing systems

## License

MIT
