# Plan 10: Admin panel, AI agent part

Make **Conversations**, **Transcript** and **Agent insights** in the admin panel show real chats
instead of `lib/admin/mock.ts`. No new database tables: chats are read from LangGraph, whose
conversations are now saved in Postgres (`checkpoints` tables).

---

## Where things stand

| Piece | Today |
|---|---|
| Chat storage | ✅ LangGraph threads; messages and tool calls saved in Postgres (checkpointer) |
| Who a chat belongs to | ❌ Threads carry no owner, title or channel. The admin can't tell whose chat it is |
| LangGraph API (`/threads/...`) | ⚠️ Open to anyone, no login (security issue, separate step) |
| Admin pages | ❌ Conversations list, Transcript, Agent insights: all fake data |
| Sidebar "Conversations 7" badge, flagged-chats notification | ❌ Fake |

## Approach

- **Read chats through LangGraph's own API, from the backend.** New admin routes in FastAPI
  call LangGraph (`threads.search`, `threads.get_state`, `threads.update`) server side and are
  protected by the existing admin check (`require_admin`). The browser never calls the open
  LangGraph routes for admin data.
- **Label each thread** with its owner, title and channel (thread metadata). Without this
  the admin list can't show customers.
- **Admin review fields** (flagged, outcome, note) are stored on the same thread metadata.
  No new tables.

---

## Steps

### Step 1: Label chats (backend agent)
A small middleware runs after every agent reply and saves on the thread (`PATCH /threads/{id}`):
`user_id`, `user_name`, `user_email`, `signed_in`, `channel` (web by default), `title`
(first question), `message_count`, `last_message_at`.
- The owner comes from the server-side login check, never from the browser; the token itself is not saved.
- If labelling fails, the chat still works.
- Admin fields (flagged, outcome, note) are kept, since PATCH merges metadata.
- Old chats: a one-off command adds title and count; their owner shows as "Unknown".

### Step 2: Admin API (backend, admin only)
| Route | Purpose |
|---|---|
| `GET /admin/conversations` | List: customer, title, channel, messages, last activity, outcome, flagged. Filters: flagged, outcome, channel, signed in/guest, search. Paged. |
| `GET /admin/conversations/{thread_id}` | Transcript: every message, tool calls with their arguments and results, token use; customer card and their latest orders. |
| `PATCH /admin/conversations/{thread_id}` | Set flagged, outcome (open / purchased / answered / unresolved), review note. Audit-logged. |
| `GET /admin/agent/stats?days=7\|30\|90` | Chats per day (signed in vs guest), outcomes, average messages per chat, tool usage counts, most asked first questions, **"asked for, not stocked"** (product searches that found nothing), token use, chats that led to an order. |

Outcome "purchased" is set automatically when a chat contains a successful checkout.

### Step 3: Admin pages (frontend)
- **Conversations:** tabs All / Flagged / Unresolved / Purchases, channel filter, search, server
  paging, row → transcript. Same table style as Orders.
- **Transcript:** chat bubbles (customer, ZEK), tool calls shown as expandable "ZEK used: search
  products (coffee, under $50) → 4 results"; side cards for customer, outcome, flag, review note.
- **Agent insights:** stat cards, chats-per-day chart, outcomes donut, top questions, not-stocked
  searches, tools used, flagged list. Real numbers only; the old "reply time" and "revenue via
  agent" cards are replaced by numbers we can actually measure.
- Sidebar **Conversations** badge = real flagged count; top-bar notification likewise.
- Remove the agent data from `lib/admin/mock.ts` (and the file once nothing uses it).

### Step 4: Test
- Chat as a signed-in customer and as a guest: both appear in the list with the right owner,
  title and message count; the transcript matches the chat, including tool calls.
- Flag, set outcome and add a note: saved and still there after reload.
- A "not stocked" search shows up in insights; numbers match a hand count.
- A non-admin gets 403 on every new route.

---

## Not in this plan (separate steps)
- **Lock the LangGraph API with login** (customers only see their own threads). Needed before
  going public; independent of the admin pages, since the admin reads through the backend.
- Human reply from the admin into a chat (needs live push to the browser).
- Durable thread list in production (`langgraph up`); in dev the thread list and metadata live
  in `.langgraph_api`, the messages in Postgres.

## Order
Step 1 → 2 → 3 → 4. Step 1 touches the live assistant, so the video flow (coffee gift,
headphones, order status) is re-tested after it.
