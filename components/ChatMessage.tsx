import { useState } from 'react';
import { renderMarkdown, isItinerary } from '../lib/markdown';
import ItineraryDisplay from './ItineraryDisplay';

interface Message { role: 'user' | 'assistant'; content: string; }
interface ChatMessageProps { message: Message; }

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const hasItinerary = !isUser && isItinerary(message.content);
  const [showFull, setShowFull] = useState(false);

  if (isUser) {
    // Don't show the raw trip data submission
    if (message.content.startsWith('Here are my trip details:')) return null;
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }} className="animate-fade-up">
        <div style={{ maxWidth: '480px', backgroundColor: 'var(--color-steel)', color: 'var(--color-paper)', padding: '10px 16px', fontSize: '0.875rem', lineHeight: 1.65, fontWeight: 300 }}>
          {message.content}
        </div>
      </div>
    );
  }

  if (hasItinerary) {
    const itineraryStart = message.content.indexOf('## Day');
    const beforeText = itineraryStart > 0 ? message.content.slice(0, itineraryStart).trim() : '';
    const refinementMarker = 'This is your RouteMethod itinerary.';
    const refinementIdx = message.content.lastIndexOf(refinementMarker);
    const itineraryEnd = refinementIdx > -1 ? refinementIdx : message.content.length;
    const itineraryContent = message.content.slice(itineraryStart, itineraryEnd).trim();
    const afterText = refinementIdx > -1 ? message.content.slice(refinementIdx).trim() : '';

    return (
      <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {beforeText && <AssistantBubble content={beforeText} />}
        <ItineraryDisplay content={itineraryContent} />
        {afterText && <AssistantBubble content={afterText} />}
      </div>
    );
  }

  // Check if this is a refinement response (has "Would you like to see the full updated itinerary")
  const hasFullItineraryOffer = message.content.toLowerCase().includes('would you like to see the full updated itinerary') ||
    message.content.toLowerCase().includes('full updated itinerary');

  return (
    <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <AssistantBubble content={message.content} />
      {hasFullItineraryOffer && !showFull && (
        <div style={{ paddingLeft: '14px' }}>
          <button
            onClick={() => setShowFull(true)}
            style={{ padding: '8px 18px', backgroundColor: 'transparent', border: '1px solid var(--color-accent)', color: 'var(--color-accent)', fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 400, transition: 'all 0.15s ease' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-accent)'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--color-accent)'; }}
          >
            View Full Itinerary
          </button>
        </div>
      )}
    </div>
  );
}

function AssistantBubble({ content }: { content: string }) {
  const html = renderMarkdown(content);
  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      <div style={{ flexShrink: 0, width: '2px', backgroundColor: 'var(--color-accent)', marginTop: '4px', alignSelf: 'stretch', opacity: 0.45 }} />
      <div className="prose-chat" style={{ fontSize: '0.875rem', color: 'var(--color-steel)', lineHeight: 1.7, fontWeight: 300, flex: 1 }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
