import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import ChatMessage from '../components/ChatMessage';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_REFINEMENTS = 10;

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [refinementCount, setRefinementCount] = useState(0);
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1);
  const [streamingContent, setStreamingContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const detectPhase = (content: string): 1 | 2 | 3 | 4 => {
    if (content.includes('## Day') || content.includes('### Morning')) return 3;
    if (content.includes('clarif') || content.includes('question') || content.includes('1.') && content.includes('2.')) return 2;
    return phase;
  };

  const startSession = async () => {
    setIsStarted(true);
    setIsLoading(true);
    setStreamingContent('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello, I want to plan a trip.' }],
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                fullContent += data.text;
                setStreamingContent(fullContent);
              }
              if (data.done) {
                setMessages([
                  { role: 'user', content: 'Hello, I want to plan a trip.' },
                  { role: 'assistant', content: fullContent },
                ]);
                setStreamingContent('');
                setIsLoading(false);
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    // Track refinements in phase 4
    if (phase === 3 || phase === 4) {
      const newCount = refinementCount + 1;
      setRefinementCount(newCount);
      setPhase(4);
      
      if (newCount > MAX_REFINEMENTS) {
        setMessages(prev => [
          ...prev,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: "You've reached the refinement limit for this itinerary. Your final plan is ready to save or export." }
        ]);
        setIsLoading(false);
        return;
      }
    }

    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: userMessage },
    ];
    setMessages(newMessages);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                fullContent += data.text;
                setStreamingContent(fullContent);
              }
              if (data.done) {
                const updatedMessages: Message[] = [
                  ...newMessages,
                  { role: 'assistant', content: fullContent },
                ];
                setMessages(updatedMessages);
                setStreamingContent('');
                setIsLoading(false);

                // Detect phase change
                const newPhase = detectPhase(fullContent);
                if (newPhase > phase) setPhase(newPhase);
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const adjustTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  };

  const refinementsLeft = MAX_REFINEMENTS - refinementCount;
  const isRefinementPhase = phase === 4;

  return (
    <>
      <Head>
        <title>RouteMethod — Travel, Engineered.</title>
        <meta name="description" content="Transform chaotic saved lists into structured, intentional travel itineraries." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-paper flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-paper sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
            <div>
              <div className="font-display text-xl text-ink tracking-wide">RouteMethod</div>
              <div className="text-gold mt-0.5" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                Travel, Engineered.
              </div>
            </div>
            {isRefinementPhase && (
              <div className="text-right">
                <div className="text-xs text-mist font-body" style={{ fontSize: '0.65rem', letterSpacing: '0.06em' }}>
                  Refinements
                </div>
                <div className="font-display text-lg text-gold">
                  {refinementsLeft}
                  <span className="text-mist text-sm font-body font-light"> / {MAX_REFINEMENTS}</span>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-8">
          {!isStarted ? (
            /* Landing state */
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-up">
              <div className="mb-2">
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="w-px h-8 bg-gold opacity-40" />
                  <div className="w-1 h-12 bg-gold" />
                  <div className="w-px h-8 bg-gold opacity-40" />
                </div>
              </div>
              <h1 className="font-display text-4xl text-ink mb-3 tracking-wide">
                Plan with intention.
              </h1>
              <p className="text-mist font-body font-light text-sm leading-relaxed max-w-sm mb-10" style={{ letterSpacing: '0.02em' }}>
                Paste your saved places. Answer a few questions.
                Walk away with a structured, day-by-day itinerary
                built around your trip — not a generic template.
              </p>
              <button
                onClick={startSession}
                className="px-10 py-3.5 bg-ink text-paper font-body font-light text-sm tracking-widest uppercase hover:bg-steel transition-colors duration-300"
                style={{ letterSpacing: '0.14em', fontSize: '0.7rem' }}
              >
                Begin Planning
              </button>
              <p className="text-mist mt-8 font-body font-light" style={{ fontSize: '0.65rem', letterSpacing: '0.1em' }}>
                No account required to start.
              </p>
            </div>
          ) : (
            /* Chat state */
            <div className="space-y-6">
              {messages.map((message, index) => (
                <ChatMessage key={index} message={message} />
              ))}

              {/* Streaming indicator */}
              {streamingContent && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="flex-shrink-0 w-6 h-6 mt-0.5 flex items-center justify-center">
                    <div className="w-1 h-4 bg-gold animate-pulse-soft" />
                  </div>
                  <div className="prose-chat text-sm text-steel leading-relaxed font-body font-light flex-1 whitespace-pre-wrap">
                    {streamingContent}
                  </div>
                </div>
              )}

              {/* Loading dots */}
              {isLoading && !streamingContent && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="flex-shrink-0 w-6 h-6 mt-0.5 flex items-center justify-center">
                    <div className="w-1 h-4 bg-gold opacity-30" />
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-soft"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </main>

        {/* Input area */}
        {isStarted && (
          <div className="border-t border-border bg-paper sticky bottom-0">
            <div className="max-w-2xl mx-auto px-6 py-4">
              {refinementCount >= MAX_REFINEMENTS ? (
                <div className="text-center py-3">
                  <p className="text-mist font-body font-light" style={{ fontSize: '0.7rem', letterSpacing: '0.08em' }}>
                    Your itinerary is complete. Export it above to save.
                  </p>
                </div>
              ) : (
                <div className="flex gap-3 items-end">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      adjustTextarea();
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      phase === 1
                        ? 'Paste your trip details here...'
                        : phase === 2
                        ? 'Answer the questions above...'
                        : phase === 3 || phase === 4
                        ? 'Request a refinement...'
                        : 'Type your message...'
                    }
                    disabled={isLoading}
                    rows={1}
                    className="flex-1 bg-cream border border-border rounded-sm px-4 py-3 text-sm font-body font-light text-ink placeholder-mist resize-none focus:outline-none focus:border-gold transition-colors duration-200 disabled:opacity-50"
                    style={{ minHeight: '44px', maxHeight: '160px' }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || !input.trim()}
                    className="flex-shrink-0 px-5 py-3 bg-ink text-paper font-body font-light text-xs tracking-widest uppercase hover:bg-steel transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed h-11"
                    style={{ letterSpacing: '0.12em', fontSize: '0.65rem' }}
                  >
                    Send
                  </button>
                </div>
              )}
              <p className="text-mist mt-2 font-body font-light" style={{ fontSize: '0.6rem', letterSpacing: '0.06em' }}>
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
