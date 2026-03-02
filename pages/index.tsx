import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import ChatMessage from '../components/ChatMessage';
import { extractDayAssignments } from '../lib/markdown';

interface Message { role: 'user' | 'assistant'; content: string; }
type AppStage = 'landing' | 'input' | 'clarify' | 'itinerary';
const MAX_REFINEMENTS = 10;
const PACE_OPTIONS = ['Relaxed', 'Balanced', 'Packed'];
const BUDGET_OPTIONS = ['Budget', 'Mid-range', 'Luxury'];

interface PlaceItem { name: string; notes?: string; day?: string; isLink?: boolean; }
interface TripData {
  destination: string;
  arrival: string;
  departure: string;
  hotel: string;
  pace: string;
  budget: string;
  mustDos: PlaceItem[];
  restaurants: PlaceItem[];
  cafes: PlaceItem[];
  bars: PlaceItem[];
  activities: PlaceItem[];
  niceToHaves: PlaceItem[];
  reservations: string[];
  notes: string;
}

function parsePlaces(raw: string): PlaceItem[] {
  if (!raw || raw === 'None') return [];
  return raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).map(s => {
    const isLink = /^https?:\/\//.test(s);
    const bracketMatch = s.match(/^([^\[]+)\[([^\]]+)\]/);
    if (bracketMatch) return { name: bracketMatch[1].trim(), notes: bracketMatch[2].trim(), isLink };
    return { name: s, isLink };
  });
}

function parseReservations(raw: string): string[] {
  if (!raw || raw === 'None') return [];
  return raw.split('\n').map(s => s.trim()).filter(Boolean);
}

