// Markdown to HTML converter for RouteMethod
export function renderMarkdown(text: string): string {
  let html = text;

  // Fix encoding issues — normalize em dashes and other special chars
  html = html.replace(/â€"/g, '—');
  html = html.replace(/â€˜/g, '\u2018');
  html = html.replace(/â€™/g, '\u2019');
  html = html.replace(/â€œ/g, '\u201C');
  html = html.replace(/â€/g, '\u201D');

  // Escape HTML entities
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Restore em dash after escaping
  html = html.replace(/—/g, '—');

  // Headers
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold — inline only, never block
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<oli>$1</oli>');
  html = html.replace(/(<oli>.*<\/oli>\n?)+/g, (match) => {
    const items = match.replace(/<oli>(.*?)<\/oli>/g, '<li>$1</li>');
    return `<ol>${items}</ol>`;
  });

  // Paragraphs — wrap loose lines
  const lines = html.split('\n');
  const processed: string[] = [];
  let inPara = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const isBlock = trimmed.startsWith('<h') || trimmed.startsWith('<ul') ||
      trimmed.startsWith('<ol') || trimmed.startsWith('<li') || trimmed === '';

    if (isBlock) {
      if (inPara) { processed.push('</p>'); inPara = false; }
      if (trimmed === '') processed.push('<br class="spacer">');
      else processed.push(line);
    } else {
      if (!inPara) { processed.push('<p>'); inPara = true; }
      processed.push(trimmed + ' ');
    }
  }
  if (inPara) processed.push('</p>');

  // Clean up spacers inside paragraphs
  return processed.join('\n').replace(/<br class="spacer">\s*<\/p>/g, '</p>');
}

// Detect if message contains a full itinerary
export function isItinerary(text: string): boolean {
  return text.includes('## Day') || (text.includes('### Morning') && text.includes('### Evening'));
}

// Extract questions from end of a message
export function extractQuestions(text: string): string[] {
  const questions: string[] = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Match numbered questions like "1." or "1)"
    if (/^\d+[\.\)]\s+.+\?/.test(trimmed)) {
      questions.push(trimmed.replace(/^\d+[\.\)]\s+/, ''));
    }
  }
  return questions;
}

// Extract day assignments from itinerary text
export function extractDayAssignments(itineraryText: string): Record<string, string> {
  const assignments: Record<string, string> = {};
  const dayMatches = itineraryText.match(/## Day (\d+)[^\n]*/g) || [];
  
  dayMatches.forEach((dayHeader) => {
    const dayNum = dayHeader.match(/## Day (\d+)/)?.[1];
    if (!dayNum) return;
    
    // Find content between this day header and the next
    const dayStart = itineraryText.indexOf(dayHeader);
    const nextDayMatch = itineraryText.indexOf('## Day', dayStart + 1);
    const dayContent = itineraryText.slice(dayStart, nextDayMatch > -1 ? nextDayMatch : undefined);
    
    // Extract place names mentioned in this day
    const placePattern = /(?:at|visit|head to|grab|stop at|try)\s+([A-Z][^,\.\n]+?)(?:\s+for|\s+at|\s+—|,|\.|\n)/g;
    let match;
    while ((match = placePattern.exec(dayContent)) !== null) {
      const place = match[1].trim();
      if (place.length > 2 && place.length < 50) {
        assignments[place.toLowerCase()] = `Day ${dayNum}`;
      }
    }
  });
  
  return assignments;
}
