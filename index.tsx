import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import JSZip from 'jszip';

const App: React.FC = () => {
    type View = 'upload' | 'ocrConfig' | 'chat';
    type ChatModel = 'plain' | 'thinking';
    interface ChatMessage {
        id: string;
        sender: 'user' | 'ai';
        text: string;
        reasoning?: string;
        modelUsed?: ChatModel;
        isStreaming?: boolean;
        isReasoningComplete?: boolean;
        isReasoningCollapsed?: boolean;
    }

    const [currentView, setCurrentView] = useState<View>('upload');
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [ocrEffort, setOcrEffort] = useState<number>(50);
    const [isProcessingOcr, setIsProcessingOcr] = useState<boolean>(false);
    const [ocrResultText, setOcrResultText] = useState<string | null>(null);
    const [firstPagePreviewUrl, setFirstPagePreviewUrl] = useState<string | null>(null);
    const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [currentMessage, setCurrentMessage] = useState<string>('');
    const [selectedChatModel, setSelectedChatModel] = useState<ChatModel>('plain');
    const [isAiTyping, setIsAiTyping] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const chatAreaRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const reasoningContentRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    useEffect(() => {
        if (chatAreaRef.current) {
            chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
        }
    }, [chatMessages]);

    // Cleanup function to abort ongoing streams
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        const file = event.target.files?.[0];
        if (file) {
            if (file.type === "application/pdf") {
                setPdfFile(file);
                // Generate a temporary local URL for immediate preview in sidebar if needed,
                // but actual preview comes after OCR simulation.
                // For simplicity, we'll wait for OCR's simulated preview.
                setCurrentView('ocrConfig');
            } else {
                setError("Please upload a PDF file.");
                setPdfFile(null);
                 if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
            }
        }
    };

    const getOcrEffortLabel = (value: number): string => {
        if (value < 33) return "Quick Scan";
        if (value < 66) return "Balanced";
        return "Deep Analysis";
    };
    
    const getOcrEffortDescription = (value: number): string => {
        if (value < 33) return "Uses MinerU API with OCR and table recognition.";
        if (value < 66) return "Good balance of speed and accuracy.";
        return "Slowest, highest accuracy.";
    };

    const uploadFileToCloudServer = async (file: File): Promise<string> => {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('http://78.47.100.16/upload', {
            method: 'POST',
            body: formData,
        });
        
        if (!response.ok) {
            throw new Error(`File upload failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result.url; // Assuming the server returns { url: "http://78.47.100.16/path/to/file" }
    };

    const createMinerUTask = async (fileUrl: string): Promise<string> => {
        const apiKey = (window as any).VITE_MINERU_API_KEY;
        if (!apiKey) {
            throw new Error('MinerU API key not found in environment variables');
        }

        const response = await fetch('https://mineru.net/api/v4/extract/task', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                url: fileUrl,
                is_ocr: true,
                enable_table: true,
                language: 'fr',
            }),
        });

        if (!response.ok) {
            throw new Error(`MinerU API request failed: ${response.statusText}`);
        }

        const result = await response.json();
        if (result.code !== 0) {
            throw new Error(`MinerU API error: ${result.msg}`);
        }

        return result.data.task_id;
    };

    const pollMinerUTask = async (taskId: string): Promise<string> => {
        const apiKey = (window as any).VITE_MINERU_API_KEY;
        
        while (true) {
            const response = await fetch(`https://mineru.net/api/v4/extract/task/${taskId}`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': '*/*',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to check task status: ${response.statusText}`);
            }

            const result = await response.json();
            if (result.code !== 0) {
                throw new Error(`MinerU API error: ${result.msg}`);
            }

            const { state, full_zip_url, err_msg } = result.data;

            if (state === 'done') {
                return full_zip_url;
            } else if (state === 'failed') {
                throw new Error(`OCR processing failed: ${err_msg}`);
            }

            // Wait 3 seconds before polling again
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    };

    const downloadAndExtractOCR = async (zipUrl: string): Promise<string> => {
        const response = await fetch(zipUrl);
        if (!response.ok) {
            throw new Error(`Failed to download results: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        
        try {
            const zip = new JSZip();
            const zipData = await zip.loadAsync(arrayBuffer);
            
            // Look for full.md file in the zip
            const fullMdFile = zipData.file('full.md');
            if (fullMdFile) {
                const content = await fullMdFile.async('string');
                return content;
            }
            
            // If full.md is not in root, search in subdirectories
            const files = Object.keys(zipData.files);
            const fullMdPath = files.find(path => path.endsWith('full.md'));
            
            if (fullMdPath) {
                const file = zipData.file(fullMdPath);
                if (file) {
                    const content = await file.async('string');
                    return content;
                }
            }
            
            throw new Error('full.md file not found in the extracted zip');
        } catch (error: any) {
            console.error('Error extracting zip file:', error);
            throw new Error(`Failed to extract OCR results: ${error.message}`);
        }
    };

    const processMinerUOCR = async (file: File): Promise<{ ocrText: string, previewUrl?: string }> => {
        try {
            console.log('Uploading file to cloud server...');
            const fileUrl = await uploadFileToCloudServer(file);
            
            console.log('Creating MinerU extraction task...');
            const taskId = await createMinerUTask(fileUrl);
            
            console.log('Polling for task completion...');
            const zipUrl = await pollMinerUTask(taskId);
            
            console.log('Downloading and extracting OCR results...');
            const ocrText = await downloadAndExtractOCR(zipUrl);
            
            const previewUrl = `https://via.placeholder.com/400x560.png?text=MinerU+OCR+Result`;
            
            return { ocrText, previewUrl };
        } catch (error) {
            console.error('MinerU OCR processing failed:', error);
            throw error;
        }
    };

    const simulateOcrProcessing = async (file: File, effort: number): Promise<{ ocrText: string, previewUrl?: string }> => {
        console.log(`Processing OCR for ${file.name} with effort ${getOcrEffortLabel(effort)}`);
        
        // Use MinerU API for Quick Scan (low effort)
        if (effort < 33) {
            return await processMinerUOCR(file);
        }
        
        // Fall back to simulation for Balanced and Deep Analysis
        return new Promise(resolve => {
            setTimeout(() => {
                const simulatedText = `This is simulated OCR text from "${file.name}". Effort level: ${getOcrEffortLabel(effort)}. The document discusses various topics including AI, document processing, and modern web interfaces. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`;
                const simulatedPreviewUrl = `https://via.placeholder.com/400x560.png?text=Preview+of+${encodeURIComponent(file.name.substring(0,20))}`; 
                resolve({ ocrText: simulatedText, previewUrl: simulatedPreviewUrl });
            }, 1500 + effort * 25);
        });
    };

    const handleProcessDocument = async () => {
        if (!pdfFile) {
            setError("No PDF file selected.");
            return;
        }
        setError(null);
        setIsProcessingOcr(true);
        try {
            const result = await simulateOcrProcessing(pdfFile, ocrEffort);
            setOcrResultText(result.ocrText);

            if (result.previewUrl) {
                setFirstPagePreviewUrl(result.previewUrl);
                setShowPreviewModal(true);
            } else {
                setFirstPagePreviewUrl(null);
            }
            
            setChatMessages([{ 
                id: Date.now().toString(), 
                sender: 'ai', 
                text: `Successfully processed "${pdfFile.name}". You can now ask questions about it.`,
                modelUsed: 'plain'
            }]);
            setCurrentView('chat');
        } catch (e) {
            setError("Failed to process document. Please try again.");
            console.error(e);
        } finally {
            setIsProcessingOcr(false);
        }
    };

    const getChatResponseStreaming = async (
        message: string, 
        model: ChatModel, 
        context: string | null, 
        onChunk: (chunk: string, reasoning?: string) => void
    ): Promise<void> => {
        // Get API key from environment
        const apiKey = (window as any).VITE_OPENROUTER_API_KEY;
        
        if (!apiKey || apiKey === 'YOUR_OPENROUTER_API_KEY' || apiKey === 'test_key_for_debugging') {
            console.log('No API key configured, using simulated streaming response');
            // Fallback to simulated streaming response
            const response = `You asked about "${message.substring(0,30)}...". `;
            let fullResponse = response;
            if (model === 'thinking') {
                fullResponse += "After careful consideration and deep thought, I believe the answer involves complex interdependencies. The document mentions related concepts. For example... (simulated thoughtful response using thinking model)";
            } else {
                fullResponse += "Based on the document, this is a straightforward query. The relevant section indicates... (simulated plain response)";
            }
            if (context && message.toLowerCase().includes('pricing')) {
                fullResponse += " Regarding pricing, the document seems to outline several tiers.";
            }
            
            // Simulate streaming by splitting words and sending them with delays
            const simulatedReasoning = "Let me think about this question step by step... This involves analyzing the document content and providing a comprehensive response...";
            const reasoningWords = simulatedReasoning.split(' ');
            
            // First stream the reasoning
            for (let i = 0; i < reasoningWords.length; i++) {
                if (abortControllerRef.current?.signal.aborted) {
                    break;
                }
                const chunk = (i === 0 ? '' : ' ') + reasoningWords[i];
                onChunk('', chunk);
                await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50));
            }
            
            // Then stream the actual response
            const words = fullResponse.split(' ');
            for (let i = 0; i < words.length; i++) {
                if (abortControllerRef.current?.signal.aborted) {
                    break;
                }
                const chunk = (i === 0 ? '' : ' ') + words[i];
                onChunk(chunk);
                await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
            }
            return;
        }

        try {
            // Create an AbortController for this request
            abortControllerRef.current = new AbortController();
            
            // Prepare system message based on model type and context
            let systemMessage = '';
            if (model === 'thinking') {
                systemMessage = 'You are a thoughtful AI assistant that provides detailed, well-reasoned responses. Take time to analyze the question thoroughly and provide comprehensive answers with clear reasoning. Format your responses using markdown with proper headings, bullet points, numbered lists, and emphasis where appropriate for better readability.';
            } else {
                systemMessage = 'You are a helpful AI assistant that provides clear, concise, and direct answers to questions. Use markdown formatting including bullet points, numbered lists, **bold text**, and proper structure to make your responses easy to read.';
            }

            // Add document context if available
            if (context) {
                systemMessage += `\n\nDocument context: "${context}"\n\nPlease base your responses on the provided document context when relevant.`;
            } else {
                systemMessage += '\n\nNote: No document has been uploaded yet, so this is a general conversation.';
            }

            // Use fetch API with streaming enabled
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://ai-document-assistant.local',
                    'X-Title': 'AI Document Assistant',
                },
                body: JSON.stringify({
                    model: 'deepseek/deepseek-r1',
                    messages: [
                        {
                            role: 'system',
                            content: systemMessage,
                        },
                        {
                            role: 'user',
                            content: message,
                        },
                    ],
                    temperature: model === 'thinking' ? 0.7 : 0.5,
                    max_tokens: model === 'thinking' ? 2000 : 1000,
                    stream: true,
                    include_reasoning: true,
                }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('OpenRouter API error:', response.status, errorData);
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            if (!response.body) {
                throw new Error('No response body available for streaming');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            try {
                let buffer = '';
                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done || abortControllerRef.current?.signal.aborted) {
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

                    for (const line of lines) {
                        if (line.trim() === '') continue;
                        
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6).trim();
                            
                            if (data === '[DONE]') {
                                console.log('Stream completed with [DONE]');
                                return;
                            }

                            try {
                                const parsed = JSON.parse(data);
                                const delta = parsed.choices?.[0]?.delta;
                                const content = delta?.content;
                                const reasoning = delta?.reasoning;
                                
                                if (content || reasoning) {
                                    onChunk(content || '', reasoning);
                                }
                            } catch (parseError) {
                                console.warn('Failed to parse streaming chunk:', data, parseError);
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Streaming request was aborted');
                return;
            }
            console.error('Error calling OpenRouter API:', error);
            throw error; // Re-throw the original error to preserve error details
        }
    };

    const handleSendMessage = async () => {
        if (!currentMessage.trim() || isAiTyping) return;
        setError(null);

        // Abort any ongoing stream
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const newUserMessage: ChatMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text: currentMessage,
        };
        setChatMessages(prev => [...prev, newUserMessage]);
        const messageToSend = currentMessage;
        setCurrentMessage('');
        setIsAiTyping(true);

        // Create a new AI message that will be updated as streaming progresses
        const aiMessageId = (Date.now() + 1).toString();
        const initialAiMessage: ChatMessage = {
            id: aiMessageId,
            sender: 'ai',
            text: '',
            reasoning: '',
            modelUsed: selectedChatModel,
            isStreaming: true,
            isReasoningComplete: false,
            isReasoningCollapsed: false,
        };
        setChatMessages(prev => [...prev, initialAiMessage]);

        try {
            await getChatResponseStreaming(
                messageToSend, 
                selectedChatModel, 
                ocrResultText,
                (chunk: string, reasoningChunk?: string) => {
                    setChatMessages(prev => prev.map(msg => 
                        msg.id === aiMessageId 
                            ? { 
                                ...msg, 
                                text: chunk ? msg.text + chunk : msg.text,
                                reasoning: reasoningChunk ? (msg.reasoning || '') + reasoningChunk : msg.reasoning,
                                isReasoningComplete: !reasoningChunk && chunk ? true : msg.isReasoningComplete
                            }
                            : msg
                    ));
                }
            );

            console.log('Streaming completed successfully');
            // Mark streaming as complete
            setChatMessages(prev => prev.map(msg => 
                msg.id === aiMessageId 
                    ? { 
                        ...msg, 
                        isStreaming: false,
                        isReasoningComplete: true 
                    }
                    : msg
            ));
        } catch (e: any) {
            console.error('Streaming error:', e);
            setError(`Failed to get response from AI: ${e.message || 'Unknown error'}. Please try again.`);
            
            // Replace the streaming message with an error message
            setChatMessages(prev => prev.map(msg => 
                msg.id === aiMessageId 
                    ? { 
                        ...msg, 
                        text: msg.text || "Sorry, I encountered an error trying to respond.",
                        isStreaming: false,
                        isReasoningComplete: true
                    }
                    : msg
            ));
        } finally {
            setIsAiTyping(false);
        }
    };
    
    const toggleThinkMode = () => {
        setSelectedChatModel(prev => prev === 'plain' ? 'thinking' : 'plain');
    };

    const startNewDocument = () => {
        setCurrentView('upload');
        setPdfFile(null);
        setOcrEffort(50);
        setIsProcessingOcr(false);
        setOcrResultText(null);
        setFirstPagePreviewUrl(null);
        setShowPreviewModal(false); // Also reset modal visibility
        setChatMessages([]);
        setCurrentMessage('');
        setSelectedChatModel('plain');
        setIsAiTyping(false);
        setError(null);
        if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
    };

    return (
        <div className="app-shell">
            {/* Sidebar removed */}
            <main className="main-content">
                <div className="main-header-controls">
                    {/* Relocated New Document Button */}
                    <button onClick={startNewDocument} className="new-doc-btn global-new-doc-btn">
                        <i className="fas fa-plus"></i> New Document
                    </button>
                    {/* You can add a document title here if needed, e.g., when pdfFile is available */}
                    {pdfFile && (currentView === 'ocrConfig' || currentView === 'chat') && (
                        <span className="document-title-header">
                            {pdfFile.name}
                            {currentView === 'ocrConfig' && ` - ${getOcrEffortLabel(ocrEffort)}`}
                        </span>
                    )}
                </div>

                {error && <div className="error-message-bar" role="alert">{error}</div>}

                {currentView === 'upload' && (
                    <div className="file-upload-view" aria-labelledby="upload-title">
                        <h1 id="upload-title">Welcome to DocuChat AI</h1>
                        <p>Upload your PDF document to start an interactive chat session and extract insights.</p>
                        <label className="file-input-label" htmlFor="pdf-upload" role="button" tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                        >
                            <i className="fas fa-file-pdf"></i> Select PDF
                            <input type="file" id="pdf-upload" ref={fileInputRef} accept=".pdf" onChange={handleFileChange} />
                        </label>
                    </div>
                )}

                {currentView === 'ocrConfig' && pdfFile && (
                    <div className="ocr-config-view" aria-labelledby="ocr-title">
                        <h2 id="ocr-title">Configure Document Processing</h2>
                        {/* Replaced <p className="document-name"> with info in main-header-controls for file name */}
                        {/* <p className="document-name">File: <strong>{pdfFile.name}</strong></p> */}
                        <div className="slider-container">
                            <label htmlFor="ocr-effort-slider" className="ocr-effort-label">
                                OCR Effort: {getOcrEffortLabel(ocrEffort)}
                                <span style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight:'normal'}}>{getOcrEffortDescription(ocrEffort)}</span>
                            </label>
                            <input
                                type="range"
                                id="ocr-effort-slider"
                                min="0"
                                max="100"
                                step="1"
                                value={ocrEffort}
                                onChange={(e) => setOcrEffort(Number(e.target.value))}
                                aria-valuetext={getOcrEffortLabel(ocrEffort)}
                            />
                            <div className="slider-labels">
                                <span>Quick</span>
                                <span>Balanced</span>
                                <span>Accurate</span>
                            </div>
                        </div>
                        <button onClick={handleProcessDocument} className="process-doc-btn" disabled={isProcessingOcr}>
                            {isProcessingOcr ? (
                                <><span className="spinner"></span> Processing...</>
                            ) : (
                                <><i className="fas fa-cogs"></i> Process Document</>
                            )}
                        </button>
                        {isProcessingOcr && <p className="loading-text-ocr" aria-live="polite">Analyzing your document, please wait...</p>}
                    </div>
                )}

                {currentView === 'chat' && pdfFile && (
                    <div className="chat-view">
                        <div ref={chatAreaRef} className="chat-area">
                            {chatMessages.map((msg) => (
                                <div key={msg.id} className={`chat-message ${msg.sender}`}>
                                    <div className="avatar">
                                        <i className={`fas ${msg.sender === 'user' ? 'fa-user' : 'fa-robot'}`}></i>
                                    </div>
                                    <div className="message-content">
                                        {msg.sender === 'ai' ? (
                                            <div>
                                                {msg.reasoning && (
                                                    <div className={`reasoning-section ${msg.isReasoningCollapsed ? 'collapsed' : ''}`}>
                                                        <div 
                                                            className="reasoning-header"
                                                            onClick={() => {
                                                                setChatMessages(prev => prev.map(m => 
                                                                    m.id === msg.id 
                                                                        ? { ...m, isReasoningCollapsed: !m.isReasoningCollapsed }
                                                                        : m
                                                                ));
                                                            }}
                                                        >
                                                            <div className="reasoning-header-content">
                                                                <i className="fas fa-brain"></i>
                                                                <span>Thinking</span>
                                                                {msg.isStreaming && !msg.isReasoningComplete && (
                                                                    <span style={{fontSize: '0.7rem', opacity: 0.8}}>
                                                                        {Math.floor((msg.reasoning?.length || 0) / 5)}s
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <i className={`fas fa-chevron-down reasoning-toggle ${msg.isReasoningCollapsed ? 'collapsed' : ''}`}></i>
                                                        </div>
                                                        <div className="reasoning-content-wrapper">
                                                            <div 
                                                                className="reasoning-content"
                                                                ref={(el) => {
                                                                    if (el) {
                                                                        reasoningContentRefs.current.set(msg.id, el);
                                                                        // Auto-scroll to bottom when new reasoning content is added
                                                                        if (msg.isStreaming && !msg.isReasoningComplete) {
                                                                            el.scrollTop = el.scrollHeight;
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                {msg.reasoning}
                                                                {msg.isStreaming && !msg.isReasoningComplete && (
                                                                    <span className="streaming-cursor">▊</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {msg.text && (
                                                    <div className="response-content">
                                                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                                                        {msg.isStreaming && msg.isReasoningComplete && (
                                                            <span className="streaming-cursor">▊</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p>{msg.text}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isAiTyping && (
                                <div className="chat-message ai typing">
                                    <div className="avatar">
                                        <i className="fas fa-robot"></i>
                                    </div>
                                    <div className="message-content">
                                        <span className="spinner"></span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="chat-input-area">
                            <div className="chat-input-container">
                                <button 
                                    onClick={toggleThinkMode} 
                                    className={`model-bubble-btn think-btn-left ${selectedChatModel === 'thinking' ? 'active' : ''}`}
                                    title={selectedChatModel === 'thinking' ? 'Switch to normal mode' : 'Switch to thoughtful mode'}
                                >
                                    <i className={`fas ${selectedChatModel === 'thinking' ? 'fa-brain' : 'fa-lightbulb'}`}></i>
                                    <span>{selectedChatModel === 'thinking' ? 'Thinking' : 'Think'}</span>
                                </button>
                                <textarea
                                    className="chat-input-field"
                                    placeholder="Ask a question about the document..."
                                    value={currentMessage}
                                    onChange={(e) => setCurrentMessage(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    disabled={isAiTyping}
                                    rows={1}
                                />
                                <div className="chat-input-controls">
                                    <button onClick={handleSendMessage} className="send-btn" disabled={!currentMessage.trim() || isAiTyping}>
                                        <i className="fas fa-paper-plane"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showPreviewModal && firstPagePreviewUrl && (
                    <div className="preview-modal-overlay" onClick={() => setShowPreviewModal(false)}>
                        <div className="preview-modal-content" onClick={(e) => e.stopPropagation()}>
                            <button className="preview-modal-close-btn" onClick={() => setShowPreviewModal(false)} aria-label="Close preview">
                                <i className="fas fa-times"></i>
                            </button>
                            <img src={firstPagePreviewUrl} alt="Document Preview" />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
