# Plan 9: Admin Phase 6, real agent conversations and insights

Make the admin **Agent insights** and **Conversations** pages show real chats from the
website assistant and WhatsApp, instead of `lib/admin/mock.ts`.

---

## Where things stand

| Piece | State |
|---|---|
| DB tables `conversations` + `messages` | Exist and fit the job: messages, tool calls, tokens, latency, outcome, flag, admin note, human takeover. |
| Who writes to them | **Only the seed script** (3 demo chats). Real chats are never saved there. |
| Website chat | Runs on LangGraph (`chat` graph). History lives in the `langgraph dev` local files (`.langgraph_api/*.pckl`), which are dev-only and not durable. |
| WhatsApp | `webhook/whatsapp.py` calls `run_agent(text)`: no thread per customer, no user, nothing saved. Each message starts from zero. |
| Orders | `orders.conversation_id` exists but is never filled. |
| Admin pages | `AgentInsights`, `ConversationsTable`, `Transcript`, sidebar "Conversations 7" badge: all mock. |

**Decision:** save conversations into our own Postgres tables while the agent runs, rather than
reading LangGraph's dev storage. Our tables are durable, can be joined with users and orders, and
already have outcome, flag and note.

---

## Steps

### Step 1: Record every chat (backend, agent side)

1. **`ConversationRecorder` middleware** (new, next to `ZekAuthMiddleware`), using the
   `after_agent` hook (runs once per reply):
   - Upsert the `conversations` row by `session_id` = LangGraph `thread_id`.
   - Insert only the **new** messages (LangChain message id → `messages.external_id`, so
     nothing is saved twice): user, assistant (text, tool calls, model, tokens), tool (name, result).
   - Set `user_id` from the token (`sub`), `title` from the first question (≤ 200 chars),
     `message_count`, `last_message_at`.
   - Never break a chat: on any DB error, log it and carry on.
2. **Know the channel:** add `channel` to `ZekContext` (`agent` by default for web chat;
   WhatsApp sends `whatsapp`, voice later `voice`).
3. **Outcome, automatically:**
   - `purchased` when a checkout tool call succeeds in the chat (also fills `orders.conversation_id`
     and makes sure the order's channel is `agent` / `whatsapp`).
   - Otherwise it stays `open`; the admin can set `answered` / `unresolved` / `handed_off`.

### Step 2: Fix WhatsApp so chats have memory and are recorded

- One thread per phone number (`wa-<phone>`), so the agent remembers the conversation.
- Pass `channel="whatsapp"` and the phone in the context; save `customer_phone`.
- Link to a customer when a user has that phone number (read-only lookup).
- Skip duplicates (WhatsApp retries webhooks): use the WhatsApp message id.
- Replace the `print` calls with logging.

### Step 3: Admin API (backend)

| Endpoint | Purpose |
|---|---|
| `GET /admin/conversations` | List with filters: channel, outcome, flagged, search (title / customer), date; customer name, message count, last message, linked order. Paged. |
| `GET /admin/conversations/{id}` | Full transcript: messages, tool calls and results, tokens, latency; customer; linked orders. |
| `PATCH /admin/conversations/{id}` | Set `is_flagged`, `outcome`, `admin_note`. Audit-logged. |
| `POST /admin/conversations/{id}/reply` | **WhatsApp only:** a human sends a message to the customer, saved as a staff message, outcome `handed_off`. |
| `GET /admin/agent/stats?days=7\|30\|90` | Chats per day by channel, outcome split, chat → purchase rate, revenue via agent, avg messages per chat, avg reply time and tokens, tool usage counts, most asked questions, and **"asked for, not stocked"** (product searches that found nothing). |

### Step 4: Admin pages (frontend)

- **Conversations list:** tabs All / Flagged / Unresolved / Purchases / Open, channel filter,
  search, server paging; row → transcript.
- **Transcript:** chat bubbles, collapsible tool calls (args + result), customer + linked order
  card, flag toggle, outcome select, review note. Reply box shown **only for WhatsApp** chats
  (web chat replies need live push to the browser; out of scope).
- **Agent insights:** stat cards, chats-per-day chart, outcomes donut, top questions, not-stocked
  searches, tool usage, flagged list. All from `/admin/agent/stats`.
- **Sidebar badge** "Conversations" = real flagged count; top bar notification likewise.
- Delete the remaining agent mock data from `lib/admin/mock.ts`.

### Step 5: Test

- Chat on the website as a test customer (search, add to cart): the chat appears in the admin
  with messages and tool calls, linked to the customer.
- Same thread twice: no duplicate messages.
- Guest chat: recorded without a customer.
- Flag, set outcome, add a note: saved.
- Stats match a hand count.
- WhatsApp: simulate a webhook POST (no real WhatsApp send) to check threading and recording.

---

## Things to decide

1. **Privacy:** chats can include addresses and phone numbers. Admin-only access is already
   enforced; should old chats be deleted after N days? (Default: keep.)
2. **Human reply on web chat:** skipped for now (WhatsApp only). OK?
3. **Old demo chats:** the 3 seeded chats stay as examples unless you want them removed.

## Order of work

Step 1 → 2 → 3 → 4 → 5. Steps 1 and 2 change the agent and the WhatsApp webhook, so the
website assistant and WhatsApp bot get re-tested after them.
