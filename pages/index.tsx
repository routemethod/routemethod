import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import ChatMessage from '../components/ChatMessage';

interface Message { role: 'user' | 'assistant'; content: string; }

const MAX_REFINEMENTS = 10;

type AppStage = 'landing' | 'input' | 'clarify' | 'itinerary';

const PACE_OPTIONS = ['Relaxed', 'Balanced', 'Packed'];
const BUDGET_OPTIONS = ['Budget', 'Mid-range', 'Luxury'];

export default function Home() {
  const [appStage, setAppStage] = useState<AppStage>('landing');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refinementCount, setRefinementCount] = useState(0);
  const [streamingContent, setStreamingContent] = useState('');
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
  }, [messages, streamingContent]);

  const buildTripSummary = () => {
    return `Here are my trip details:

Destination: ${destination}
Arrival: ${arrivalDate} at ${arrivalTime}
Departure: ${departureDate} at ${departureTime}
Hotel: ${hotelName}, ${hotelNeighborhood}
Preferred pace: ${pace}
Budget level: ${budget}

SAVED PLACES:
Must Dos: ${mustDos || 'None specified'}
Restaurants & Food: ${restaurants || 'None specified'}
Cafés: ${cafes || 'None specified'}
Bars: ${bars || 'None specified'}
Activities & Sights: ${activities || 'None specified'}
Nice to Haves: ${niceToHaves || 'None specified'}

Confirmed Reservations:
${reservations || 'None'}

Additional Notes:
${notes || 'None'}`;
  };

  const streamResponse = async (msgs: Message[], onDone: (content: string) => void) => {
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
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) { fullContent += data.text; setStreamingContent(fullContent); }
            if (data.done) { setStreamingContent(''); onDone(fullContent); }
          } catch {}
        }
      }
    }
  };

  const handleFormSubmit = async () => {
    if (!destination || !arrivalDate || !departureDate) return;
    setIsLoading(true);
    setAppStage('clarify');

    const tripSummary = buildTripSummary();
    const initialMessages: Message[] = [{ role: 'user', content: tripSummary }];

    await streamResponse(initialMessages, (content) => {
      setMessages([...initialMessages, { role: 'assistant', content }]);
      setIsLoading(false);
    });
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
          { role: 'assistant', content: "You've reached the refinement limit for this itinerary. Your final plan is ready to export." }
        ]);
        setIsLoading(false);
        return;
      }
    }

    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    await streamResponse(newMessages, (content) => {
      const updatedMessages = [...newMessages, { role: 'assistant', content }];
      setMessages(updatedMessages);
      setIsLoading(false);

      // Detect itinerary delivery
      if (content.includes('## Day') && appStage !== 'itinerary') {
        setAppStage('itinerary');
      }
    });
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

  const stageLabel = appStage === 'clarify' ? '2' : appStage === 'itinerary' ? '3' : '1';
  const stageText = appStage === 'clarify' ? 'Clarify' : appStage === 'itinerary' ? 'Your Itinerary' : 'Your Trip';

  return (
    <>
      <Head>
        <title>RouteMethod — Travel, Engineered.</title>
        <meta name="description" content="Transform your saved places into a structured, intentional travel itinerary." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-paper)' }}>

        {/* Header */}
        <header style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-cream)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => setAppStage('landing')} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', background: 'none', border: 'none', cursor: 'pointer' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 500, color: 'var(--color-ink)', letterSpacing: '0.02em' }}>RouteMethod</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-gold)', fontWeight: 400 }}>Travel, Engineered.</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <Link href="/method" style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-mist)', textDecoration: 'none', fontWeight: 400 }}>
                The Method
              </Link>
              {appStage !== 'landing' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {['1', '2', '3'].map((s) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: s === stageLabel ? 'var(--color-gold)' : 'transparent',
                        border: `1px solid ${s === stageLabel ? 'var(--color-gold)' : 'var(--color-border)'}`,
                        fontSize: '0.6rem', fontWeight: 500,
                        color: s === stageLabel ? 'white' : s < stageLabel ? 'var(--color-gold)' : 'var(--color-mist)',
                        transition: 'all 0.3s ease'
                      }}>
                        {s < stageLabel ? '✓' : s}
                      </div>
                      {s !== '3' && <div style={{ width: '16px', height: '1px', backgroundColor: s < stageLabel ? 'var(--color-gold)' : 'var(--color-border)' }} />}
                    </div>
                  ))}
                  <span style={{ fontSize: '0.62rem', color: 'var(--color-mist)', marginLeft: '6px', letterSpacing: '0.06em' }}>{stageText}</span>
                </div>
              )}
              {appStage === 'itinerary' && (
                <div style={{ fontSize: '0.62rem', color: 'var(--color-mist)', letterSpacing: '0.06em' }}>
                  <span style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-display)', fontSize: '0.9rem' }}>{refinementCount}</span>
                  <span>/{MAX_REFINEMENTS} refinements</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main */}
        <main style={{ flex: 1 }}>

          {/* LANDING */}
          {appStage === 'landing' && (
            <div>
              {/* Hero */}
              <section style={{ maxWidth: '760px', margin: '0 auto', padding: '80px 24px 64px', borderBottom: '1px solid var(--color-border)' }}>
                <div className="animate-fade-up">
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-gold)', marginBottom: '20px', fontWeight: 400 }}>
                    Structured Travel Planning
                  </p>
                  <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.4rem, 5vw, 3.6rem)', fontWeight: 400, color: 'var(--color-ink)', lineHeight: 1.15, letterSpacing: '-0.01em', marginBottom: '24px' }}>
                    Your saved places,<br />
                    <em style={{ fontStyle: 'italic', color: 'var(--color-steel)' }}>finally structured.</em>
                  </h1>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--color-mist)', lineHeight: 1.7, maxWidth: '480px', marginBottom: '40px', fontWeight: 300 }}>
                    Paste your restaurants, cafés, and experiences. RouteMethod builds a day-by-day itinerary engineered around neighborhoods, energy, and what matters most to you.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <button
                      onClick={() => setAppStage('input')}
                      style={{ padding: '14px 36px', backgroundColor: 'var(--color-ink)', color: 'var(--color-paper)', fontFamily: 'var(--font-body)', fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', fontWeight: 400, transition: 'background-color 0.2s ease' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-steel)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-ink)')}
                    >
                      Plan My Trip
                    </button>
                    <Link href="/method" style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-mist)', textDecoration: 'none' }}>
                      How it works →
                    </Link>
                  </div>
                </div>
              </section>

              {/* Methodology preview */}
              <section style={{ maxWidth: '760px', margin: '0 auto', padding: '64px 24px' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-gold)', marginBottom: '32px', fontWeight: 400 }}>The Method</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '32px' }}>
                  {[
                    { num: '01', title: 'Anchor', desc: 'Your confirmed reservations and non-negotiables form the skeleton everything else is built around.' },
                    { num: '02', title: 'Density', desc: 'We assess how many experiences can realistically fit each day without overloading it.' },
                    { num: '03', title: 'Cluster', desc: 'Experiences are grouped by neighborhood to minimize unnecessary cross-city travel.' },
                    { num: '04', title: 'Energy', desc: 'The trip arc is shaped so demanding days come early and the pace naturally winds down.' },
                    { num: '05', title: 'Friction', desc: 'Every day is stress-tested. Where problems are found, two specific alternatives are offered.' },
                  ].map((item) => (
                    <div key={item.num} style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', letterSpacing: '0.16em', color: 'var(--color-gold)', marginBottom: '8px', fontWeight: 500 }}>{item.num}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 500, color: 'var(--color-ink)', marginBottom: '8px' }}>{item.title}</div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--color-mist)', lineHeight: 1.65, fontWeight: 300 }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '40px' }}>
                  <Link href="/method" style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-mist)', textDecoration: 'none', borderBottom: '1px solid var(--color-border)', paddingBottom: '2px' }}>
                    Read the full methodology →
                  </Link>
                </div>
              </section>
            </div>
          )}

          {/* STAGE 1 — STRUCTURED INPUT */}
          {appStage === 'input' && (
            <div style={{ maxWidth: '680px', margin: '0 auto', padding: '48px 24px 120px' }} className="animate-fade-up">
              <div style={{ marginBottom: '40px' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-gold)', marginBottom: '12px' }}>Stage 1 of 3</p>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 400, color: 'var(--color-ink)', marginBottom: '8px' }}>Your Trip</h2>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--color-mist)', fontWeight: 300 }}>Fill in your details and saved places. For each place, add notes in brackets if you have them — wait times, reservation status, must-do vs nice-to-have.</p>
              </div>

              {/* Trip Details */}
              <fieldset style={{ border: 'none', marginBottom: '36px' }}>
                <legend style={{ fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-gold)', marginBottom: '16px', fontWeight: 500 }}>Trip Details</legend>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Destination city" style={inputStyle} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <input type="date" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} placeholder="Arrival date" style={inputStyle} />
                    <input type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <input type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} placeholder="Departure date" style={inputStyle} />
                    <input type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <input value={hotelName} onChange={e => setHotelName(e.target.value)} placeholder="Hotel name" style={inputStyle} />
                    <input value={hotelNeighborhood} onChange={e => setHotelNeighborhood(e.target.value)} placeholder="Hotel neighborhood" style={inputStyle} />
                  </div>
                </div>
              </fieldset>

              {/* Pace & Budget */}
              <fieldset style={{ border: 'none', marginBottom: '36px' }}>
                <legend style={{ fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-gold)', marginBottom: '16px', fontWeight: 500 }}>Preferences</legend>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--color-mist)', marginBottom: '8px', letterSpacing: '0.04em' }}>Daily Pace</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {PACE_OPTIONS.map(o => (
                        <button key={o} onClick={() => setPace(o)} style={{ ...toggleStyle, backgroundColor: pace === o ? 'var(--color-ink)' : 'transparent', color: pace === o ? 'var(--color-paper)' : 'var(--color-mist)', borderColor: pace === o ? 'var(--color-ink)' : 'var(--color-border)' }}>
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--color-mist)', marginBottom: '8px', letterSpacing: '0.04em' }}>Budget Level</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {BUDGET_OPTIONS.map(o => (
                        <button key={o} onClick={() => setBudget(o)} style={{ ...toggleStyle, backgroundColor: budget === o ? 'var(--color-ink)' : 'transparent', color: budget === o ? 'var(--color-paper)' : 'var(--color-mist)', borderColor: budget === o ? 'var(--color-ink)' : 'var(--color-border)' }}>
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Saved Places */}
              <fieldset style={{ border: 'none', marginBottom: '36px' }}>
                <legend style={{ fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-gold)', marginBottom: '4px', fontWeight: 500 }}>Saved Places</legend>
                <p style={{ fontSize: '0.72rem', color: 'var(--color-mist)', marginBottom: '16px', fontWeight: 300 }}>Add notes in brackets: e.g. Contramar [reservation confirmed, Tue 7pm] or Chapultepec [go early, gets crowded]</p>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {[
                    { label: 'Must Dos', value: mustDos, setter: setMustDos, placeholder: 'Non-negotiable experiences — the reason you are going' },
                    { label: 'Restaurants & Food', value: restaurants, setter: setRestaurants, placeholder: 'Restaurants, street food, markets...' },
                    { label: 'Cafés', value: cafes, setter: setCafes, placeholder: 'Coffee shops, bakeries...' },
                    { label: 'Bars & Nightlife', value: bars, setter: setBars, placeholder: 'Bars, mezcalerías, clubs...' },
                    { label: 'Activities & Sights', value: activities, setter: setActivities, placeholder: 'Museums, landmarks, galleries, neighborhoods...' },
                    { label: 'Nice to Haves', value: niceToHaves, setter: setNiceToHaves, placeholder: 'Lower priority — include if time allows' },
                  ].map(({ label, value, setter, placeholder }) => (
                    <div key={label}>
                      <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--color-steel)', letterSpacing: '0.06em', marginBottom: '5px', fontWeight: 400 }}>{label}</label>
                      <textarea value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} rows={2} style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} />
                    </div>
                  ))}
                </div>
              </fieldset>

              {/* Reservations */}
              <fieldset style={{ border: 'none', marginBottom: '36px' }}>
                <legend style={{ fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-gold)', marginBottom: '12px', fontWeight: 500 }}>Confirmed Reservations</legend>
                <textarea value={reservations} onChange={e => setReservations(e.target.value)} placeholder="List any confirmed reservations with date and time — e.g. Pujol, Wednesday July 9 at 8:00pm" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </fieldset>

              {/* Notes */}
              <fieldset style={{ border: 'none', marginBottom: '48px' }}>
                <legend style={{ fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-gold)', marginBottom: '12px', fontWeight: 500 }}>Additional Notes</legend>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything else — travel companion preferences, mobility considerations, things to avoid..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </fieldset>

              <button
                onClick={handleFormSubmit}
                disabled={!destination || !arrivalDate || !departureDate || isLoading}
                style={{ padding: '14px 40px', backgroundColor: 'var(--color-ink)', color: 'var(--color-paper)', fontFamily: 'var(--font-body)', fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', fontWeight: 400, opacity: (!destination || !arrivalDate || !departureDate) ? 0.4 : 1, transition: 'all 0.2s ease' }}
              >
                {isLoading ? 'Analyzing your trip...' : 'Continue to Clarify →'}
              </button>
            </div>
          )}

          {/* STAGE 2 & 3 — CHAT */}
          {(appStage === 'clarify' || appStage === 'itinerary') && (
            <div style={{ maxWidth: '680px', margin: '0 auto', padding: '40px 24px 160px' }}>
              <div style={{ marginBottom: '32px' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-gold)', marginBottom: '8px' }}>
                  Stage {appStage === 'clarify' ? '2 of 3 — Clarify' : '3 of 3 — Your Itinerary'}
                </p>
                {appStage === 'clarify' && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--color-mist)', fontWeight: 300 }}>RouteMethod has a few questions before building your itinerary.</p>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {messages.map((message, index) => (
                  <ChatMessage key={index} message={message} />
                ))}

                {streamingContent && (
                  <div className="animate-fade-in" style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flexShrink: 0, width: '2px', backgroundColor: 'var(--color-gold)', marginTop: '4px', alignSelf: 'stretch', opacity: 0.5 }} />
                    <div className="prose-chat" style={{ fontSize: '0.875rem', color: 'var(--color-steel)', lineHeight: 1.75, fontWeight: 300, flex: 1, whiteSpace: 'pre-wrap' }}>
                      {streamingContent}
                    </div>
                  </div>
                )}

                {isLoading && !streamingContent && (
                  <div className="animate-fade-in" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ flexShrink: 0, width: '2px', height: '32px', backgroundColor: 'var(--color-gold)', opacity: 0.3 }} />
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} className="animate-pulse-soft" style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-gold)', animationDelay: `${i * 0.2}s` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>
          )}
        </main>

        {/* Chat input */}
        {(appStage === 'clarify' || appStage === 'itinerary') && (
          <div style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-cream)', position: 'sticky', bottom: 0 }}>
            <div style={{ maxWidth: '680px', margin: '0 auto', padding: '16px 24px' }}>
              {refinementCount >= MAX_REFINEMENTS ? (
                <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--color-mist)', letterSpacing: '0.06em', padding: '8px 0' }}>
                  Your itinerary is complete. Export it above to save.
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    <textarea
                      ref={textareaRef}
                      value={chatInput}
                      onChange={e => { setChatInput(e.target.value); adjustTextarea(); }}
                      onKeyDown={handleKeyDown}
                      disabled={isLoading}
                      placeholder={appStage === 'clarify' ? 'Answer the questions above...' : 'Request a refinement...'}
                      rows={1}
                      style={{ flex: 1, backgroundColor: 'var(--color-paper)', border: '1px solid var(--color-border)', padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--color-ink)', fontWeight: 300, resize: 'none', outline: 'none', minHeight: '42px', maxHeight: '160px', lineHeight: 1.5 }}
                    />
                    <button
                      onClick={sendChatMessage}
                      disabled={isLoading || !chatInput.trim()}
                      style={{ padding: '10px 20px', backgroundColor: 'var(--color-ink)', color: 'var(--color-paper)', fontFamily: 'var(--font-body)', fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', fontWeight: 400, height: '42px', opacity: (!chatInput.trim() || isLoading) ? 0.3 : 1, transition: 'opacity 0.2s' }}
                    >
                      Send
                    </button>
                  </div>
                  <p style={{ fontSize: '0.6rem', color: 'var(--color-mist)', marginTop: '6px', letterSpacing: '0.04em' }}>Enter to send · Shift+Enter for new line</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        {appStage === 'landing' && (
          <footer style={{ borderTop: '1px solid var(--color-border)', padding: '24px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--color-mist)', letterSpacing: '0.1em' }}>
              © {new Date().getFullYear()} RouteMethod — Travel, Engineered.
            </p>
          </footer>
        )}
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'var(--color-cream)',
  border: '1px solid var(--color-border)',
  padding: '10px 14px',
  fontFamily: 'var(--font-body)',
  fontSize: '0.875rem',
  color: 'var(--color-ink)',
  fontWeight: 300,
  outline: 'none',
  lineHeight: 1.5,
};

const toggleStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontFamily: 'var(--font-body)',
  fontSize: '0.68rem',
  letterSpacing: '0.06em',
  border: '1px solid',
  cursor: 'pointer',
  fontWeight: 300,
  transition: 'all 0.15s ease',
};
