// Simple markdown to HTML converter for RouteMethod output
export function renderMarkdown(text: string): string {
  let html = text;

  // Escape HTML entities first
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic (but not list markers)
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Line breaks to paragraphs
  const lines = html.split('\n');
  const processed: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('<h') ||
      trimmed.startsWith('<ul') ||
      trimmed.startsWith('<ol') ||
      trimmed.startsWith('<li') ||
      trimmed === ''
    ) {
      if (inBlock) {
        processed.push('</p>');
        inBlock = false;
      }
      processed.push(line);
    } else {
      if (!inBlock) {
        processed.push('<p>');
        inBlock = true;
      }
      processed.push(trimmed + ' ');
    }
  }
  if (inBlock) processed.push('</p>');

  return processed.join('\n');
}

// Detect if a message contains a full itinerary (Phase 3 output)
export function isItinerary(text: string): boolean {
  return (
    text.includes('## Day') ||
    (text.includes('### Morning') && text.includes('### Evening'))
  );
}
