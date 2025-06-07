import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const App: React.FC = () => {
    type View = 'upload' | 'ocrConfig' | 'chat';
    type ChatModel = 'plain' | 'thinking';
    interface ChatMessage {
        id: string;
        sender: 'user' | 'ai';
        text: string;
        modelUsed?: ChatModel;
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

    useEffect(() => {
        if (chatAreaRef.current) {
            chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
        }
    }, [chatMessages]);

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
        if (value < 33) return "Fastest, basic accuracy.";
        if (value < 66) return "Good balance of speed and accuracy.";
        return "Slowest, highest accuracy.";
    };

    const simulateOcrProcessing = async (file: File, effort: number): Promise<{ ocrText: string, previewUrl?: string }> => {
        console.log(`Simulating OCR for ${file.name} with effort ${getOcrEffortLabel(effort)}`);
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

    const simulateChatResponse = async (message: string, model: ChatModel, context: string | null): Promise<string> => {
        console.log(`Simulating chat response for: "${message}" using ${model} model. Context available: ${!!context}`);
        return new Promise(resolve => {
            setTimeout(() => {
                let response = `You asked about "${message.substring(0,30)}...". `;
                if (model === 'thinking') {
                    response += "After careful consideration and deep thought, I believe the answer involves complex interdependencies. The document mentions related concepts. For example... (simulated thoughtful response using thinking model)";
                } else {
                    response += "Based on the document, this is a straightforward query. The relevant section indicates... (simulated plain response)";
                }
                 if (context && message.toLowerCase().includes('pricing')) { // Check message for pricing context too
                    response += " Regarding pricing, the document seems to outline several tiers."
                }
                resolve(response);
            }, model === 'thinking' ? 2000 : 800);
        });
    };

    const handleSendMessage = async () => {
        if (!currentMessage.trim() || isAiTyping) return;
        setError(null);

        const newUserMessage: ChatMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text: currentMessage,
        };
        setChatMessages(prev => [...prev, newUserMessage]);
        const messageToSend = currentMessage;
        setCurrentMessage('');
        setIsAiTyping(true);

        try {
            const aiResponseText = await simulateChatResponse(messageToSend, selectedChatModel, ocrResultText);
            const newAiMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: aiResponseText,
                modelUsed: selectedChatModel,
            };
            setChatMessages(prev => [...prev, newAiMessage]);
        } catch (e) {
            setError("Failed to get response from AI. Please try again.");
            console.error(e);
             const errorAiMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: "Sorry, I encountered an error trying to respond.",
                modelUsed: selectedChatModel,
            };
            setChatMessages(prev => [...prev, errorAiMessage]);
        } finally {
            setIsAiTyping(false);
        }
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
                    <div className="chat-view" aria-labelledby="chat-title-main">
                        {/* Document name is now in .main-header-controls */}
                        {/* <h2 id="chat-title-main" className="chat-header">Chat with: {pdfFile.name}</h2> */}
                        
                        {/* Display simplified OCR context if available and not too long, or make it toggleable */}
                        {ocrResultText && (
                             <div className="ocr-context-preview-chat">
                                <strong>Document Context (Summary):</strong> {ocrResultText.substring(0,150)}...
                             </div>
                        )}

                        {/* Old model selection chat removed from here */}

                        <div className="chat-area" ref={chatAreaRef} aria-live="polite" aria-atomic="false">
                            {chatMessages.map((msg) => (
                                <div key={msg.id} className={`chat-message ${msg.sender} ${msg.sender === 'ai' && msg.modelUsed === 'thinking' ? 'thinking' : ''}`}
                                    role="log" aria-label={`${msg.sender} message`}
                                >
                                   <div className="avatar">
                                     {msg.sender === 'ai' ? 'AI' : <i className="fas fa-user"></i>}
                                   </div>
                                   <div className="message-content">
                                    {msg.sender === 'ai' && (
                                        <div className="ai-message-header">
                                            <span className="message-sender-label">AI</span>
                                            {msg.modelUsed === 'thinking' && (
                                                <span className="thinking-indicator" title="Thinking model">
                                                    <i className="fas fa-brain"></i>
                                                </span>
                                            )}
                                            {msg.modelUsed && msg.modelUsed !== 'thinking' && (
                                                 <span className="model-tag">({msg.modelUsed})</span>
                                            )}
                                        </div>
                                    )}
                                    {msg.text}
                                   </div>
                                </div>
                            ))}
                            {isAiTyping && (
                                <div className="chat-message ai typing" aria-label="AI is typing">
                                    <div className="avatar">AI</div>
                                    <div className="message-content">
                                        <span className="spinner"></span> Typing...
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="chat-input-area">
                            <div className="model-bubble-buttons" role="radiogroup" aria-label="Select AI Model">
                                <button
                                    onClick={() => setSelectedChatModel('plain')}
                                    className={`model-bubble-btn ${selectedChatModel === 'plain' ? 'active' : ''}`}
                                    aria-pressed={selectedChatModel === 'plain'}
                                >
                                    Plain
                                </button>
                                <button
                                    onClick={() => setSelectedChatModel('thinking')}
                                    className={`model-bubble-btn ${selectedChatModel === 'thinking' ? 'active' : ''}`}
                                    aria-pressed={selectedChatModel === 'thinking'}
                                >
                                    <i className="fas fa-brain"></i> Thinking
                                </button>
                            </div>
                            <div className="chat-input-controls"> {/* New wrapper for input and send button */}
                                <input
                                    type="text"
                                    className="chat-input-field"
                                    value={currentMessage}
                                    onChange={(e) => setCurrentMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && !isAiTyping && handleSendMessage()}
                                    placeholder="Ask something about your document..."
                                    aria-label="Type your message"
                                    disabled={isAiTyping}
                                />
                                <button onClick={handleSendMessage} className="send-btn" disabled={isAiTyping || !currentMessage.trim()} aria-label="Send message">
                                    {isAiTyping ? <span className="spinner"></span> : <i className="fas fa-paper-plane"></i>}
                                </button>
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
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