export default function Home() {
  const [appStage, setAppStage] = useState<AppStage>('landing');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refinementCount, setRefinementCount] = useState(0);
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [dayAssignments, setDayAssignments] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Form state
  const [destination, setDestination] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [hotelNeighborhood, setHotelNeighborhood] = useState('');
  const [mustDos, setMustDos] = useState('');
  const [restaurants, setRestaurants] = useState('');
  const [cafes, setCafes] = useState('');
  const [bars, setBars] = useState('');
  const [activities, setActivities] = useState('');
  const [niceToHaves, setNiceToHaves] = useState('');
  const [reservations, setReservations] = useState('');
  const [pace, setPace] = useState('Balanced');
  const [budget, setBudget] = useState('Mid-range');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Update day assignments whenever itinerary messages appear
  useEffect(() => {
    const itineraryMessages = messages.filter(m => m.role === 'assistant' && m.content.includes('## Day'));
    if (itineraryMessages.length > 0) {
      const latest = itineraryMessages[itineraryMessages.length - 1];
      const assignments = extractDayAssignments(latest.content);
      setDayAssignments(assignments);
    }
  }, [messages]);

  // Check if a place name appears in day assignments
  const getDayForPlace = (placeName: string): string | undefined => {
    const lower = placeName.toLowerCase();
    for (const [key, day] of Object.entries(dayAssignments)) {
      if (lower.includes(key) || key.includes(lower)) return day;
    }
    return undefined;
  };

  const buildTripText = () => `Here are my trip details:

Destination: ${destination}
Arrival: ${arrivalDate} at ${arrivalTime}
Departure: ${departureDate} at ${departureTime}
Hotel: ${hotelName}, ${hotelNeighborhood}
Preferred pace: ${pace}
Budget level: ${budget}

SAVED PLACES:
Must Dos: ${mustDos || 'None'}
Restaurants & Food: ${restaurants || 'None'}
Cafes: ${cafes || 'None'}
Bars: ${bars || 'None'}
Activities & Sights: ${activities || 'None'}
Nice to Haves: ${niceToHaves || 'None'}

Confirmed Reservations: ${reservations || 'None'}
Additional Notes: ${notes || 'None'}`;

  const callAPI = async (msgs: Message[]): Promise<string> => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs }),
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

    const td: TripData = {
      destination,
      arrival: `${arrivalDate}${arrivalTime ? ' at ' + arrivalTime : ''}`,
      departure: `${departureDate}${departureTime ? ' at ' + departureTime : ''}`,
      hotel: `${hotelName}${hotelNeighborhood ? ', ' + hotelNeighborhood : ''}`,
      pace, budget,
      mustDos: parsePlaces(mustDos),
      restaurants: parsePlaces(restaurants),
      cafes: parsePlaces(cafes),
      bars: parsePlaces(bars),
      activities: parsePlaces(activities),
      niceToHaves: parsePlaces(niceToHaves),
      reservations: parseReservations(reservations),
      notes,
    };
    setTripData(td);

    const initialMessages: Message[] = [{ role: 'user', content: buildTripText() }];
    const content = await callAPI(initialMessages);
    setMessages([...initialMessages, { role: 'assistant', content }]);
    setIsLoading(false);
  };

  // Update trip data when user clarifies something in chat
  const updateTripDataFromChat = (userMessage: string) => {
    if (!tripData) return;
    const updated = { ...tripData };

    // Date updates
    const arrivalMatch = userMessage.match(/arrival.*?(\w+ \d+|\d+\/\d+)/i);
    const departureMatch = userMessage.match(/departure.*?(\w+ \d+|\d+\/\d+)/i);
    if (arrivalMatch) updated.arrival = arrivalMatch[1];
    if (departureMatch) updated.departure = departureMatch[1];

    // Link clarifications — if user explains what a link was
    const linkClarification = userMessage.match(/(?:that link|the link|it) (?:is|was) ([^,\.\n]+)/i);
    if (linkClarification) {
      const clarifiedName = linkClarification[1].trim();
      // Replace any isLink item that hasn't been named yet
      ['mustDos', 'restaurants', 'cafes', 'bars', 'activities', 'niceToHaves'].forEach(key => {
        const arr = updated[key as keyof TripData] as PlaceItem[];
        const idx = arr.findIndex((p: PlaceItem) => p.isLink && p.name.startsWith('http'));
        if (idx > -1) arr[idx] = { ...arr[idx], name: clarifiedName, isLink: false };
      });
    }

    setTripData(updated);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isLoading) return;
    const userMessage = chatInput.trim();
    setChatInput('');
    setIsLoading(true);

    updateTripDataFromChat(userMessage);

    const isRefinement = appStage === 'itinerary';
    if (isRefinement) {
      const newCount = refinementCount + 1;
      setRefinementCount(newCount);
      if (newCount > MAX_REFINEMENTS) {
        setMessages(prev => [...prev,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: "You have reached the refinement limit for this itinerary. Your final plan is ready to export." }
        ]);
        setIsLoading(false);
        return;
      }
    }

    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    const content = await callAPI(newMessages);
    const updated: Message[] = [...newMessages, { role: 'assistant', content }];
    setMessages(updated);
    setIsLoading(false);

    if (content.includes('## Day') && appStage !== 'itinerary') {
      setAppStage('itinerary');
    }
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
  const stageText = appStage === 'clarify' ? 'Clarify' : appStage === 'itinerary' ? 'Itinerary' : 'Input';

  const S = {
    input: { width: '100%', backgroundColor: 'var(--color-cream)', border: '1px solid var(--color-border)', padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--color-ink)', fontWeight: 300, outline: 'none', lineHeight: 1.5 } as React.CSSProperties,
    toggle: { padding: '6px 12px', fontFamily: 'var(--font-body)', fontSize: '0.68rem', letterSpacing: '0.06em', border: '1px solid', cursor: 'pointer', fontWeight: 300, transition: 'all 0.15s ease' } as React.CSSProperties,
    label: { display: 'block', fontSize: '0.68rem', color: 'var(--color-steel)', letterSpacing: '0.06em', marginBottom: '5px', fontWeight: 400 } as React.CSSProperties,
    sectionTitle: { fontFamily: 'var(--font-body)', fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--color-accent)', marginBottom: '14px', fontWeight: 500 },
  };

  // Panel place list renderer
  const renderPlaceList = (items: PlaceItem[], label: string) => {
    if (!items || items.length === 0) return null;
    return (
      <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--color-border-light)' }}>
        <p style={{ fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: '6px', fontWeight: 500 }}>{label}</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((item, i) => {
            const dayTag = getDayForPlace(item.name);
            return (
              <li key={i} style={{ fontSize: '0.78rem', color: 'var(--color-steel)', lineHeight: 1.55, fontWeight: 300, paddingLeft: '0.9rem', position: 'relative', marginBottom: '4px' }}>
                <span style={{ position: 'absolute', left: 0, color: 'var(--color-accent)', fontSize: '0.7rem' }}>—</span>
                <span>{item.isLink ? <em style={{ color: 'var(--color-mist)', fontStyle: 'italic' }}>Link — pending clarification</em> : item.name}</span>
                {item.notes && <span style={{ color: 'var(--color-mist)', fontSize: '0.72rem' }}> [{item.notes}]</span>}
                {dayTag && <span style={{ marginLeft: '6px', fontSize: '0.62rem', color: 'var(--color-accent)', fontWeight: 500, letterSpacing: '0.04em' }}>{dayTag}</span>}
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

        {/* Header */}
        <header style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-cream)', position: 'sticky', top: 0, zIndex: 20 }}>
          <div style={{ maxWidth: panelOpen ? '100%' : '760px', margin: '0 auto', padding: '0 24px', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => setAppStage('landing')} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', background: 'none', border: 'none', cursor: 'pointer' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 500, color: 'var(--color-ink)' }}>RouteMethod</span>
              <span style={{ fontSize: '0.56rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 400 }}>Travel, Engineered.</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
              <Link href="/method" style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-mist)', textDecoration: 'none' }}>The Method</Link>
              {appStage !== 'landing' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {['1','2','3'].map((s) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: s === stageNum ? 'var(--color-accent)' : 'transparent', border: `1px solid ${s === stageNum ? 'var(--color-accent)' : s < stageNum ? 'var(--color-accent)' : 'var(--color-border)'}`, fontSize: '0.58rem', fontWeight: 500, color: s === stageNum ? 'white' : s < stageNum ? 'var(--color-accent)' : 'var(--color-mist)', transition: 'all 0.3s' }}>
                        {s < stageNum ? '✓' : s}
                      </div>
                      {s !== '3' && <div style={{ width: '12px', height: '1px', backgroundColor: s < stageNum ? 'var(--color-accent)' : 'var(--color-border)' }} />}
                    </div>
                  ))}
                  <span style={{ fontSize: '0.6rem', color: 'var(--color-mist)', marginLeft: '4px' }}>{stageText}</span>
                </div>
              )}
              {appStage === 'itinerary' && (
                <span style={{ fontSize: '0.62rem', color: 'var(--color-mist)' }}>
                  <span style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-display)', fontSize: '0.9rem' }}>{refinementCount}</span>/{MAX_REFINEMENTS}
                </span>
              )}
              {(appStage === 'clarify' || appStage === 'itinerary') && tripData && (
                <button onClick={() => setPanelOpen(!panelOpen)} style={{ background: 'none', border: '1px solid var(--color-border)', padding: '4px 10px', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: panelOpen ? 'var(--color-accent)' : 'var(--color-mist)', cursor: 'pointer', borderColor: panelOpen ? 'var(--color-accent)' : 'var(--color-border)', transition: 'all 0.2s', fontFamily: 'var(--font-body)' }}>
                  My List
                </button>
              )}
            </div>
          </div>
        </header>

        <div style={{ flex: 1, display: 'flex' }}>
          {/* Main content */}
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
                    <p style={{ fontSize: '0.72rem', letterSpacing: '0.08em', color: 'var(--color-accent)', marginBottom: '20px', fontWeight: 400 }}>Guided by AI. Structured by method.</p>
                    <p style={{ fontSize: '0.95rem', color: 'var(--color-mist)', lineHeight: 1.75, maxWidth: '460px', marginBottom: '36px', fontWeight: 300 }}>
                      Paste your restaurants, cafes, and experiences. RouteMethod builds a day-by-day itinerary engineered around neighborhoods, energy, and what matters most to you.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                      <button onClick={() => setAppStage('input')} style={{ padding: '13px 34px', backgroundColor: 'var(--color-ink)', color: 'var(--color-paper)', fontFamily: 'var(--font-body)', fontSize: '0.68rem', letterSpacing: '0.14em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', fontWeight: 400 }}>
                        Plan My Trip
                      </button>
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
                    ].map((item) => (
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
              <div style={{ maxWidth: '640px', margin: '0 auto', padding: '44px 24px 120px' }} className="animate-fade-up">
                <div style={{ marginBottom: '36px' }}>
                  <p style={{ ...S.sectionTitle, marginBottom: '10px' }}>Stage 1 of 3</p>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 400, color: 'var(--color-ink)', marginBottom: '8px' }}>Your Trip</h2>
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-mist)', fontWeight: 300 }}>Fill in your details and saved places. Add notes in brackets where you have them — e.g. Contramar [reservation Tue 7pm] or Chapultepec [go early, gets crowded].</p>
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <input value={hotelName} onChange={e => setHotelName(e.target.value)} placeholder="Hotel name" style={S.input} />
                      <input value={hotelNeighborhood} onChange={e => setHotelNeighborhood(e.target.value)} placeholder="Hotel neighborhood" style={S.input} />
                    </div>
                  </div>
                </fieldset>

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
                        {BUDGET_OPTIONS.map(o => (
                          <button key={o} onClick={() => setBudget(o)} style={{ ...S.toggle, backgroundColor: budget === o ? 'var(--color-ink)' : 'transparent', color: budget === o ? 'var(--color-paper)' : 'var(--color-mist)', borderColor: budget === o ? 'var(--color-ink)' : 'var(--color-border)' }}>{o}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </fieldset>

                <fieldset style={{ border: 'none', marginBottom: '32px' }}>
                  <legend style={S.sectionTitle}>Saved Places</legend>
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-mist)', marginBottom: '14px', fontWeight: 300 }}>Add notes in brackets: e.g. Contramar [confirmed Tue 7pm] or Chapultepec [go early]</p>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {[
                      { label: 'Must Dos', value: mustDos, setter: setMustDos, placeholder: 'Non-negotiable experiences' },
                      { label: 'Restaurants & Food', value: restaurants, setter: setRestaurants, placeholder: 'Restaurants, street food, markets...' },
                      { label: 'Cafes', value: cafes, setter: setCafes, placeholder: 'Coffee shops, bakeries...' },
                      { label: 'Bars & Nightlife', value: bars, setter: setBars, placeholder: 'Bars, mezcalerias, clubs...' },
                      { label: 'Activities & Sights', value: activities, setter: setActivities, placeholder: 'Museums, landmarks, galleries...' },
                      { label: 'Nice to Haves', value: niceToHaves, setter: setNiceToHaves, placeholder: 'Lower priority — include if time allows' },
                    ].map(({ label, value, setter, placeholder }) => (
                      <div key={label}>
                        <label style={S.label}>{label}</label>
                        <textarea value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} rows={2} style={{ ...S.input, resize: 'vertical', minHeight: '56px' }} />
                      </div>
                    ))}
                  </div>
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
                <div style={{ marginBottom: '28px' }}>
                  <p style={{ ...S.sectionTitle, marginBottom: '6px' }}>Stage {appStage === 'clarify' ? '2 of 3 — Clarify' : '3 of 3 — Your Itinerary'}</p>
                  {appStage === 'clarify' && <p style={{ fontSize: '0.8rem', color: 'var(--color-mist)', fontWeight: 300 }}>RouteMethod has a few questions before building your itinerary.</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {messages.map((message, index) => (
                    <ChatMessage key={index} message={message} />
                  ))}
                  {isLoading && (
                    <div className="animate-fade-in" style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 0' }}>
                      <div style={{ width: '2px', height: '28px', backgroundColor: 'var(--color-accent)', opacity: 0.3, flexShrink: 0 }} />
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {[0,1,2].map(i => (
                          <div key={i} className="animate-pulse-soft" style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-accent)', animationDelay: `${i * 0.2}s` }} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              </div>
            )}
          </main>

          {/* DESKTOP SIDE PANEL */}
          {(appStage === 'clarify' || appStage === 'itinerary') && tripData && panelOpen && (
            <aside style={{ width: '240px', flexShrink: 0, borderLeft: '1px solid var(--color-border)', backgroundColor: 'var(--color-cream)', position: 'sticky', top: '54px', height: 'calc(100vh - 54px)', overflowY: 'auto', padding: '20px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <p style={{ ...S.sectionTitle, marginBottom: 0 }}>My List</p>
                <button onClick={() => setPanelOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-mist)', lineHeight: 1 }}>✕</button>
              </div>

              {/* Trip basics */}
              <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--color-border-light)' }}>
                <p style={{ fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: '6px', fontWeight: 500 }}>Trip</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {[
                    { label: 'Destination', value: tripData.destination },
                    { label: 'Arrival', value: tripData.arrival },
                    { label: 'Departure', value: tripData.departure },
                    { label: 'Hotel', value: tripData.hotel },
                    { label: 'Pace', value: tripData.pace },
                    { label: 'Budget', value: tripData.budget },
                  ].filter(i => i.value).map(({ label, value }) => (
                    <li key={label} style={{ fontSize: '0.75rem', color: 'var(--color-steel)', lineHeight: 1.5, fontWeight: 300, marginBottom: '3px' }}>
                      <span style={{ color: 'var(--color-mist)', fontSize: '0.68rem' }}>{label}: </span>{value}
                    </li>
                  ))}
                </ul>
              </div>

              {renderPlaceList(tripData.mustDos, 'Must Dos')}
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
                        <span style={{ position: 'absolute', left: 0, color: 'var(--color-accent)', fontSize: '0.7rem' }}>—</span>
                        {r}
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

        {/* Chat input */}
        {(appStage === 'clarify' || appStage === 'itinerary') && (
          <div style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-cream)', position: 'sticky', bottom: 0, zIndex: 10 }}>
            <div style={{ maxWidth: '680px', margin: '0 auto', padding: '14px 24px' }}>
              {refinementCount >= MAX_REFINEMENTS ? (
                <p style={{ textAlign: 'center', fontSize: '0.68rem', color: 'var(--color-mist)', letterSpacing: '0.06em', padding: '6px 0' }}>Your itinerary is complete. Export it to save.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    <textarea ref={textareaRef} value={chatInput} onChange={e => { setChatInput(e.target.value); adjustTextarea(); }} onKeyDown={handleKeyDown} disabled={isLoading} placeholder={appStage === 'clarify' ? 'Answer the questions above...' : 'Request a refinement...'} rows={1} style={{ flex: 1, backgroundColor: 'var(--color-paper)', border: '1px solid var(--color-border)', padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--color-ink)', fontWeight: 300, resize: 'none', outline: 'none', minHeight: '42px', maxHeight: '160px', lineHeight: 1.5 }} />
                    <button onClick={sendChatMessage} disabled={isLoading || !chatInput.trim()} style={{ padding: '10px 18px', backgroundColor: 'var(--color-ink)', color: 'var(--color-paper)', fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', height: '42px', opacity: (!chatInput.trim() || isLoading) ? 0.3 : 1, fontWeight: 400 }}>
                      Send
                    </button>
                  </div>
                  <p style={{ fontSize: '0.58rem', color: 'var(--color-mist)', marginTop: '5px', letterSpacing: '0.04em' }}>Enter to send — Shift+Enter for new line</p>
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

        <style>{`
          @media (max-width: 899px) {
            aside { display: none !important; }
          }
        `}</style>
      </div>
    </>
  );
}
