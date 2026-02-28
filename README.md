# RouteMethod

**Travel, Engineered.**

An AI-assisted travel planning app that transforms chaotic saved lists into structured, intentional itineraries.

---

## Setup Instructions

### 1. Install dependencies

```bash
npm install
```

### 2. Add your API key

Open the `.env.local` file and replace `your_api_key_here` with your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## Deploying to Vercel

1. Push this code to your GitHub repository
2. Go to vercel.com and click "Add New Project"
3. Import your GitHub repository
4. In the Environment Variables section, add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your Anthropic API key
5. Click Deploy

---

## Updating the AI Prompt

The RouteMethod system prompt lives in one place:

```
lib/prompt.ts
```

Edit the prompt there, save, and Vercel will automatically redeploy within 30 seconds.

---

## Project Structure

```
routemethod/
├── pages/
│   ├── index.tsx          # Main app page
│   ├── _app.tsx           # App wrapper
│   └── api/
│       └── chat.ts        # API route (Claude integration)
├── components/
│   ├── ChatMessage.tsx    # Chat bubble component
│   └── ItineraryDisplay.tsx # Itinerary card + export
├── lib/
│   ├── prompt.ts          # RouteMethod system prompt
│   └── markdown.ts        # Markdown renderer
└── styles/
    └── globals.css        # Global styles
```
