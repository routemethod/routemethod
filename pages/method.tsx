import Head from 'next/head';
import Link from 'next/link';

export default function Method() {
  return (
    <>
      <Head>
        <title>The Method — RouteMethod</title>
        <meta name="description" content="How RouteMethod engineers your travel itinerary." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-paper)' }}>
        {/* Header */}
        <header style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-cream)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'baseline', gap: '10px', textDecoration: 'none' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 500, color: 'var(--color-ink)', letterSpacing: '0.02em' }}>RouteMethod</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-gold)', fontWeight: 400 }}>Travel, Engineered.</span>
            </Link>
            <Link href="/" style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-mist)', textDecoration: 'none' }}>
              ← Back
            </Link>
          </div>
        </header>

        <main style={{ maxWidth: '640px', margin: '0 auto', padding: '64px 24px 96px' }}>
          <div className="animate-fade-up">
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-gold)', marginBottom: '16px', fontWeight: 400 }}>The Method</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 400, color: 'var(--color-ink)', lineHeight: 1.2, marginBottom: '20px' }}>
              Efficient travel is not accidental.<br />
              <em>It is engineered.</em>
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: 'var(--color-mist)', lineHeight: 1.8, marginBottom: '56px', fontWeight: 300 }}>
              Most travelers arrive with dozens of saved places and no structure. The result is overpacked days, cross-city scrambling, missed meals, and a trip that feels exhausting rather than intentional. RouteMethod was built to solve that — not with suggestions, but with a planning framework that works through your list with the precision of a strategist and the instincts of someone who knows the city.
            </p>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '48px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-gold)', marginBottom: '40px', fontWeight: 400 }}>The Five Layers</p>

              {[
                {
                  num: '01',
                  title: 'Anchor',
                  subtitle: 'What is fixed.',
                  body: 'Every trip has immovable points — a dinner reservation, a concert, a museum with timed entry. These become the skeleton of your itinerary. Everything else is built around them, not the other way around. Anchor ensures that your confirmed commitments are never compromised by flexible planning.'
                },
                {
                  num: '02',
                  title: 'Density',
                  subtitle: 'How full is each day.',
                  body: 'A day that looks reasonable on paper can feel brutal in practice. Density assesses the realistic schedule load of each day — accounting for travel time between places, meal breaks, and the fact that standing in a museum for three hours is not the same as sitting in a café. Days that are overloaded are flagged and restructured before you ever see them.'
                },
                {
                  num: '03',
                  title: 'Cluster',
                  subtitle: 'How geographically concentrated each day is.',
                  body: 'The single most common itinerary mistake is scattering experiences across a city without regard for proximity. A day that takes you from one neighborhood to another and back again wastes time, money, and energy. Cluster groups your saved places by neighborhood so each day has a geographic logic — you move through a city with intention, not back and forth across it.'
                },
                {
                  num: '04',
                  title: 'Energy',
                  subtitle: 'The arc of the whole trip.',
                  body: 'A trip has a shape. You arrive with energy and leave with less of it. The heaviest, most demanding days belong early — when you are fresh, curious, and ready. The pace should decompress naturally as the trip progresses. Arrival days are protected from overloading. Departure days are kept light. Energy ensures the shape of your trip matches the reality of how human beings travel.'
                },
                {
                  num: '05',
                  title: 'Friction',
                  subtitle: 'The diagnostic synthesis.',
                  body: 'Friction is where everything comes together. It evaluates each day through all four lenses above and identifies where the combination creates a real problem — a day that is both too full and too scattered, or a demanding schedule placed on the day you land off a long flight. When friction is found, two specific alternatives are always offered. You choose. RouteMethod never resolves a tradeoff on your behalf.'
                },
              ].map((layer, i) => (
                <div key={layer.num} style={{ marginBottom: '48px', paddingBottom: '48px', borderBottom: i < 4 ? '1px solid var(--color-border-light)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', letterSpacing: '0.16em', color: 'var(--color-gold)', fontWeight: 500 }}>{layer.num}</span>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 500, color: 'var(--color-ink)' }}>{layer.title}</h2>
                  </div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', letterSpacing: '0.08em', color: 'var(--color-gold)', marginBottom: '14px', fontWeight: 400, textTransform: 'uppercase' }}>{layer.subtitle}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--color-steel)', lineHeight: 1.8, fontWeight: 300 }}>{layer.body}</p>
                </div>
              ))}
            </div>

            {/* Principles */}
            <div style={{ backgroundColor: 'var(--color-cream)', border: '1px solid var(--color-border)', padding: '36px', marginBottom: '48px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-gold)', marginBottom: '20px', fontWeight: 400 }}>Core Principles</p>
              {[
                'RouteMethod works only with what you provide. It never adds places you did not choose.',
                'Nothing is silently removed. If a tradeoff requires cutting something, you are told and you decide.',
                'Your confirmed reservations are never moved without your knowledge.',
                'Meals are structural anchors, not afterthoughts.',
                'When friction is found, two alternatives are always offered. You choose.',
                'Insider timing insights are guidance, not guarantees. Conditions change — always confirm locally.',
              ].map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--color-gold)', fontSize: '0.75rem', marginTop: '2px', flexShrink: 0 }}>—</span>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--color-steel)', lineHeight: 1.7, fontWeight: 300 }}>{p}</p>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontStyle: 'italic', color: 'var(--color-steel)', marginBottom: '24px' }}>
                "When you try to see everything, you compress nothing."
              </p>
              <Link href="/" style={{ display: 'inline-block', padding: '14px 36px', backgroundColor: 'var(--color-ink)', color: 'var(--color-paper)', fontFamily: 'var(--font-body)', fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 400 }}>
                Plan My Trip
              </Link>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
