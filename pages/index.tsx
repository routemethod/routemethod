import { useState, useRef, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import ChatMessage from '../components/ChatMessage';
import { extractDayAssignments } from '../lib/markdown';

interface Message { role: 'user' | 'assistant'; content: string; }
type AppStage = 'landing' | 'input' | 'clarify' | 'itinerary';
const MAX_REFINEMENTS = 10;
const PACE_OPTIONS = ['Relaxed', 'Balanced', 'Packed'];
const BUDGET_OPTIONS = ['Budget', 'Mid-range', 'Luxury'];

// A single row in a place category
interface PlaceRow { name: string; notes: string; nonNegotiable: boolean; }
// A hotel row
interface HotelRow { name: string; neighborhood: string; }

interface PlaceItem { name: string; notes?: string; nonNegotiable?: boolean; isLink?: boolean; }
interface TripData {
  destination: string; arrival: string; departure: string;
  hotels: HotelRow[];
  pace: string; budget: string[];
  restaurants: PlaceItem[]; cafes: PlaceItem[];
  bars: PlaceItem[]; activities: PlaceItem[]; niceToHaves: PlaceItem[];
  reservations: string[]; notes: string;
}

const LOADING_PHASES = [
  { label: 'Mapping your anchors', duration: 1800 },
  { label: 'Assessing daily density', duration: 1600 },
  { label: 'Clustering by neighborhood', duration: 1800 },
  { label: 'Shaping energy arc', duration: 1500 },
  { label: 'Running friction audit', duration: 2000 },
  { label: 'Building your itinerary', duration: 99999 },
];

function emptyRows(n: number): PlaceRow[] {
  return Array.from({ length: n }, () => ({ name: '', notes: '', nonNegotiable: false }));
}

function useAutoExpand(rows: PlaceRow[], setRows: (r: PlaceRow[]) => void) {
  useEffect(() => {
    const last = rows[rows.length - 1];
    if (last && (last.name.trim() || last.notes.trim())) {
      setRows([...rows, { name: '', notes: '', nonNegotiable: false }]);
    }
  }, [rows, setRows]);
}

function PlaceCategory({
  label, rows, setRows, namePlaceholder, notesPlaceholder, showCheckbox = true,
}: {
  label: string; rows: PlaceRow[]; setRows: (r: PlaceRow[]) => void;
  namePlaceholder?: string; notesPlaceholder?: string; showCheckbox?: boolean;
}) {
  useAutoExpand(rows, setRows);

  const update = (i: number, field: keyof PlaceRow, value: string | boolean) => {
    const updated = rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r);
    setRows(updated);
  };

  const S = {
    input: { flex: 1, backgroundColor: 'var(--color-cream)', border: '1px solid var(--color-border)', padding: '8px 11px', fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--color-ink)', fontWeight: 300, outline: 'none', lineHeight: 1.5, minWidth: 0 } as React.CSSProperties,
  };

  return (
    <div style={{ marginBottom: '18px' }}>
      <p style={{ fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: '8px', fontWeight: 500 }}>{label}</p>
      <div style={{ display: 'grid', gridTemplateColumns: showCheckbox ? '3fr 2fr 24px' : '3fr 2fr', gap: '0', borderTop: '1px solid var(--color-border-light)' }}>
        {/* Column headers */}
        <div style={{ padding: '4px 11px', fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-mist)', borderBottom: '1px solid var(--color-border-light)' }}>Place</div>
        <div style={{ padding: '4px 11px', fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-mist)', borderBottom: '1px solid var(--color-border-light)', borderLeft: '1px solid var(--color-border-light)' }}>Notes</div>
        {showCheckbox && <div style={{ padding: '4px 6px', fontSize: '0.56rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-mist)', borderBottom: '1px solid var(--color-border-light)', borderLeft: '1px solid var(--color-border-light)', textAlign: 'center' }}>★</div>}

        {rows.map((row, i) => (
          <div key={i} style={{ display: 'contents' }}>
            <input
              value={row.name}
              onChange={e => update(i, 'name', e.target.value)}
              placeholder={namePlaceholder || 'Place name'}
              style={{ ...S.input, borderTop: 'none', borderRight: 'none', borderBottom: '1px solid var(--color-border-light)' }}
            />
            <input
              value={row.notes}
              onChange={e => update(i, 'notes', e.target.value)}
              placeholder={notesPlaceholder || ''}
              style={{ ...S.input, borderTop: 'none', borderRight: 'none', borderLeft: '1px solid var(--color-border-light)', borderBottom: '1px solid var(--color-border-light)' }}
            />
            {showCheckbox && (
              <div
                onClick={() => update(i, 'nonNegotiable', !row.nonNegotiable)}
                title="Non-negotiable"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderLeft: '1px solid var(--color-border-light)', borderBottom: '1px solid var(--color-border-light)', backgroundColor: row.nonNegotiable ? 'var(--color-accent)' : 'transparent', transition: 'background 0.15s' }}
              >
                <span style={{ fontSize: '0.65rem', color: row.nonNegotiable ? 'white' : 'var(--color-border)', userSelect: 'none' }}>★</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <p style={{ fontSize: '0.58rem', color: 'var(--color-mist)', marginTop: '4px' }}>★ = Non-negotiable</p>
    </div>
  );
}

function HotelInput({ hotels, setHotels }: { hotels: HotelRow[]; setHotels: (h: HotelRow[]) => void }) {
  useEffect(() => {
    const last = hotels[hotels.length - 1];
    if (last && (last.name.trim() || last.neighborhood.trim())) {
      setHotels([...hotels, { name: '', neighborhood: '' }]);
    }
  }, [hotels, setHotels]);

  const update = (i: number, field: keyof HotelRow, value: string) => {
    setHotels(hotels.map((h, idx) => idx === i ? { ...h, [field]: value } : h));
  };

  const S = { input: { flex: 1, backgroundColor: 'var(--color-cream)', border: '1px solid var(--color-border)', padding: '8px 11px', fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--color-ink)', fontWeight: 300, outline: 'none', lineHeight: 1.5, minWidth: 0 } as React.CSSProperties };

  return (
    <div style={{ marginBottom: '24px' }}>
      <p style={{ fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: '8px', fontWeight: 500 }}>Hotel</p>
      <div style={{ borderTop: '1px solid var(--color-border-light)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr' }}>
          <div style={{ padding: '4px 11px', fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-mist)', borderBottom: '1px solid var(--color-border-light)' }}>Hotel Name</div>
          <div style={{ padding: '4px 11px', fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-mist)', borderBottom: '1px solid var(--color-border-light)', borderLeft: '1px solid var(--color-border-light)' }}>Neighborhood</div>
          {hotels.map((h, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <input value={h.name} onChange={e => update(i, 'name', e.target.value)} placeholder="Hotel name" style={{ ...S.input, borderTop: 'none', borderRight: 'none', borderBottom: '1px solid var(--color-border-light)' }} />
              <input value={h.neighborhood} onChange={e => update(i, 'neighborhood', e.target.value)} placeholder="Neighborhood" style={{ ...S.input, borderTop: 'none', borderRight: 'none', borderLeft: '1px solid var(--color-border-light)', borderBottom: '1px solid var(--color-border-light)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [appStage, setAppStage] = useState<AppStage>('landing');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [refinementCount, setRefinementCount] = useState(0);
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [dayAssignments, setDayAssignments] = useState<Record<string, string>>({});
  const [fullItineraryContent, setFullItineraryContent] = useState<string>('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form state
  const [destination, setDestination] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [hotels, setHotels] = useState<HotelRow[]>([{ name: '', neighborhood: '' }, { name: '', neighborhood: '' }]);
  const [restaurants, setRestaurants] = useState<PlaceRow[]>(emptyRows(3));
  const [cafes, setCafes] = useState<PlaceRow[]>(emptyRows(3));
  const [bars, setBars] = useState<PlaceRow[]>(emptyRows(3));
  const [activities, setActivities] = useState<PlaceRow[]>(emptyRows(3));
  const [niceToHaves, setNiceToHaves] = useState<PlaceRow[]>(emptyRows(3));
  const [reservations, setReservations] = useState('');
  const [pace, setPace] = useState('Balanced');
  const [budget, setBudget] = useState<string[]>(['Mid-range']);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const itineraryMessages = messages.filter(m => m.role === 'assistant' && m.content.includes('## Day'));
    if (itineraryMessages.length > 0) {
      const latest = itineraryMessages[itineraryMessages.length - 1];
      setFullItineraryContent(latest.content);
      setDayAssignments(extractDayAssignments(latest.content));
    }
  }, [messages]);

  // Advance loading phases with realistic timing
  const startLoadingPhases = useCallback(() => {
    setLoadingPhase(0);
    let phase = 0;
    const advance = () => {
      phase++;
      if (phase < LOADING_PHASES.length - 1) {
        setLoadingPhase(phase);
        loadingTimerRef.current = setTimeout(advance, LOADING_PHASES[phase].duration);
      } else {
        setLoadingPhase(LOADING_PHASES.length - 1);
      }
    };
    loadingTimerRef.current = setTimeout(advance, LOADING_PHASES[0].duration);
  }, []);

  const stopLoadingPhases = useCallback(() => {
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    setLoadingPhase(0);
  }, []);

  const getDayForPlace = (placeName: string): string | undefined => {
    if (!placeName || placeName.startsWith('http')) return undefined;
    const lower = placeName.toLowerCase();
    for (const [key, day] of Object.entries(dayAssignments)) {
      if (lower.includes(key) || key.includes(lower.split(' ')[0])) return day;
    }
    return undefined;
  };

  const rowsToItems = (rows: PlaceRow[]): PlaceItem[] =>
    rows.filter(r => r.name.trim()).map(r => ({
      name: r.name.trim(),
      notes: r.notes.trim() || undefined,
      nonNegotiable: r.nonNegotiable,
    }));

  const formatPlacesForAI = (items: PlaceItem[]): string => {
    if (items.length === 0) return 'None';
    return items.map(p => {
      let s = p.name;
      if (p.notes) s += ` [${p.notes}]`;
      if (p.nonNegotiable) s += ' [NON-NEGOTIABLE]';
      return s;
    }).join('\n');
  };

  const buildTripText = () => {
    const hotelText = hotels.filter(h => h.name.trim()).map(h => `${h.name}${h.neighborhood ? ', ' + h.neighborhood : ''}`).join(' / ') || 'None';

    return `Here are my trip details:

Destination: ${destination}
Arrival: ${arrivalDate}${arrivalTime ? ' at ' + arrivalTime : ''}
Departure: ${departureDate}${departureTime ? ' at ' + departureTime : ''}
Hotel(s): ${hotelText}
Preferred pace: ${pace}
Budget level: ${budget.join(' & ')}

SAVED PLACES:
Restaurants & Food:
${formatPlacesForAI(rowsToItems(restaurants))}

Cafes:
${formatPlacesForAI(rowsToItems(cafes))}

Bars & Nightlife:
${formatPlacesForAI(rowsToItems(bars))}

Activities & Sights:
${formatPlacesForAI(rowsToItems(activities))}

Nice to Haves:
${formatPlacesForAI(rowsToItems(niceToHaves))}

Confirmed Reservations: ${reservations || 'None'}
Additional Notes: ${notes || 'None'}`;
  };

  const callAPI = async (msgs: Message[], refinementsUsed?: number): Promise<string> => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs, refinementsUsed, maxRefinements: MAX_REFINEMENTS }),
    });
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) fullContent += data.text;
            if (data.done) return fullContent;
          } catch {}
        }
      }
    }
    return fullContent;
  };

  const handleFormSubmit = async () => {
    if (!destination || !arrivalDate || !departureDate) return;
    setIsLoading(true);
    setAppStage('clarify');
    setPanelOpen(true);
    startLoadingPhases();

    const hotelList = hotels.filter(h => h.name.trim());
    const td: TripData = {
      destination,
      arrival: `${arrivalDate}${arrivalTime ? ' at ' + arrivalTime : ''}`,
      departure: `${departureDate}${departureTime ? ' at ' + departureTime : ''}`,
      hotels: hotelList,
      pace, budget,
      restaurants: rowsToItems(restaurants),
      cafes: rowsToItems(cafes),
      bars: rowsToItems(bars),
      activities: rowsToItems(activities),
      niceToHaves: rowsToItems(niceToHaves),
      reservations: reservations.split('\n').map(s => s.trim()).filter(Boolean),
      notes,
    };
    setTripData(td);

    const initialMessages: Message[] = [{ role: 'user', content: buildTripText() }];
    const content = await callAPI(initialMessages);
    stopLoadingPhases();
    setMessages([...initialMessages, { role: 'assistant', content }]);
    setIsLoading(false);
  };

  const updateTripDataFromChat = (userMessage: string) => {
    if (!tripData) return;
    const updated = {
      ...tripData,
      restaurants: [...tripData.restaurants],
      cafes: [...tripData.cafes],
      bars: [...tripData.bars],
      activities: [...tripData.activities],
      niceToHaves: [...tripData.niceToHaves],
    };

    const arrMatch = userMessage.match(/arrival.*?(\w+\s+\d+|\d+[\/\-]\d+)/i);
    const depMatch = userMessage.match(/departure.*?(\w+\s+\d+|\d+[\/\-]\d+)/i);
    if (arrMatch) updated.arrival = arrMatch[1];
    if (depMatch) updated.departure = depMatch[1];

    const addMatch = userMessage.match(/(?:add|also add|include|I want to add|I'd like to add)\s+([A-Z][^,\.\n]{2,50})/i);
    if (addMatch) {
      const newPlace = addMatch[1].replace(/\s+to(?:\s+my\s+list)?\s*$/i, '').trim();
      updated.restaurants = [...updated.restaurants, { name: newPlace }];
    }

    setTripData(updated);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isLoading) return;
    const userMessage = chatInput.trim();
    setChatInput('');
    setIsLoading(true);

    const isRefinement = appStage === 'itinerary';
    let currentCount = refinementCount;

    if (isRefinement) {
      currentCount = refinementCount + 1;
      setRefinementCount(currentCount);
      if (currentCount > MAX_REFINEMENTS) {
        setMessages(prev => [...prev,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: "You have reached the refinement limit for this itinerary. Your final plan is ready to export." }
        ]);
        setIsLoading(false);
        return;
      }
      startLoadingPhases();
    }

    updateTripDataFromChat(userMessage);

    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    const content = await callAPI(newMessages, currentCount);
    stopLoadingPhases();
    const updated: Message[] = [...newMessages, { role: 'assistant', content }];
    setMessages(updated);
    setIsLoading(false);

    if (content.includes('## Day') && appStage !== 'itinerary') {
      setAppStage('itinerary');
    }
  };

  const handleViewFullItinerary = () => {
    if (!fullItineraryContent) return;
    setMessages(prev => [...prev, { role: 'assistant', content: fullItineraryContent }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  };

  const adjustTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  };

  const stageNum = appStage === 'clarify' ? '2' : appStage === 'itinerary' ? '3' : '1';
  const stageLabels = ['Input', 'Clarify', 'Itinerary'];

  const S = {
    input: { width: '100%', backgroundColor: 'var(--color-cream)', border: '1px solid var(--color-border)', padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--color-ink)', fontWeight: 300, outline: 'none', lineHeight: 1.5 } as React.CSSProperties,
    toggle: { padding: '6px 12px', fontFamily: 'var(--font-body)', fontSize: '0.68rem', letterSpacing: '0.06em', border: '1px solid', cursor: 'pointer', fontWeight: 300, transition: 'all 0.15s ease' } as React.CSSProperties,
    sectionTitle: { fontFamily: 'var(--font-body)', fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--color-accent)', marginBottom: '14px', fontWeight: 500 },
  };

  const renderPlaceList = (items: PlaceItem[], label: string) => {
    if (!items || items.length === 0) return null;
    return (
      <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--color-border-light)' }}>
        <p style={{ fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: '6px', fontWeight: 500 }}>{label}</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((item, i) => {
            const dayTag = getDayForPlace(item.name);
            return (
              <li key={i} style={{ fontSize: '0.75rem', color: 'var(--color-steel)', lineHeight: 1.55, fontWeight: 300, paddingLeft: '0.9rem', position: 'relative', marginBottom: '4px' }}>
                <span style={{ position: 'absolute', left: 0, color: item.nonNegotiable ? 'var(--color-accent)' : 'var(--color-mist)', fontSize: '0.65rem' }}>{item.nonNegotiable ? '★' : '—'}</span>
                <span>{item.isLink ? <em style={{ color: 'var(--color-mist)', fontStyle: 'italic' }}>Link — pending clarification</em> : item.name}</span>
                {dayTag && <span style={{ marginLeft: '6px', fontSize: '0.6rem', color: 'var(--color-accent)', fontWeight: 500 }}>{dayTag}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>RouteMethod — Travel, Engineered.</title>
        <meta name="description" content="Transform your saved places into a structured, intentional travel itinerary." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-paper)' }}>

        {/* HEADER */}
        <header style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-cream)', position: 'sticky', top: 0, zIndex: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '0 24px', height: '54px' }}>
            <button onClick={() => setAppStage('landing')} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', justifySelf: 'start' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 500, color: 'var(--color-ink)' }}>RouteMethod</span>
              <span style={{ fontSize: '0.56rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 400 }}>Travel, Engineered.</span>
            </button>

            {appStage !== 'landing' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifySelf: 'center' }}>
                {['1', '2', '3'].map((s, idx) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: s === stageNum ? 'var(--color-accent)' : 'transparent', border: `1px solid ${s <= stageNum ? 'var(--color-accent)' : 'var(--color-border)'}`, fontSize: '0.58rem', fontWeight: 500, color: s === stageNum ? 'white' : s < stageNum ? 'var(--color-accent)' : 'var(--color-mist)', transition: 'all 0.3s' }}>
                        {s < stageNum ? '✓' : s}
                      </div>
                      <span style={{ fontSize: '0.52rem', letterSpacing: '0.06em', color: s === stageNum ? 'var(--color-accent)' : 'var(--color-mist)', fontWeight: s === stageNum ? 500 : 300 }}>{stageLabels[idx]}</span>
                    </div>
                    {s !== '3' && <div style={{ width: '20px', height: '1px', backgroundColor: s < stageNum ? 'var(--color-accent)' : 'var(--color-border)', marginBottom: '14px' }} />}
                  </div>
                ))}
              </div>
            ) : <div />}

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifySelf: 'end' }}>
              <Link href="/method" style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-mist)', textDecoration: 'none' }}>The Method</Link>
              {appStage === 'itinerary' && (
                <span style={{ fontSize: '0.62rem', color: 'var(--color-mist)' }}>
                  <span style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-display)', fontSize: '0.9rem' }}>{refinementCount}</span>/{MAX_REFINEMENTS}
                </span>
              )}
              {(appStage === 'clarify' || appStage === 'itinerary') && tripData && (
                <button onClick={() => setPanelOpen(!panelOpen)} style={{ background: 'none', border: '1px solid', padding: '4px 10px', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.2s', borderColor: panelOpen ? 'var(--color-accent)' : 'var(--color-border)', color: panelOpen ? 'var(--color-accent)' : 'var(--color-mist)' }}>
                  My List
                </button>
              )}
            </div>
          </div>
        </header>

        <div style={{ flex: 1, display: 'flex' }}>
          <main style={{ flex: 1, minWidth: 0 }}>

            {/* LANDING */}
            {appStage === 'landing' && (
              <div>
                <section style={{ maxWidth: '720px', margin: '0 auto', padding: '80px 24px 64px', borderBottom: '1px solid var(--color-border)' }}>
                  <div className="animate-fade-up">
                    <p style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: '20px', fontWeight: 400 }}>Structured Travel Planning</p>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', fontWeight: 400, color: 'var(--color-ink)', lineHeight: 1.15, marginBottom: '12px' }}>
                      Your saved places,<br /><em>finally structured.</em>
                    </h1>
                    <p style={{ fontSize: '0.78rem', letterSpacing: '0.08em', color: 'var(--color-accent)', marginBottom: '20px', fontWeight: 400 }}>Guided by AI. Structured by method.</p>
                    <p style={{ fontSize: '0.95rem', color: 'var(--color-mist)', lineHeight: 1.75, maxWidth: '460px', marginBottom: '36px', fontWeight: 300 }}>Paste your restaurants, cafes, and experiences. RouteMethod builds a day-by-day itinerary engineered around neighborhoods, energy, and what matters most to you.</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                      <button onClick={() => setAppStage('input')} style={{ padding: '13px 34px', backgroundColor: 'var(--color-ink)', color: 'var(--color-paper)', fontFamily: 'var(--font-body)', fontSize: '0.68rem', letterSpacing: '0.14em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', fontWeight: 400 }}>Plan My Trip</button>
                      <Link href="/method" style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-mist)', textDecoration: 'none' }}>How it works →</Link>
                    </div>
                  </div>
                </section>
                <section style={{ maxWidth: '720px', margin: '0 auto', padding: '56px 24px' }}>
                  <p style={S.sectionTitle}>The Method</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '28px' }}>
                    {[
                      { num: '01', title: 'Anchor', desc: 'Confirmed reservations and non-negotiables form the skeleton everything else is built around.' },
                      { num: '02', title: 'Density', desc: 'We assess how many experiences can realistically fit each day without overloading it.' },
                      { num: '03', title: 'Cluster', desc: 'Experiences are grouped by neighborhood to minimize unnecessary cross-city travel.' },
                      { num: '04', title: 'Energy', desc: 'Demanding days come early. The pace decompresses naturally toward departure.' },
                      { num: '05', title: 'Friction', desc: 'Every day is stress-tested. Where problems are found, two specific alternatives are offered.' },
                    ].map(item => (
                      <div key={item.num} style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                        <div style={{ fontSize: '0.56rem', letterSpacing: '0.16em', color: 'var(--color-accent)', marginBottom: '6px', fontWeight: 500 }}>{item.num}</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 500, color: 'var(--color-ink)', marginBottom: '6px' }}>{item.title}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-mist)', lineHeight: 1.6, fontWeight: 300 }}>{item.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '36px' }}>
                    <Link href="/method" style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-mist)', textDecoration: 'none', borderBottom: '1px solid var(--color-border)', paddingBottom: '2px' }}>Read the full methodology →</Link>
                  </div>
                </section>
              </div>
            )}

            {/* STAGE 1 — INPUT */}
            {appStage === 'input' && (
              <div style={{ maxWidth: '680px', margin: '0 auto', padding: '44px 24px 120px' }} className="animate-fade-up">
                <div style={{ marginBottom: '36px' }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 400, color: 'var(--color-ink)', marginBottom: '8px' }}>Your Trip</h2>
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-mist)', fontWeight: 300 }}>Fill in your details and saved places. Star any place that is non-negotiable.</p>
                </div>

                <fieldset style={{ border: 'none', marginBottom: '32px' }}>
                  <legend style={S.sectionTitle}>Trip Details</legend>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Destination city" style={S.input} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <input type="date" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} style={S.input} />
                      <input type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} style={S.input} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <input type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} style={S.input} />
                      <input type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} style={S.input} />
                    </div>
                  </div>
                </fieldset>

                <HotelInput hotels={hotels} setHotels={setHotels} />

                <fieldset style={{ border: 'none', marginBottom: '32px' }}>
                  <legend style={S.sectionTitle}>Preferences</legend>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <p style={{ fontSize: '0.68rem', color: 'var(--color-mist)', marginBottom: '8px' }}>Daily Pace</p>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {PACE_OPTIONS.map(o => (
                          <button key={o} onClick={() => setPace(o)} style={{ ...S.toggle, backgroundColor: pace === o ? 'var(--color-ink)' : 'transparent', color: pace === o ? 'var(--color-paper)' : 'var(--color-mist)', borderColor: pace === o ? 'var(--color-ink)' : 'var(--color-border)' }}>{o}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.68rem', color: 'var(--color-mist)', marginBottom: '8px' }}>Budget Level</p>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {BUDGET_OPTIONS.map(o => {
                          const selected = budget.includes(o);
                          return <button key={o} onClick={() => setBudget(prev => prev.includes(o) ? prev.filter(b => b !== o) : [...prev, o])} style={{ ...S.toggle, backgroundColor: selected ? 'var(--color-ink)' : 'transparent', color: selected ? 'var(--color-paper)' : 'var(--color-mist)', borderColor: selected ? 'var(--color-ink)' : 'var(--color-border)' }}>{o}</button>;
                        })}
                      </div>
                    </div>
                  </div>
                </fieldset>

                <fieldset style={{ border: 'none', marginBottom: '32px' }}>
                  <legend style={S.sectionTitle}>Saved Places</legend>
                  <PlaceCategory label="Restaurants & Food" rows={restaurants} setRows={setRestaurants} notesPlaceholder="reservation day/time, wait time, neighborhood" />
                  <PlaceCategory label="Cafes" rows={cafes} setRows={setCafes} notesPlaceholder="reservation day/time, wait time, neighborhood" />
                  <PlaceCategory label="Bars & Nightlife" rows={bars} setRows={setBars} notesPlaceholder="reservation day/time, wait time, neighborhood" />
                  <PlaceCategory label="Activities & Sights" rows={activities} setRows={setActivities} notesPlaceholder="reservation day/time" />
                  <PlaceCategory label="Nice to Haves" rows={niceToHaves} setRows={setNiceToHaves} notesPlaceholder="reservation day/time" />
                </fieldset>

                <fieldset style={{ border: 'none', marginBottom: '32px' }}>
                  <legend style={S.sectionTitle}>Confirmed Reservations</legend>
                  <textarea value={reservations} onChange={e => setReservations(e.target.value)} placeholder="e.g. Pujol, Wednesday July 9 at 8:00pm" rows={2} style={{ ...S.input, resize: 'vertical' }} />
                </fieldset>

                <fieldset style={{ border: 'none', marginBottom: '40px' }}>
                  <legend style={S.sectionTitle}>Additional Notes</legend>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Travel companions, mobility considerations, things to avoid..." rows={2} style={{ ...S.input, resize: 'vertical' }} />
                </fieldset>

                <button onClick={handleFormSubmit} disabled={!destination || !arrivalDate || !departureDate || isLoading} style={{ padding: '13px 36px', backgroundColor: 'var(--color-ink)', color: 'var(--color-paper)', fontFamily: 'var(--font-body)', fontSize: '0.68rem', letterSpacing: '0.14em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', fontWeight: 400, opacity: (!destination || !arrivalDate || !departureDate) ? 0.4 : 1 }}>
                  {isLoading ? 'Analyzing...' : 'Continue to Clarify →'}
                </button>
              </div>
            )}

            {/* STAGES 2 & 3 */}
            {(appStage === 'clarify' || appStage === 'itinerary') && (
              <div style={{ maxWidth: '680px', margin: '0 auto', padding: '36px 24px 160px' }}>
                {appStage === 'clarify' && !isLoading && messages.length === 0 && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-mist)', fontWeight: 300, marginBottom: '28px' }}>RouteMethod has a few questions before building your itinerary.</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {messages.map((message, index) => (
                    <ChatMessage key={index} message={message} onViewFullItinerary={handleViewFullItinerary} hasFullItinerary={!!fullItineraryContent} />
                  ))}
                  {isLoading && (
                    <div className="animate-fade-in" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 0' }}>
                      <div style={{ width: '2px', backgroundColor: 'var(--color-accent)', opacity: 0.3, flexShrink: 0, alignSelf: 'stretch' }} />
                      <div>
                        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                          {[0,1,2].map(i => (
                            <div key={i} className="animate-pulse-soft" style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-accent)', animationDelay: `${i * 0.2}s` }} />
                          ))}
                        </div>
                        {appStage === 'itinerary' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {LOADING_PHASES.map((phase, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: i <= loadingPhase ? 1 : 0.25, transition: 'opacity 0.4s ease' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: i < loadingPhase ? 'var(--color-accent)' : i === loadingPhase ? 'var(--color-accent)' : 'var(--color-border)', flexShrink: 0, transition: 'background 0.3s' }} />
                                <span style={{ fontSize: '0.72rem', color: i === loadingPhase ? 'var(--color-steel)' : i < loadingPhase ? 'var(--color-mist)' : 'var(--color-border)', fontWeight: i === loadingPhase ? 400 : 300, letterSpacing: '0.02em', transition: 'color 0.3s' }}>
                                  {phase.label}{i === loadingPhase ? '...' : i < loadingPhase ? ' ✓' : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              </div>
            )}
          </main>

          {/* SIDE PANEL */}
          {(appStage === 'clarify' || appStage === 'itinerary') && tripData && panelOpen && (
            <aside style={{ width: '240px', flexShrink: 0, borderLeft: '1px solid var(--color-border)', backgroundColor: 'var(--color-cream)', position: 'sticky', top: '54px', height: 'calc(100vh - 54px)', overflowY: 'auto', padding: '20px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <p style={{ ...S.sectionTitle, marginBottom: 0 }}>My List</p>
                <button onClick={() => setPanelOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-mist)', lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--color-border-light)' }}>
                <p style={{ fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: '6px', fontWeight: 500 }}>Trip</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {[
                    { label: 'Destination', value: tripData.destination },
                    { label: 'Arrival', value: tripData.arrival },
                    { label: 'Departure', value: tripData.departure },
                    { label: 'Hotel', value: tripData.hotels.map(h => h.name).join(' / ') },
                    { label: 'Pace', value: tripData.pace },
                    { label: 'Budget', value: tripData.budget.join(' & ') },
                  ].filter(i => i.value).map(({ label, value }) => (
                    <li key={label} style={{ fontSize: '0.75rem', color: 'var(--color-steel)', lineHeight: 1.5, fontWeight: 300, marginBottom: '3px', paddingLeft: '0.9rem', position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, color: 'var(--color-accent)', fontSize: '0.7rem' }}>—</span>
                      <span style={{ color: 'var(--color-mist)', fontSize: '0.68rem' }}>{label}: </span>{value}
                    </li>
                  ))}
                </ul>
              </div>
              {renderPlaceList(tripData.restaurants, 'Restaurants')}
              {renderPlaceList(tripData.cafes, 'Cafes')}
              {renderPlaceList(tripData.bars, 'Bars')}
              {renderPlaceList(tripData.activities, 'Activities')}
              {renderPlaceList(tripData.niceToHaves, 'Nice to Haves')}
              {tripData.reservations.length > 0 && (
                <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--color-border-light)' }}>
                  <p style={{ fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: '6px', fontWeight: 500 }}>Reservations</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {tripData.reservations.map((r, i) => (
                      <li key={i} style={{ fontSize: '0.75rem', color: 'var(--color-steel)', lineHeight: 1.55, fontWeight: 300, paddingLeft: '0.9rem', position: 'relative', marginBottom: '3px' }}>
                        <span style={{ position: 'absolute', left: 0, color: 'var(--color-accent)', fontSize: '0.7rem' }}>—</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {tripData.notes && (
                <div>
                  <p style={{ fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: '6px', fontWeight: 500 }}>Notes</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-steel)', lineHeight: 1.55, fontWeight: 300 }}>{tripData.notes}</p>
                </div>
              )}
            </aside>
          )}
        </div>

        {/* CHAT INPUT */}
        {(appStage === 'clarify' || appStage === 'itinerary') && (
          <div style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-cream)', position: 'sticky', bottom: 0, zIndex: 10 }}>
            <div style={{ maxWidth: '680px', margin: '0 auto', padding: '14px 24px' }}>
              {refinementCount >= MAX_REFINEMENTS ? (
                <p style={{ textAlign: 'center', fontSize: '0.68rem', color: 'var(--color-mist)', padding: '6px 0' }}>Your itinerary is complete. Export it to save.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    <textarea ref={textareaRef} value={chatInput} onChange={e => { setChatInput(e.target.value); adjustTextarea(); }} onKeyDown={handleKeyDown} disabled={isLoading} placeholder={appStage === 'clarify' ? 'Answer the questions above...' : 'Request a refinement...'} rows={1} style={{ flex: 1, backgroundColor: 'var(--color-paper)', border: '1px solid var(--color-border)', padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--color-ink)', fontWeight: 300, resize: 'none', outline: 'none', minHeight: '42px', maxHeight: '160px', lineHeight: 1.5 }} />
                    <button onClick={sendChatMessage} disabled={isLoading || !chatInput.trim()} style={{ padding: '10px 18px', backgroundColor: 'var(--color-ink)', color: 'var(--color-paper)', fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', height: '42px', opacity: (!chatInput.trim() || isLoading) ? 0.3 : 1, fontWeight: 400 }}>Send</button>
                  </div>
                  <p style={{ fontSize: '0.58rem', color: 'var(--color-mist)', marginTop: '5px' }}>Enter to send — Shift+Enter for new line</p>
                </>
              )}
            </div>
          </div>
        )}

        {appStage === 'landing' && (
          <footer style={{ borderTop: '1px solid var(--color-border)', padding: '20px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: '0.62rem', color: 'var(--color-mist)', letterSpacing: '0.1em' }}>© {new Date().getFullYear()} RouteMethod — Travel, Engineered.</p>
          </footer>
        )}
      </div>
    </>
  );
}
