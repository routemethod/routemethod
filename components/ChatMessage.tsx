import { renderMarkdown, isItinerary } from '../lib/markdown';
import ItineraryDisplay from './ItineraryDisplay';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const hasItinerary = !isUser && isItinerary(message.content);

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-lg">
          <div className="bg-steel text-paper px-5 py-3.5 rounded-sm text-sm leading-relaxed font-body font-light">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // If this is an itinerary response, split out any text before/after
  if (hasItinerary) {
    // Find where the itinerary starts
    const itineraryStart = message.content.indexOf('## Day');
    const beforeText = itineraryStart > 0 ? message.content.slice(0, itineraryStart).trim() : '';
    
    // Find the refinement prompt at the end
    const refinementPrompt = 'This is your RouteMethod itinerary.';
    const refinementIdx = message.content.lastIndexOf(refinementPrompt);
    const itineraryEnd = refinementIdx > -1 ? refinementIdx : message.content.length;
    
    const itineraryContent = message.content.slice(itineraryStart, itineraryEnd).trim();
    const afterText = refinementIdx > -1 ? message.content.slice(refinementIdx).trim() : '';

    return (
      <div className="animate-fade-up space-y-4">
        {beforeText && (
          <AssistantBubble content={beforeText} />
        )}
        <ItineraryDisplay content={itineraryContent} />
        {afterText && (
          <AssistantBubble content={afterText} />
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <AssistantBubble content={message.content} />
    </div>
  );
}

function AssistantBubble({ content }: { content: string }) {
  const html = renderMarkdown(content);
  return (
    <div className="flex gap-3">
      {/* Logo mark */}
      <div className="flex-shrink-0 w-6 h-6 mt-0.5 flex items-center justify-center">
        <div className="w-1 h-4 bg-gold opacity-60" />
      </div>
      <div
        className="prose-chat text-sm text-steel leading-relaxed font-body font-light flex-1"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
