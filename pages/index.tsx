import { useState, useRef, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import ChatMessage from '../components/ChatMessage';
import { extractDayAssignments } from '../lib/markdown';

interface Message { role: 'user' | 'assistant'; content: string; }
type AppStage = 'landing' | 'input' | 'clarify' | 'itinerary';
const MAX_REFINEMENTS = 8;
const PACE_OPTIONS = ['Relaxed', 'Balanced', 'Packed'];
const BUDGET_OPTIONS = ['Budget', 'Mid-range', 'Luxury'];

// A single row in a place category — now includes reservation field
interface PlaceRow { name: string; reservation: string; notes: string; nonNegotiable: boolean; }
// Pending panel change proposed by AI
interface PendingChange {
  id: string;
  type: 'add' | 'remove' | 'resolve-url';
  category: 'restaurants' | 'cafes' | 'bars' | 'activities' | 'niceToHaves';
  item: PlaceItem;
  originalUrl?: string; // for resolve-url type
}
interface HotelRow { name: string; neighborhood: string; }
interface PlaceItem { name: string; reservation?: string; notes?: string; nonNegotiable?: boolean; isLink?: boolean; pending?: 'add' | 'remove'; }
interface TripData {
  destination: string; arrival: string; departure: string;
  hotels: HotelRow[];
  pace: string; budget: string[];
  restaurants: PlaceItem[]; cafes: PlaceItem[];
  bars: PlaceItem[]; activities: PlaceItem[]; niceToHaves: PlaceItem[];
  notes: string;
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
  return Array.from({ length: n }, () => ({ name: '', reservation: '', notes: '', nonNegotiable: false }));
}

function countItineraryDays(text: string): number {
  return (text.match(/## Day/g) || []).length;
}

function calcRequiredDayCount(arrivalDate: string, departureDate: string): number {
  if (!arrivalDate || !departureDate) return 1;
  const a = new Date(arrivalDate);
  const d = new Date(departureDate);
  const diff = Math.round((d.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

const MONTHS: Record<string, number> = {
  jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11,
  january:0,february:1,march:2,april:3,june:5,july:6,august:7,september:8,october:9,november:10,december:11
};
const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function normalizeReservation(input: string): string {
  if (!input.trim()) return input;
  // Try to parse a date and time from freeform text
  // Supported patterns: "Mar 4 at 8pm", "March 4 8:00pm", "3/4 8pm", "3/4/2025 20:00", "Feb 20 at 5:15pm"
  const s = input.trim();

  // Try native Date parse on common formats first
  let date: Date | null = null;

  // Pattern: month-name day at? time — "March 4 at 8pm", "Mar 4 8:00pm"
  const namedMatch = s.match(/([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (namedMatch) {
    const mon = MONTHS[namedMatch[1].toLowerCase()];
    if (mon !== undefined) {
      const day = parseInt(namedMatch[2]);
      let hour = parseInt(namedMatch[3]);
      const min = parseInt(namedMatch[4] || '0');
      const ampm = (namedMatch[5] || '').toLowerCase();
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      date = new Date(2025, mon, day, hour, min);
    }
  }

  // Pattern: m/d or m/d/yyyy at? time — "3/4 8pm", "3/4/2025 20:00"
  if (!date) {
    const slashMatch = s.match(/(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\s*(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (slashMatch) {
      const mon = parseInt(slashMatch[1]) - 1;
      const day = parseInt(slashMatch[2]);
      let hour = parseInt(slashMatch[3]);
      const min = parseInt(slashMatch[4] || '0');
      const ampm = (slashMatch[5] || '').toLowerCase();
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      // Handle 24h: if no ampm and hour > 12, it's already 24h
      date = new Date(2025, mon, day, hour, min);
    }
  }

  if (!date || isNaN(date.getTime())) return input; // can't parse — leave as-is

  const mon = MONTH_ABBR[date.getMonth()];
  const day = date.getDate();
  let hour = date.getHours();
  const min = date.getMinutes();
  const ampm = hour >= 12 ? 'pm' : 'am';
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  const minStr = min === 0 ? '00' : min < 10 ? `0${min}` : `${min}`;
  return `${mon} ${day} at ${hour}:${minStr}${ampm}`;
}

function formatFlightTime(date: string, time: string): string {
  if (!date) return '';
  const [, month, day] = date.split('-').map(Number);
  const mon = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][month - 1] || '';
  if (!time) return `${mon} ${day}`;
  const [hRaw, min] = time.split(':').map(Number);
  const ampm = hRaw >= 12 ? 'pm' : 'am';
  const h = hRaw > 12 ? hRaw - 12 : hRaw === 0 ? 12 : hRaw;
  const minStr = min === 0 ? '00' : min < 10 ? `0${min}` : `${min}`;
  return `${mon} ${day} at ${h}:${minStr}${ampm}`;
}

function useAutoExpand(rows: PlaceRow[], setRows: (r: PlaceRow[]) => void) {
  useEffect(() => {
    const last = rows[rows.length - 1];
    if (last && (last.name.trim() || last.reservation.trim() || last.notes.trim())) {
      setRows([...rows, { name: '', reservation: '', notes: '', nonNegotiable: false }]);
    }
  }, [rows, setRows]);
}

// Place category with 4 columns: Name | Reservation (text + calendar icon) | Notes | ★
function PlaceCategory({
  label, rows, setRows, notesPlaceholder,
}: {
  label: string; rows: PlaceRow[]; setRows: (r: PlaceRow[]) => void; notesPlaceholder?: string;
}) {
  useAutoExpand(rows, setRows);
  const reservationRefs = useRef<(HTMLInputElement | null)[]>([]);

  const update = (i: number, field: keyof PlaceRow, value: string | boolean) => {
    setRows(rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };

  const openDatePicker = (i: number) => {
    // Create a temporary invisible datetime-local input to trigger native picker
    const tmp = document.createElement('input');
    tmp.type = 'datetime-local';
    tmp.style.position = 'fixed';
    tmp.style.opacity = '0';
    tmp.style.pointerEvents = 'none';
    document.body.appendChild(tmp);
    tmp.addEventListener('change', () => {
      if (tmp.value) {
        const dt = new Date(tmp.value);
        const mon = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][dt.getMonth()];
        const day = dt.getDate();
        let hour = dt.getHours();
        const min = dt.getMinutes();
        const ampm = hour >= 12 ? 'pm' : 'am';
        if (hour > 12) hour -= 12;
        if (hour === 0) hour = 12;
        const minStr = min === 0 ? '00' : min < 10 ? `0${min}` : `${min}`;
        update(i, 'reservation', `${mon} ${day} at ${hour}:${minStr}${ampm}`);
      }
      document.body.removeChild(tmp);
    });
    tmp.showPicker?.();
    if (!tmp.showPicker) tmp.click();
  };

  const borderL = '1px solid var(--color-border-light)';
  const cellStyle = (extraLeft = false, extraRight = false): React.CSSProperties => ({
    backgroundColor: 'var(--color-cream)',
    border: '1px solid var(--color-border)',
    borderTop: 'none',
    borderRight: extraRight ? '1px solid var(--color-border)' : 'none',
    borderLeft: extraLeft ? borderL : 'none',
    padding: '7px 10px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: 'var(--color-ink)',
    fontWeight: 300,
    outline: 'none',
    lineHeight: 1.5,
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box' as const,
  });

  const headerCell = (extraLeft = false): React.CSSProperties => ({
    padding: '4px 10px',
    fontSize: '0.55rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-mist)',
    borderBottom: borderL,
    borderLeft: extraLeft ? borderL : undefined,
  });

  return (
    <div style={{ marginBottom: '20px' }}>
      <p style={{ fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: '8px', fontWeight: 500 }}>{label}</p>
      <div style={{ border: '1px solid var(--color-border)', borderBottom: 'none' }}>
        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 2fr 2fr 28px', borderBottom: borderL }}>
          <div style={headerCell()}>Place</div>
          <div style={headerCell(true)}>Reservation</div>
          <div style={headerCell(true)}>Notes</div>
          <div style={{ ...headerCell(true), textAlign: 'center', padding: '4px 6px' }}>★</div>
        </div>
        {/* Rows */}
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.5fr 2fr 2fr 28px', borderBottom: borderL }}>
            {/* Name */}
            <input
              value={row.name}
              onChange={e => update(i, 'name', e.target.value)}
              placeholder="Place name"
              style={cellStyle()}
            />
            {/* Reservation — text input + calendar icon */}
            <div style={{ position: 'relative', display: 'flex', borderLeft: borderL }}>
              <input
                ref={el => { reservationRefs.current[i] = el; }}
                value={row.reservation}
                onChange={e => update(i, 'reservation', e.target.value)}
                placeholder="e.g. Tue Mar 4 at 8pm"
                style={{ ...cellStyle(), borderLeft: 'none', borderRight: 'none', paddingRight: '28px', flex: 1 }}
              />
              <button
                type="button"
                onClick={() => openDatePicker(i)}
                title="Pick date & time"
                style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--color-mist)', display: 'flex', alignItems: 'center' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </button>
            </div>
            {/* Notes */}
            <input
              value={row.notes}
              onChange={e => update(i, 'notes', e.target.value)}
              placeholder={notesPlaceholder || 'Neighborhood, wait time...'}
              style={cellStyle(true)}
            />
            {/* Star */}
            <div
              onClick={() => update(i, 'nonNegotiable', !row.nonNegotiable)}
              title="Non-negotiable"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderLeft: borderL, backgroundColor: row.nonNegotiable ? 'var(--color-accent)' : 'transparent', transition: 'background 0.15s' }}
            >
              <span style={{ fontSize: '0.65rem', color: row.nonNegotiable ? 'white' : 'var(--color-border)', userSelect: 'none' }}>★</span>
            </div>
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

  const borderL = '1px solid var(--color-border-light)';

  return (
    <div style={{ marginBottom: '24px' }}>
      <p style={{ fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: '8px', fontWeight: 500 }}>Hotel</p>
      <div style={{ border: '1px solid var(--color-border)', borderBottom: 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', borderBottom: borderL }}>
          <div style={{ padding: '4px 10px', fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--color-mist)' }}>Hotel Name</div>
          <div style={{ padding: '4px 10px', fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--color-mist)', borderLeft: borderL }}>Neighborhood</div>
        </div>
        {hotels.map((h, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', borderBottom: borderL }}>
            <input value={h.name} onChange={e => update(i, 'name', e.target.value)} placeholder="Hotel name" style={{ backgroundColor: 'var(--color-cream)', border: 'none', padding: '7px 10px', fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--color-ink)', fontWeight: 300, outline: 'none', width: '100%', boxSizing: 'border-box' as const }} />
            <input value={h.neighborhood} onChange={e => update(i, 'neighborhood', e.target.value)} placeholder="Neighborhood" style={{ backgroundColor: 'var(--color-cream)', borderLeft: borderL, borderTop: 'none', borderRight: 'none', borderBottom: 'none', padding: '7px 10px', fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--color-ink)', fontWeight: 300, outline: 'none', width: '100%', boxSizing: 'border-box' as const }} />
          </div>
        ))}
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
  const [hasFullItinerary, setHasFullItinerary] = useState(false);
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [dayAssignments, setDayAssignments] = useState<Record<string, string>>({});
  const [fullItineraryContent, setFullItineraryContent] = useState<string>('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<Message[]>([]);

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
      // Safety net: if a full itinerary exists in history but stage never advanced, fix it now
      const dayCount = countItineraryDays(latest.content);
      const hasCityHeader = latest.content.trimStart().startsWith('# ') || latest.content.includes('\n# ');
      const requiredDays = calcRequiredDayCount(arrivalDate, departureDate);
      if (!hasFullItinerary && hasCityHeader && dayCount >= requiredDays) {
        setHasFullItinerary(true);
        setAppStage('itinerary');
      }
    }
  }, [messages]);

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
    rows.filter(r => r.name.trim()).map(r => {
      const name = r.name.trim();
      const isLink = name.startsWith('http://') || name.startsWith('https://');
      return {
        name,
        isLink,
        reservation: r.reservation.trim() || undefined,
        notes: r.notes.trim() || undefined,
        nonNegotiable: r.nonNegotiable,
      };
    });

  const formatPlacesForAI = (items: PlaceItem[]): string => {
    if (items.length === 0) return 'None';
    return items.map(p => {
      let s = p.name;
      if (p.reservation) s += ` [reservation: ${p.reservation}]`;
      if (p.notes) s += ` [${p.notes}]`;
      if (p.nonNegotiable) s += ' [NON-NEGOTIABLE]';
      return s;
    }).join('\n');
  };

  const buildTripText = () => {
    const hotelText = hotels.filter(h => h.name.trim()).map(h => `${h.name}${h.neighborhood ? ', ' + h.neighborhood : ''}`).join(' / ') || 'None';
    const arrivalFormatted = formatFlightTime(arrivalDate, arrivalTime);
    const departureFormatted = formatFlightTime(departureDate, departureTime);

    return `Here are my trip details:

Destination: ${destination}
Flight Arrival Time: ${arrivalFormatted}
Flight Departure Time: ${departureFormatted}
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

Additional Notes: ${notes || 'None'}`;
  };

  const callAPI = async (msgs: Message[], refinementsUsed?: number, currentStage?: string, currentTripData?: TripData | null): Promise<string> => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: msgs,
        appStage: currentStage,
        refinementsUsed,
        maxRefinements: MAX_REFINEMENTS,
        tripData: currentTripData,
      }),
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

  const PLACE_CATS: Array<keyof Pick<TripData, 'restaurants'|'cafes'|'bars'|'activities'|'niceToHaves'>> = ['restaurants','cafes','bars','activities','niceToHaves'];

  // Parse AI response for list changes and URL resolutions
  const parseAIChanges = (aiContent: string, currentTripData: TripData | null): PendingChange[] => {
    if (!currentTripData) return [];
    const changes: PendingChange[] = [];
    let m: RegExpExecArray | null;

    // REMOVED: [place name]
    const removedRe = /^REMOVED:\s*(.+)$/gim;
    while ((m = removedRe.exec(aiContent)) !== null) {
      const name = m[1].trim();
      for (const cat of PLACE_CATS) {
        const found = currentTripData[cat].find(p => p.name.toLowerCase() === name.toLowerCase());
        if (found) {
          changes.push({ id: `remove-${Date.now()}-${Math.random()}`, type: 'remove', category: cat, item: { name: found.name } });
          break;
        }
      }
    }

    // ADDED: [category] | [place name]
    const addedRe = /^ADDED:\s*(\w+)\s*\|\s*(.+)$/gim;
    while ((m = addedRe.exec(aiContent)) !== null) {
      const cat = m[1].trim().toLowerCase() as PendingChange['category'];
      if ((PLACE_CATS as string[]).includes(cat)) {
        changes.push({ id: `add-${Date.now()}-${Math.random()}`, type: 'add', category: cat, item: { name: m[2].trim() } });
      }
    }

    // RESOLVED_URL: [url] → [Place Name]
    const resolvedRe = /^RESOLVED_URL:\s*(https?:\/\/\S+)\s*→\s*(.+)$/gim;
    while ((m = resolvedRe.exec(aiContent)) !== null) {
      const originalUrl = m[1].trim();
      const resolvedName = m[2].trim();
      for (const cat of PLACE_CATS) {
        // Exact URL match first, then isLink fallback
        const found = currentTripData[cat].find(p => p.name === originalUrl)
          || currentTripData[cat].find(p => p.isLink && p.name.startsWith('http') && p.name === originalUrl);
        if (found) {
          changes.push({ id: `resolve-${Date.now()}-${Math.random()}`, type: 'resolve-url', category: cat, item: { ...found, name: resolvedName, isLink: false }, originalUrl: found.name });
          break;
        }
      }
    }

    return changes;
  };

  const applyChange = (change: PendingChange, td: TripData): TripData => {
    const updated = { ...td, [change.category]: [...td[change.category]] };
    if (change.type === 'add') {
      updated[change.category] = [...updated[change.category], change.item];
    } else if (change.type === 'remove') {
      updated[change.category] = updated[change.category].filter(p => p.name.toLowerCase() !== change.item.name.toLowerCase());
    } else if (change.type === 'resolve-url') {
      updated[change.category] = updated[change.category].map(p =>
        p.name === change.originalUrl ? { ...p, name: change.item.name, isLink: false } : p
      );
    }
    return updated;
  };

  const confirmChange = (change: PendingChange) => {
    if (!tripData) return;
    setTripData(applyChange(change, tripData));
    setPendingChanges(prev => prev.filter(c => c.id !== change.id));
  };

  const rejectChange = (id: string) => {
    setPendingChanges(prev => prev.filter(c => c.id !== id));
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
      arrival: formatFlightTime(arrivalDate, arrivalTime),
      departure: formatFlightTime(departureDate, departureTime),
      hotels: hotelList,
      pace, budget,
      restaurants: rowsToItems(restaurants),
      cafes: rowsToItems(cafes),
      bars: rowsToItems(bars),
      activities: rowsToItems(activities),
      niceToHaves: rowsToItems(niceToHaves),
      notes,
    };
    setTripData(td);

    const initialMessages: Message[] = [{ role: 'user', content: buildTripText() }];
    const content = await callAPI(initialMessages, 0, 'clarify', td);
    stopLoadingPhases();
    const finalMessages: Message[] = [...initialMessages, { role: 'assistant' as const, content }];
    messagesRef.current = finalMessages;
    setMessages(finalMessages);
    const newChanges = parseAIChanges(content, td);
    if (newChanges.length > 0) {
      // REMOVED and RESOLVED_URL apply immediately; ADDED goes to pending for user confirmation
      let latestTripData = td;
      const pendingAdds: PendingChange[] = [];
      for (const change of newChanges) {
        if (change.type === 'remove' || change.type === 'resolve-url') {
          latestTripData = applyChange(change, latestTripData);
        } else {
          pendingAdds.push(change);
        }
      }
      setTripData(latestTripData);
      if (pendingAdds.length > 0) setPendingChanges(prev => [...prev, ...pendingAdds]);
    }
    setIsLoading(false);
  };

  const updateTripDataFromChat = (userMessage: string): TripData | null => {
    if (!tripData) return null;
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
    return updated;
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isLoading) return;
    const userMessage = chatInput.trim();
    setChatInput('');
    setIsLoading(true);

    const isRefinement = appStage === 'itinerary' && hasFullItinerary;
    const currentCount = refinementCount;

    if (hasFullItinerary && currentCount >= MAX_REFINEMENTS) {
      setMessages(prev => [...prev,
        { role: 'user', content: userMessage },
        { role: 'assistant' as const, content: "You have reached the refinement limit for this itinerary. Your final plan is ready to export." }
      ]);
      setIsLoading(false);
      return;
    }

    if (isRefinement) startLoadingPhases();

    const updatedTripData = updateTripDataFromChat(userMessage) ?? tripData;
    if (updatedTripData) setTripData(updatedTripData);

    let requiredDayCount: number;
    if (updatedTripData?.arrival && updatedTripData?.departure) {
      const aMatch = updatedTripData.arrival.match(/(\d{4}-\d{2}-\d{2})/);
      const dMatch = updatedTripData.departure.match(/(\d{4}-\d{2}-\d{2})/);
      requiredDayCount = (aMatch && dMatch)
        ? calcRequiredDayCount(aMatch[1], dMatch[1])
        : calcRequiredDayCount(arrivalDate, departureDate);
    } else {
      requiredDayCount = calcRequiredDayCount(arrivalDate, departureDate);
    }

    const newMessages: Message[] = [...messagesRef.current, { role: 'user', content: userMessage }];
    messagesRef.current = newMessages;
    setMessages(newMessages);

    const effectiveStage = hasFullItinerary ? 'itinerary' : appStage;
    const content = await callAPI(newMessages, currentCount, effectiveStage, updatedTripData);
    stopLoadingPhases();
    const withReply: Message[] = [...newMessages, { role: 'assistant' as const, content }];
    messagesRef.current = withReply;
    setMessages(withReply);
    setIsLoading(false);

    const dayCount = countItineraryDays(content);
    const hasCityHeader = content.trimStart().startsWith('# ') || content.includes('\n# ');
    const looksLikeFullItinerary = hasCityHeader && dayCount >= requiredDayCount;
    if (!hasFullItinerary && looksLikeFullItinerary) {
      setAppStage('itinerary');
      setHasFullItinerary(true);
    }

    const refinementConfirm = content.match(/Refinement\s+(\d+)\s+of\s+8\s+applied/i);
    if (refinementConfirm) setRefinementCount(parseInt(refinementConfirm[1], 10));

    const newChanges = parseAIChanges(content, updatedTripData);
    if (newChanges.length > 0) {
      let latestTripData = updatedTripData ?? tripData;
      const pendingAdds: PendingChange[] = [];
      for (const change of newChanges) {
        if (change.type === 'remove' || change.type === 'resolve-url') {
          if (latestTripData) latestTripData = applyChange(change, latestTripData);
        } else {
          pendingAdds.push(change);
        }
      }
      if (latestTripData) setTripData(latestTripData);
      if (pendingAdds.length > 0) setPendingChanges(prev => [...prev, ...pendingAdds]);
    }
  };

  const handleViewFullItinerary = () => {
    if (!fullItineraryContent) return;
    setMessages(prev => [...prev, { role: 'assistant' as const, content: fullItineraryContent }]);
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
    const cat = label.toLowerCase().replace(/\s+/g, '') as PendingChange['category'];
    const pending = pendingChanges.filter(c => c.category === cat);
    return (
      <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--color-border-light)' }}>
        <p style={{ fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: '6px', fontWeight: 500 }}>{label}</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((item, i) => {
            const dayTag = getDayForPlace(item.name);
            const isRemoving = pendingChanges.some(c => c.type === 'remove' && c.item.name === item.name);
            return (
              <li key={i} style={{ fontSize: '0.75rem', lineHeight: 1.55, fontWeight: 300, paddingLeft: '0.9rem', position: 'relative', marginBottom: '4px' }}>
                <span style={{ position: 'absolute', left: 0, color: item.nonNegotiable ? 'var(--color-accent)' : 'var(--color-mist)', fontSize: '0.65rem' }}>{item.nonNegotiable ? '★' : '—'}</span>
                <span style={{ color: isRemoving ? '#c0392b' : 'var(--color-steel)', textDecoration: isRemoving ? 'line-through' : 'none' }}>
                  {item.isLink ? <em style={{ color: 'var(--color-mist)', fontStyle: 'italic' }}>Link — pending clarification</em> : item.name}
                </span>
                {item.reservation && <span style={{ marginLeft: '5px', fontSize: '0.65rem', color: 'var(--color-accent)' }}>· {item.reservation}</span>}
                {dayTag && <span style={{ marginLeft: '6px', fontSize: '0.6rem', color: 'var(--color-accent)', fontWeight: 500 }}>{dayTag}</span>}
                {isRemoving && (
                  <span style={{ marginLeft: '8px' }}>
                    {pendingChanges.filter(c => c.type === 'remove' && c.item.name === item.name).map(c => (
                      <span key={c.id} style={{ display: 'inline-flex', gap: '4px' }}>
                        <button onClick={() => confirmChange(c)} style={{ fontSize: '0.58rem', color: 'white', background: '#c0392b', border: 'none', cursor: 'pointer', padding: '1px 5px' }}>Remove</button>
                        <button onClick={() => rejectChange(c.id)} style={{ fontSize: '0.58rem', color: 'var(--color-mist)', background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', padding: '1px 5px' }}>Keep</button>
                      </span>
                    ))}
                  </span>
                )}
              </li>
            );
          })}
          {/* Pending additions for this category */}
          {pending.filter(c => c.type === 'add').map(c => (
            <li key={c.id} style={{ fontSize: '0.75rem', lineHeight: 1.55, fontWeight: 300, paddingLeft: '0.9rem', position: 'relative', marginBottom: '4px', opacity: 0.6 }}>
              <span style={{ position: 'absolute', left: 0, color: 'var(--color-mist)', fontSize: '0.65rem' }}>+</span>
              <span style={{ color: 'var(--color-steel)', fontStyle: 'italic' }}>{c.item.name}</span>
              <span style={{ marginLeft: '8px', display: 'inline-flex', gap: '4px' }}>
                <button onClick={() => confirmChange(c)} style={{ fontSize: '0.58rem', color: 'white', background: 'var(--color-accent)', border: 'none', cursor: 'pointer', padding: '1px 5px' }}>Add</button>
                <button onClick={() => rejectChange(c.id)} style={{ fontSize: '0.58rem', color: 'var(--color-mist)', background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', padding: '1px 5px' }}>Dismiss</button>
              </span>
            </li>
          ))}
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
              {appStage === 'itinerary' && hasFullItinerary && (
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
                  <div style={{ display: 'grid', gap: '14px' }}>
                    <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Destination city" style={S.input} />
                    <div>
                      <p style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-mist)', marginBottom: '6px' }}>Flight Arrival Time</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <input type="date" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} style={S.input} />
                        <input type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} style={S.input} />
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-mist)', marginBottom: '6px' }}>Flight Departure Time</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <input type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} style={S.input} />
                        <input type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} style={S.input} />
                      </div>
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
                  <PlaceCategory label="Restaurants & Food" rows={restaurants} setRows={setRestaurants} notesPlaceholder="Neighborhood, wait time..." />
                  <PlaceCategory label="Cafes" rows={cafes} setRows={setCafes} notesPlaceholder="Neighborhood, wait time..." />
                  <PlaceCategory label="Bars & Nightlife" rows={bars} setRows={setBars} notesPlaceholder="Neighborhood, wait time..." />
                  <PlaceCategory label="Activities & Sights" rows={activities} setRows={setActivities} notesPlaceholder="Neighborhood, duration..." />
                  <PlaceCategory label="Nice to Haves" rows={niceToHaves} setRows={setNiceToHaves} notesPlaceholder="Neighborhood, notes..." />
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
                    <ChatMessage key={index} message={message} onViewFullItinerary={handleViewFullItinerary} hasFullItinerary={hasFullItinerary} />
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
                        {(appStage === 'itinerary' || (appStage === 'clarify' && hasFullItinerary === false && messages.length > 2)) && (
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
                    { label: 'Flight Arrival', value: tripData.arrival },
                    { label: 'Flight Departure', value: tripData.departure },
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
              {(hasFullItinerary && refinementCount >= MAX_REFINEMENTS) ? (
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
