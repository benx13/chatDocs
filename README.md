# AI Document Assistant

A modern React-based document assistant that uses DeepSeek R1 via OpenRouter to answer questions about uploaded PDF documents. Features real OCR processing using MinerU API for accurate document extraction.

## Features

- Upload and process PDF documents with real OCR
- **Quick Scan**: Uses MinerU API with OCR, table recognition, and French language support
- **Balanced/Deep Analysis**: Advanced processing modes (simulated)
- Interactive chat with AI about document content using DeepSeek R1
- **Streaming responses** with reasoning display (like Grok)
- Two chat modes: Quick responses and thoughtful analysis
- Modern, responsive UI inspired by Hugging Face

## OCR Processing

- **Low Effort (Quick Scan)**: Uses MinerU API for real OCR processing
  - Supports OCR with table recognition
  - French language processing
  - Returns extracted content in markdown format
- **Medium/High Effort**: Simulated processing (placeholder for advanced methods)

## Run Locally

**Prerequisites:** Node.js, Cloud server for file uploads

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   - Copy `env.example` to `.env.local`
   - Get your OpenRouter API key from [openrouter.ai](https://openrouter.ai/)
   - Get your MinerU API key from [mineru.net](https://mineru.net/)
   - Add your API keys to the `.env.local` file:
     ```
     VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here
     VITE_MINERU_API_KEY=your_mineru_api_key_here
     ```

3. Set up cloud server:
   - Ensure your cloud server at `http://78.47.100.16` has an upload endpoint
   - The server should accept file uploads and return publicly accessible URLs

4. Run the app:
   ```bash
   npm run dev
   ```

5. Open http://localhost:5174 in your browser

## API Integration

- **Chat**: DeepSeek R1 model via OpenRouter with streaming and reasoning
- **OCR**: MinerU API for document processing with table recognition
- **File Upload**: Cloud server for temporary file hosting
