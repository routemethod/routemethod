import { useRef } from 'react';
import { renderMarkdown } from '../lib/markdown';

interface ItineraryDisplayProps {
  content: string;
}

export default function ItineraryDisplay({ content }: ItineraryDisplayProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handleExport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = renderMarkdown(content);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>RouteMethod Itinerary</title>
          <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Jost', sans-serif;
              font-weight: 300;
              color: #0E0E0E;
              background: #fff;
              padding: 48px;
              max-width: 680px;
              margin: 0 auto;
              -webkit-font-smoothing: antialiased;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 1px solid #C9A96E;
            }
            .logo {
              font-family: 'Cormorant Garamond', serif;
              font-size: 1.5rem;
              font-weight: 400;
              letter-spacing: 0.08em;
              color: #0E0E0E;
            }
            .tagline {
              font-size: 0.65rem;
              letter-spacing: 0.18em;
              text-transform: uppercase;
              color: #C9A96E;
            }
            h1 { font-family: 'Cormorant Garamond', serif; font-size: 2rem; font-weight: 400; margin-bottom: 0.5rem; }
            h2 { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; font-weight: 500; color: #2C3E50; margin-top: 2rem; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid #C9A96E; letter-spacing: 0.04em; }
            h3 { font-family: 'Jost', sans-serif; font-size: 0.65rem; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: #C9A96E; margin-top: 1.25rem; margin-bottom: 0.4rem; }
            p { font-size: 0.875rem; line-height: 1.75; color: #2C3E50; margin-bottom: 0.5rem; }
            ul { list-style: none; padding: 0; margin-bottom: 0.75rem; }
            ul li { font-size: 0.875rem; line-height: 1.7; color: #2C3E50; padding-left: 1rem; position: relative; }
            ul li::before { content: '—'; position: absolute; left: 0; color: #C9A96E; font-size: 0.75rem; }
            strong { font-weight: 500; color: #0E0E0E; }
            em { font-style: italic; color: #8C9BAB; font-size: 0.85rem; }
            @media print {
              body { padding: 24px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">RouteMethod</div>
            <div class="tagline">Travel, Engineered.</div>
          </div>
          <div>${html}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const html = renderMarkdown(content);

  return (
    <div className="relative">
      {/* Itinerary card */}
      <div
        ref={printRef}
        className="bg-cream border border-border rounded-sm p-8 animate-fade-up"
      >
        {/* Card header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gold">
          <div>
            <div className="font-display text-lg text-ink tracking-wide">Your Itinerary</div>
            <div className="text-xs tracking-widest uppercase text-gold mt-0.5" style={{ fontSize: '0.6rem' }}>
              RouteMethod — Travel, Engineered.
            </div>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gold text-gold hover:bg-gold hover:text-cream transition-all duration-200 text-xs tracking-widest uppercase"
            style={{ fontSize: '0.6rem' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export / Print
          </button>
        </div>

        {/* Itinerary content */}
        <div
          className="itinerary-output"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
