import { renderMarkdown, isItinerary } from '../lib/markdown';
import ItineraryDisplay from './ItineraryDisplay';

interface Message { role: 'user' | 'assistant'; content: string; }
interface ChatMessageProps {
  message: Message;
  onViewFullItinerary?: () => void;
  hasFullItinerary?: boolean;
}

export default function ChatMessage({ message, onViewFullItinerary, hasFullItinerary }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const hasItinerary = !isUser && isItinerary(message.content);

  if (isUser) {
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
    const cityHeaderStart = message.content.indexOf('# ');
    const start = cityHeaderStart > -1 && cityHeaderStart < itineraryStart ? cityHeaderStart : itineraryStart;
    const beforeText = start > 0 ? message.content.slice(0, start).trim() : '';

    const refinementMarker = 'This is your RouteMethod itinerary.';
    const questionsMarker = '**A few things before we finalize:**';
    const endMarkerIdx = Math.max(
      message.content.lastIndexOf(refinementMarker),
      message.content.lastIndexOf(questionsMarker)
    );

    const itineraryEnd = endMarkerIdx > -1 ? endMarkerIdx : message.content.length;
    const itineraryContent = message.content.slice(start, itineraryEnd).trim();
    const afterText = endMarkerIdx > -1 ? message.content.slice(endMarkerIdx).trim() : '';

    return (
      <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {beforeText && <AssistantBubble content={beforeText} />}
        <ItineraryDisplay content={itineraryContent} />
        {afterText && <AssistantBubble content={afterText} />}
      </div>
    );
  }

  // Check if this is a refinement response that offers to show full itinerary
  const offersFullItinerary = message.content.toLowerCase().includes('would you like to see the full updated itinerary');

  return (
    <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <AssistantBubble content={message.content} />
      {offersFullItinerary && hasFullItinerary && onViewFullItinerary && (
        <div style={{ paddingLeft: '14px' }}>
          <button
            onClick={onViewFullItinerary}
            style={{
              padding: '8px 18px', backgroundColor: 'transparent',
              border: '1px solid var(--color-accent)', color: 'var(--color-accent)',
              fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: '0.12em',
              textTransform: 'uppercase', cursor: 'pointer', fontWeight: 400,
            }}
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
      <div style={{ flexShrink: 0, width: '2px', backgroundColor: 'var(--color-accent)', marginTop: '4px', alignSelf: 'stretch', opacity: 0.4 }} />
      <div className="prose-chat" style={{ fontSize: '0.875rem', color: 'var(--color-steel)', lineHeight: 1.7, fontWeight: 300, flex: 1 }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
