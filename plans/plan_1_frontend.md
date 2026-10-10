# Plan 1: Next.js Frontend — Agentic E-Commerce

## Overview
The frontend is a Next.js 14 (App Router) application that serves as the conversational and visual interface for the agentic shopping experience. Users interact via chat, voice, and traditional browse/search UI.

---

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** Zustand
- **Data Fetching:** TanStack Query (React Query)
- **Auth:** NextAuth.js (or Clerk)
- **Real-time:** WebSockets / SSE for agent streaming responses
- **Voice UI:** Pipecat Web SDK (WebRTC)
- **WhatsApp:** Redirect/QR links (managed via backend)

---

## Folder Structure
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (shop)/
│   │   ├── page.tsx              # Home / AI chat landing
│   │   ├── products/             # Browse products
│   │   ├── cart/                 # Cart page
│   │   ├── checkout/             # Checkout flow
│   │   └── orders/               # Order history
│   ├── agent/
│   │   └── page.tsx              # AI Agent chat interface
│   └── api/                      # Next.js API routes (BFF layer)
├── components/
│   ├── chat/
│   │   ├── ChatWindow.tsx        # Main agent chat UI
│   │   ├── MessageBubble.tsx     # User/agent message bubbles
│   │   ├── TypingIndicator.tsx
│   │   └── ProductCard.tsx       # Inline product cards in chat
│   ├── voice/
│   │   ├── VoiceButton.tsx       # Push-to-talk / voice toggle
│   │   └── VoiceVisualizer.tsx   # Audio waveform animation
│   ├── shop/
│   │   ├── ProductGrid.tsx
│   │   ├── ProductDetail.tsx
│   │   ├── CartSidebar.tsx
│   │   └── FilterPanel.tsx
│   └── layout/
│       ├── Navbar.tsx
│       └── Footer.tsx
├── hooks/
│   ├── useAgent.ts               # Agent chat logic + streaming
│   ├── useVoice.ts               # Pipecat voice session
│   └── useCart.ts
├── lib/
│   ├── api.ts                    # Axios/fetch wrappers to FastAPI
│   └── ws.ts                     # WebSocket client
└── store/
    ├── cartStore.ts
    └── userStore.ts
```

---

## Key Pages & Features

### 1. Home / Agent Chat (`/`)
- Conversational interface front and center
- User types: *"Find me wireless headphones under $80"*
- Agent responds with product cards embedded in chat
- Streaming response via SSE from FastAPI

### 2. Agent Page (`/agent`)
- Full-screen chat with agent
- Voice toggle button (Pipecat WebRTC)
- WhatsApp redirect button ("Continue on WhatsApp")
- Order status queries, recommendations, comparisons

### 3. Products (`/products`)
- Traditional browse grid as fallback UI
- Filter, sort, search
- Each product links to detail + "Ask Agent" CTA

### 4. Cart & Checkout (`/cart`, `/checkout`)
- Standard cart flow
- Agent can populate cart automatically
- Payment via Stripe (frontend side)

### 5. Orders (`/orders`)
- Order history
- Agent can answer "Where is my order?" queries

---

## Agent Chat — Streaming Flow
```
User types message
      ↓
POST /api/agent/chat (Next.js API route → proxies to FastAPI)
      ↓
FastAPI streams SSE chunks (LangChain agent tokens)
      ↓
Frontend renders tokens in real-time (ReadableStream)
      ↓
Tool call result (e.g. product list) rendered as ProductCard components
```

---

## Voice Integration (Pipecat)
- Pipecat Web SDK connects via WebRTC to Pipecat server
- `useVoice.ts` hook manages session start/stop
- VoiceButton component triggers recording
- Agent voice responses played back via audio element

---

## Environment Variables
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
NEXT_PUBLIC_PIPECAT_URL=wss://localhost:7860
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

---

## Development Phases

| Phase | Tasks |
|-------|-------|
| Phase 1 | Setup Next.js, Tailwind, shadcn, folder structure |
| Phase 2 | Build chat UI with mock agent responses |
| Phase 3 | Connect to FastAPI — real agent streaming |
| Phase 4 | Products, Cart, Checkout pages |
| Phase 5 | Voice UI with Pipecat Web SDK |
| Phase 6 | Polish, mobile responsive, WhatsApp CTA |

---

## Notes
- Use `app/api` routes as a BFF (Backend for Frontend) to avoid exposing FastAPI directly to browser
- All agent calls should be streamed — no full-page loading states
- Design mobile-first (WhatsApp users will be on mobile)
