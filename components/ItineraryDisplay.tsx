import { useRef } from 'react';
import { renderMarkdown } from '../lib/markdown';

interface ItineraryDisplayProps { content: string; }

export default function ItineraryDisplay({ content }: ItineraryDisplayProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handleExport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = renderMarkdown(content);
    printWindow.document.write(`<!DOCTYPE html><html><head><title>RouteMethod Itinerary</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; font-weight: 300; color: #0D0D0D; background: #fff; padding: 48px; max-width: 640px; margin: 0 auto; -webkit-font-smoothing: antialiased; }
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 36px; padding-bottom: 16px; border-bottom: 1px solid #8B3A2A; }
        .logo { font-family: 'Playfair Display', serif; font-size: 1.3rem; font-weight: 500; color: #0D0D0D; }
        .tagline { font-size: 0.58rem; letter-spacing: 0.2em; text-transform: uppercase; color: #8B3A2A; }
        h2 { font-family: 'Playfair Display', serif; font-size: 1.05rem; font-weight: 500; color: #2A3441; margin-top: 1.5rem; margin-bottom: 0.5rem; padding-bottom: 0.35rem; border-bottom: 1px solid #8B3A2A; }
        h3 { font-size: 0.58rem; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; color: #8B3A2A; margin-top: 0.85rem; margin-bottom: 0.3rem; }
        p { font-size: 0.82rem; line-height: 1.65; color: #2A3441; margin-bottom: 0.3rem; }
        ul { list-style: none; padding: 0; margin-bottom: 0.5rem; }
        ul li { font-size: 0.82rem; line-height: 1.6; color: #2A3441; padding-left: 1rem; position: relative; margin-bottom: 0.15rem; }
        ul li::before { content: '—'; position: absolute; left: 0; color: #8B3A2A; }
        strong { font-weight: 500; color: #0D0D0D; display: block; margin-top: 0.5rem; margin-bottom: 0.15rem; }
        em { font-style: italic; color: #8A919C; font-size: 0.78rem; display: block; margin-bottom: 0.35rem; padding-left: 0.75rem; border-left: 2px solid #E0DBD1; }
      </style></head><body>
      <div class="header"><div class="logo">RouteMethod</div><div class="tagline">Travel, Engineered.</div></div>
      <div>${html}</div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const html = renderMarkdown(content);

  return (
    <div ref={printRef} style={{ backgroundColor: 'var(--color-cream)', border: '1px solid var(--color-border)', padding: '24px' }} className="animate-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--color-accent)' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 500, color: 'var(--color-ink)' }}>Your Itinerary</div>
          <div style={{ fontSize: '0.56rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-accent)', marginTop: '2px' }}>RouteMethod — Travel, Engineered.</div>
        </div>
        <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', border: '1px solid var(--color-accent)', backgroundColor: 'transparent', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-body)', transition: 'all 0.15s ease' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-accent)'; e.currentTarget.style.color = 'white'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--color-accent)'; }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
      </div>
      <div className="itinerary-output" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
