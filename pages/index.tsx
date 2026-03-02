import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import ChatMessage from '../components/ChatMessage';

interface Message { role: 'user' | 'assistant'; content: string; }
type AppStage = 'landing' | 'input' | 'clarify' | 'itinerary';
const MAX_REFINEMENTS = 10;
const PACE_OPTIONS = ['Relaxed', 'Balanced', 'Packed'];
const BUDGET_OPTIONS = ['Budget', 'Mid-range', 'Luxury'];

interface TripSummary {
  destination: string;
  arrival: string;
  departure: string;
  hotel: string;
  pace: string;
  budget: string;
  mustDos: string;
  restaurants: string;
  cafes: string;
  bars: string;
  activities: string;
  niceToHaves: string;
  reservations: string;
  notes: string;
}

export default function Home() {
  const [appStage, setAppStage] = useState<AppStage>('landing');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refinementCount, setRefinementCount] = useState(0);
  const [tripSummary, setTripSummary] = useState<TripSummary | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
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

    const summary: TripSummary = {
      destination, arrival: `${arrivalDate} ${arrivalTime}`, departure: `${departureDate} ${departureTime}`,
      hotel: `${hotelName}, ${hotelNeighborhood}`, pace, budget,
      mustDos, restaurants, cafes, bars, activities, niceToHaves, reservations, notes
    };
    setTripSummary(summary);

    const initialMessages: Message[] = [{ role: 'user', content: buildTripText() }];
    const content = await callAPI(initialMessages);
    setMessages([...initialMessages, { role: 'assistant', content }]);
    setIsLoading(false);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isLoading) return;
    const userMessage = chatInput.trim();
    setChatInput('');
    setIsLoading(true);

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
    const updatedMessages: Message[] = [...newMessages, { role: 'assistant', content }];
    setMessages(updatedMessages);
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
          <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 24px', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => setAppStage('landing')} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', background: 'none', border: 'none', cursor: 'pointer' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 500, color: 'var(--color-ink)' }}>RouteMethod</span>
              <span style={{ fontSize: '0.56rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 400 }}>Travel, Engineered.</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <Link href="/method" style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-mist)', textDecoration: 'none' }}>The Method</Link>
              {appStage !== 'landing' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {['1','2','3'].map((s) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: s === stageNum ? 'var(--color-accent)' : 'transparent', border: `1px solid ${s === stageNum ? 'var(--color-accent)' : s < stageNum ? 'var(--color-accent)' : 'var(--color-border)'}`, fontSize: '0.58rem', fontWeight: 500, color: s === stageNum ? 'white' : s < stageNum ? 'var(--color-accent)' : 'var(--color-mist)', transition: 'all 0.3s' }}>
                        {s < stageNum ? '✓' : s}
                      </div>
                      {s !== '3' && <div style={{ width: '14px', height: '1px', backgroundColor: s < stageNum ? 'var(--color-accent)' : 'var(--color-border)' }} />}
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
              {(appStage === 'clarify' || appStage === 'itinerary') && tripSummary && (
                <button onClick={() => setPanelOpen(!panelOpen)} title="View your submitted list" style={{ background: 'none', border: '1px solid var(--color-border)', padding: '4px 10px', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-mist)', cursor: 'pointer', display: 'none' }} className="desktop-panel-btn">
                  My List
                </button>
              )}
            </div>
          </div>
        </header>

        <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
          {/* Main content */}
          <main style={{ flex: 1 }}>

            {/* LANDING */}
            {appStage === 'landing' && (
              <div>
                <section style={{ maxWidth: '720px', margin: '0 auto', padding: '80px 24px 64px', borderBottom: '1px solid var(--color-border)' }}>
                  <div className="animate-fade-up">
                    <p style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: '20px', fontWeight: 400 }}>Structured Travel Planning</p>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', fontWeight: 400, color: 'var(--color-ink)', lineHeight: 1.15, marginBottom: '20px' }}>
                      Your saved places,<br /><em>finally structured.</em>
                    </h1>
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
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-mist)', marginBottom: '14px', fontWeight: 300 }}>Add notes in brackets: e.g. Contramar [confirmed reservation Tue 7pm] or Chapultepec [go early before crowds]</p>
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

            {/* STAGES 2 & 3 — CHAT */}
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
          {(appStage === 'clarify' || appStage === 'itinerary') && tripSummary && panelOpen && (
            <aside style={{ width: '260px', flexShrink: 0, borderLeft: '1px solid var(--color-border)', backgroundColor: 'var(--color-cream)', position: 'sticky', top: '54px', height: 'calc(100vh - 54px)', overflowY: 'auto', padding: '24px 20px', display: 'none' }} id="side-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <p style={S.sectionTitle}>Your List</p>
                <button onClick={() => setPanelOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: 'var(--color-mist)' }}>✕</button>
              </div>
              {[
                { label: 'Destination', value: tripSummary.destination },
                { label: 'Arrival', value: tripSummary.arrival },
                { label: 'Departure', value: tripSummary.departure },
                { label: 'Hotel', value: tripSummary.hotel },
                { label: 'Pace', value: tripSummary.pace },
                { label: 'Must Dos', value: tripSummary.mustDos },
                { label: 'Restaurants', value: tripSummary.restaurants },
                { label: 'Cafes', value: tripSummary.cafes },
                { label: 'Bars', value: tripSummary.bars },
                { label: 'Activities', value: tripSummary.activities },
                { label: 'Nice to Haves', value: tripSummary.niceToHaves },
                { label: 'Reservations', value: tripSummary.reservations },
                { label: 'Notes', value: tripSummary.notes },
              ].filter(item => item.value && item.value !== 'None').map(({ label, value }) => (
                <div key={label} style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--color-border-light)' }}>
                  <p style={{ fontSize: '0.58rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: '4px', fontWeight: 500 }}>{label}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-steel)', lineHeight: 1.55, fontWeight: 300 }}>{value}</p>
                </div>
              ))}
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
                    <button onClick={sendChatMessage} disabled={isLoading || !chatInput.trim()} style={{ padding: '10px 18px', backgroundColor: 'var(--color-ink)', color: 'var(--color-paper)', fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', height: '42px', opacity: (!chatInput.trim() || isLoading) ? 0.3 : 1 }}>
                      Send
                    </button>
                  </div>
                  <p style={{ fontSize: '0.58rem', color: 'var(--color-mist)', marginTop: '5px', letterSpacing: '0.04em' }}>Enter to send — Shift+Enter for new line</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        {appStage === 'landing' && (
          <footer style={{ borderTop: '1px solid var(--color-border)', padding: '20px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: '0.62rem', color: 'var(--color-mist)', letterSpacing: '0.1em' }}>© {new Date().getFullYear()} RouteMethod — Travel, Engineered.</p>
          </footer>
        )}

        {/* Desktop panel toggle — only shows on larger screens via inline media */}
        <style>{`
          @media (min-width: 900px) {
            .desktop-panel-btn { display: block !important; }
            #side-panel { display: block !important; }
          }
        `}</style>
      </div>
    </>
  );
}
