// RouteMethod markdown renderer
export function renderMarkdown(text: string): string {
  let html = text;

  // Fix encoding issues
  html = html.replace(/â€"/g, '—');
  html = html.replace(/â€˜/g, '\u2018');
  html = html.replace(/â€™/g, '\u2019');
  html = html.replace(/â€œ/g, '\u201C');
  html = html.replace(/â€/g, '\u201D');
  html = html.replace(/---/g, '<hr>');

  // Escape HTML (preserve our special tokens)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Restore special tokens after escaping
  html = html.replace(/&lt;hr&gt;/g, '<hr>');

  // Headers
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');

  // Bold — always inline
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic — always inline
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li-u>$1</li-u>');
  html = html.replace(/(<li-u>[\s\S]*?<\/li-u>\n?)+/g, (m) => {
    const items = m.replace(/<li-u>(.*?)<\/li-u>/g, '<li>$1</li>');
    return `<ul>${items}</ul>`;
  });

  // Ordered lists — collect ALL numbered items first, then wrap in ONE <ol>
  // This prevents multiple <ol> resets when questions are separated by blank lines
  html = html.replace(/^\d+\. (.+)$/gm, '<li-o>$1</li-o>');

  // Merge consecutive li-o items even if separated by whitespace/blank lines
  // by first collapsing all li-o groups into one block, then wrapping
  const liOPattern = /(<li-o>[\s\S]*?<\/li-o>)(\s*(<li-o>[\s\S]*?<\/li-o>))*/g;
  html = html.replace(liOPattern, (m) => {
    const items = m.replace(/<li-o>([\s\S]*?)<\/li-o>/g, '<li>$1</li>');
    return `<ol>${items}</ol>`;
  });

  // Merge adjacent <ol> blocks that got separated — join them into one
  html = html.replace(/<\/ol>\s*<ol>/g, '');

  // Convert remaining lines to paragraphs
  const blocks = html.split(/\n\n+/);
  const processedBlocks = blocks.map(block => {
    block = block.trim();
    if (!block) return '';
    if (block.startsWith('<h') || block.startsWith('<ul') ||
        block.startsWith('<ol') || block.startsWith('<hr') ||
        block.startsWith('<li')) return block;

    const rawLines = block.split('\n').map(l => l.trim()).filter(Boolean);

    // Join lines where a bold time stamp got split from its " — activity" continuation
    const lines: string[] = [];
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const next = rawLines[i + 1];
      if (line.match(/^<strong>\d{1,2}:\d{2}<\/strong>$/) && next && next.startsWith('—')) {
        lines.push(line + ' ' + next);
        i++;
      } else {
        lines.push(line);
      }
    }

    if (lines.length === 0) return '';
    if (lines.length === 1) {
      if (lines[0].startsWith('<h') || lines[0].startsWith('<ul') ||
          lines[0].startsWith('<ol') || lines[0].startsWith('<hr')) return lines[0];
      return `<p>${lines[0]}</p>`;
    }
    return lines.map(line => {
      if (line.startsWith('<h') || line.startsWith('<ul') ||
          line.startsWith('<ol') || line.startsWith('<hr') ||
          line.startsWith('<li')) return line;
      return `<p>${line}</p>`;
    }).join('\n');
  });

  return processedBlocks.filter(Boolean).join('\n');
}

// Detect if message contains a full itinerary
export function isItinerary(text: string): boolean {
  return text.includes('## Day') || (text.includes('### Morning') && text.includes('### Evening'));
}

// Extract day assignments from itinerary text
export function extractDayAssignments(itineraryText: string): Record<string, string> {
  const assignments: Record<string, string> = {};
  const dayRegex = /## Day (\d+)[^\n]*/g;
  let dayMatch;

  while ((dayMatch = dayRegex.exec(itineraryText)) !== null) {
    const dayNum = dayMatch[1];
    const dayStart = dayMatch.index;
    const nextDay = itineraryText.indexOf('## Day', dayStart + 1);
    const dayContent = itineraryText.slice(dayStart, nextDay > -1 ? nextDay : undefined);

    const entryPattern = /\*\*\d+:\d+\*\*\s*—\s*([^.\n]+)/g;
    let entryMatch;
    while ((entryMatch = entryPattern.exec(dayContent)) !== null) {
      const placePart = entryMatch[1].trim();
      const atMatch = placePart.match(/(?:at|@)\s+(.+)/i);
      const placeName = atMatch ? atMatch[1].trim() : placePart;
      if (placeName.length > 2 && placeName.length < 60) {
        assignments[placeName.toLowerCase()] = `Day ${dayNum}`;
      }
    }
  }

  return assignments;
}
