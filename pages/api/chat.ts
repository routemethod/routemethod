import Anthropic from '@anthropic-ai/sdk';
import { NextApiRequest, NextApiResponse } from 'next';
import { ROUTEMETHOD_SYSTEM_PROMPT } from '../../lib/prompt';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, appStage, refinementsUsed, maxRefinements, tripData } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array required' });
  }

  // Append structured SESSION STATE block to system prompt
  let systemPrompt = ROUTEMETHOD_SYSTEM_PROMPT;

  const sessionLines: string[] = [];
  sessionLines.push('============================================================');
  sessionLines.push('SESSION STATE');
  sessionLines.push('============================================================');
  if (appStage !== undefined) sessionLines.push(`appStage: ${appStage}`);
  if (typeof refinementsUsed === 'number') sessionLines.push(`refinementsUsed: ${refinementsUsed}`);
  if (typeof maxRefinements === 'number') sessionLines.push(`maxRefinements: ${maxRefinements}`);
  if (tripData) {
    if (tripData.destination) sessionLines.push(`destination: ${tripData.destination}`);
    if (tripData.arrival) sessionLines.push(`arrivalProvided: ${tripData.arrival}`);
    if (tripData.departure) sessionLines.push(`departureProvided: ${tripData.departure}`);
    // Collect starred non-negotiables across all categories
    const allItems = [
      ...(tripData.restaurants || []),
      ...(tripData.cafes || []),
      ...(tripData.bars || []),
      ...(tripData.activities || []),
      ...(tripData.niceToHaves || []),
    ];
    const starred = allItems.filter((p: { nonNegotiable?: boolean; name: string }) => p.nonNegotiable).map((p: { name: string }) => p.name);
    if (starred.length > 0) sessionLines.push(`starredNonNegotiables: ${starred.join(', ')}`);
  }
  systemPrompt += '\n\n' + sessionLines.join('\n');

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages,
    });

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
      (res as any).flush?.();
    });

    stream.on('finalMessage', () => {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      (res as any).flush?.();
      res.end();
    });

    stream.on('error', (error) => {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      (res as any).flush?.();
      res.end();
    });

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
