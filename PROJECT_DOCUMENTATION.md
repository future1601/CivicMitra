# JanSevak - Complete Project Documentation

## 1. Overview

JanSevak is a Government Complaint Management System built for Smart India Hackathon 2025. Citizens submit complaints via WhatsApp, and government authorities manage them through a web-based admin dashboard. The system uses Google Gemini AI for natural language understanding, complaint classification, and an admin chatbot.

**Stack:** FastAPI (Python) backend + React/TypeScript frontend + SQLite database

---

## 2. Architecture

```
                    ┌──────────────┐
                    │   Citizens   │
                    └──────┬───────┘
                           │ WhatsApp Messages
                           ▼
                ┌──────────────────────┐
                │  WhatsApp Cloud API  │
                └──────────┬───────────┘
                           │ Webhook
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI)                      │
│                                                         │
│  server.py ─── workflow.py ─── chatbot.py               │
│      │              │               │                   │
│      │         Google Gemini    LangGraph Agent          │
│      │              │               │                   │
│      └──── database.py ─── models.py                    │
│                  │                                       │
│            whatsapp_bot.db (SQLite)                      │
└────────────────────┬────────────────────────────────────┘
                     │ REST API
                     ▼
┌─────────────────────────────────────────────────────────┐
│              FRONTEND (React + TypeScript)               │
│                                                         │
│  Dashboard ── Map ── Complaints ── Chatbot ── Resources │
│     │          │          │           │                  │
│  Recharts   Mapbox    DataTable   AI Chat Interface     │
└─────────────────────────────────────────────────────────┘
```

---

## 3. File Structure

```
JanSevak-v0/
├── Backend/
│   ├── server.py              # FastAPI server, routes, webhook handling
│   ├── workflow.py            # Complaint state machine + Gemini AI calls
│   ├── chatbot.py             # LangGraph ReAct agent for admin chatbot
│   ├── database.py            # SQLite operations (CRUD)
│   ├── models.py              # Pydantic data models
│   ├── start_server.py        # Server startup helper
│   ├── check_coordinates.py   # Coordinate validation utility
│   ├── test_chatbot.py        # Chatbot tests
│   ├── test_coordinates.py    # Coordinate tests
│   ├── requirements.txt       # Python dependencies
│   ├── .env.example           # Environment variable template
│   └── uploads/               # Stored complaint images
│
├── Frontend/
│   ├── src/
│   │   ├── App.tsx                        # Root component with tab routing
│   │   ├── main.tsx                       # React entry point
│   │   ├── components/
│   │   │   ├── Navigation.tsx             # Top nav bar (5 tabs)
│   │   │   ├── StatisticsSection.tsx      # Dashboard cards + charts
│   │   │   ├── ComplaintsTable.tsx        # Sortable complaint list
│   │   │   ├── ComplaintDetails.tsx       # Single complaint view
│   │   │   ├── ChatbotPage.tsx           # AI chat interface
│   │   │   ├── JharkhandHeatmap.tsx      # Mapbox map with filters
│   │   │   ├── ResourcesPage.tsx         # Documentation library
│   │   │   ├── AuthoritiesPage.tsx       # Authorities management
│   │   │   ├── figma/
│   │   │   │   └── ImageWithFallback.tsx # Image with fallback
│   │   │   └── ui/                       # Radix UI primitives
│   │   │       ├── button.tsx, card.tsx, table.tsx, ...
│   │   │       └── mapboxMap.tsx         # Mapbox wrapper
│   │   ├── services/
│   │   │   └── api.ts                    # API service layer + types
│   │   ├── hooks/
│   │   │   └── useApi.ts                 # useReports, useReportStats, useBackendConnection
│   │   └── guidelines/
│   │       └── Guidelines.md             # Design guidelines
│   ├── vite.config.ts                    # Vite config (port 3000)
│   ├── package.json                      # Dependencies
│   └── .env.example                      # Frontend env template
│
├── whatsapp_bot.db                       # SQLite database
├── .gitignore
└── README.md
```

---

## 4. Backend Deep Dive

### 4.1 server.py — FastAPI Server

The main entry point. Handles HTTP routing, WhatsApp webhook integration, and serves the REST API.

**Environment Variables Required:**
| Variable | Purpose |
|----------|---------|
| `WHATSAPP_TOKEN` | WhatsApp Business API token |
| `PHONE_NUMBER_ID` | WhatsApp phone number ID |
| `VERIFY_TOKEN` | Webhook verification token |
| `GEMINI_API_KEY` | Google Gemini AI API key |

**CORS:** Allows requests from `localhost:3000`, `localhost:5173`, `localhost:4173` (dev servers).

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `get_or_create_session(phone_number)` | Manages user sessions — creates new or returns existing active session |
| `send_whatsapp_message(to_number, message)` | Sends text messages via WhatsApp Cloud API |
| `download_whatsapp_media(media_id)` | Downloads images/audio from WhatsApp servers |
| `save_completed_report(state, session)` | Persists a completed complaint to the database |
| `save_image_to_storage(image_data, report_id)` | Saves uploaded images to `uploads/reports/` |

### 4.2 workflow.py — Complaint State Machine

Processes WhatsApp messages through a multi-step state machine using Google Gemini AI.

**AI Models Used:**
- `gemini-2.5-flash` — Text validation, question understanding, response generation
- `gemini-2.0-flash-exp` — Image analysis and complaint classification

**Workflow Steps:**

```
Step 1: Receive complaint text
  └─ Gemini validates if it's an actual complaint
  └─ If valid → ask for location

Step 2: Receive location (text address or GPS pin)
  └─ Gemini validates if it's a valid location
  └─ If valid → ask for image

Step 3: Receive image
  └─ Gemini validates image matches description
  └─ Auto-classifies: category, priority, department, resolution_days
  └─ Generates report ID (format: GOV{timestamp}{uuid})
  └─ Saves to database → sends confirmation
```

**Supported Input Types:**
- **Text** — complaint descriptions, location addresses
- **Audio** — transcribed to text via Gemini, then processed as text
- **Location** — GPS coordinates from WhatsApp's location sharing
- **Image** — photos of the issue for validation and classification

**Classification System:**

| Dimension | Options |
|-----------|---------|
| **Categories (12)** | road_infrastructure, water_sanitation, electricity_power, waste_management, traffic_transport, public_safety, environment_pollution, healthcare_medical, education_schools, telecommunication, housing_construction, general_administration |
| **Priorities (4)** | low, medium, high, very_high |
| **Departments (15)** | Public Works, Water & Sanitation, Power, Waste Management, Traffic Police, Public Safety, Environmental, Health, Education, Telecommunication, Housing & Construction, Fire, Municipal Corporation, Revenue, General Administration |

### 4.3 chatbot.py — Admin AI Chatbot

A LangGraph ReAct agent that lets administrators query complaint data using natural language.

**How it works:**
1. Admin types a question (e.g., "How many high priority complaints?")
2. The ReAct agent reasons about the question
3. It generates a SQL query and executes it via the `complaint_query` tool
4. It formats the results and provides analysis

**Tool:** `complaint_query(sql_query: str)` — executes SQL on the `complaint_reports` table and returns formatted results.

**Common Query Patterns the Agent Knows:**
```
"latest complaints"      → SELECT * FROM complaint_reports ORDER BY created_at DESC LIMIT 5
"by category"            → SELECT * FROM complaint_reports WHERE category = '...'
"high priority"          → SELECT * FROM complaint_reports WHERE priority IN ('high', 'very_high')
"total count"            → SELECT COUNT(*) FROM complaint_reports
"by status"              → SELECT status, COUNT(*) FROM complaint_reports GROUP BY status
```

### 4.4 database.py — Data Persistence

SQLite database with two tables:

**Table: `complaint_reports`**
```sql
report_id        TEXT PRIMARY KEY     -- e.g., GOV202403141234ABC
session_id       TEXT NOT NULL
phone_number     TEXT NOT NULL        -- e.g., 919876543210
description      TEXT NOT NULL        -- complaint description
coordinates      TEXT NOT NULL        -- e.g., "GPS: 23.5, 85.3"
image_path       TEXT                 -- path to uploaded image
category         TEXT                 -- auto-classified category
priority         TEXT                 -- low | medium | high | very_high
department       TEXT                 -- assigned department
resolution_days  INTEGER             -- estimated days to resolve
status           TEXT DEFAULT 'submitted'  -- submitted | in_progress | resolved
created_at       TEXT
updated_at       TEXT
```

**Table: `user_sessions`**
```sql
session_id       TEXT PRIMARY KEY
phone_number     TEXT NOT NULL
session_status   TEXT DEFAULT 'active'   -- active | closed
complaint_text   TEXT                    -- in-progress complaint text
coordinates      TEXT                    -- in-progress location
image_data       BLOB                   -- temporary image storage
created_at       TEXT
updated_at       TEXT
expires_at       TEXT                    -- 24-hour expiration
```

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `create_user_session(phone_number)` | Creates session with 24-hour TTL |
| `get_user_session(phone_number)` | Retrieves active session |
| `update_user_session(session_id, updates)` | Updates session fields |
| `save_government_report(report_data)` | Inserts completed complaint |
| `get_reports_by_phone(phone_number)` | Gets all reports for a user |
| `close_expired_sessions()` | Marks expired sessions as closed |
| `get_analytics()` | Returns totals by status and department |

### 4.5 models.py — Pydantic Models

```python
QuestionValidation       # {isvalid, question?}
AudioTranscription       # {transcribed_text, isvalid, question?}
ComplaintValidation       # {valid, question?, description?, priority, department, category, resolution_days?}
ComplaintState            # Full state object tracking complaint through the workflow
                         # Fields: phone_number, session_id, complaint_text, coordinates,
                         #         image_analysis, image_data, report_id, category, priority,
                         #         department, resolution_days, status, step, message, user_input
```

---

## 5. Frontend Deep Dive

### 5.1 App.tsx — Routing

Tab-based navigation between 5 pages. No React Router — uses simple state-based tab switching.

**Pages:**
| Tab | Component | Description |
|-----|-----------|-------------|
| Home | `JharkhandHeatmap` + `StatisticsSection` | Dashboard with map and analytics |
| Map | `JharkhandHeatmap` (full view) | Dedicated map page |
| Complaints | `ComplaintsTable` | Searchable/filterable complaint list |
| Chatbot | `ChatbotPage` | AI-powered data query interface |
| Resources | `ResourcesPage` | Documentation library |

Clicking "View" on a complaint opens `ComplaintDetails` as an overlay.

### 5.2 Components

**Navigation.tsx**
- Horizontal tab bar with 5 tabs: Home, Map, Complaints, Chatbot, Resources
- Active tab gets highlighted styling
- Calls `onTabChange` callback to switch views

**StatisticsSection.tsx**
- **4 stat cards:** Total Complaints, Resolved This Month, Pending Review, Avg Resolution Time
  - Each card shows value + month-over-month change (with colored indicator)
- **Bar chart:** Monthly complaint trends (last 6 months) via Recharts
- **Pie chart:** Department-wise distribution via Recharts
- Falls back to mock data if the backend is unreachable

**ComplaintsTable.tsx**
- Table columns: Report ID, Title (first 50 chars of description), Location, Category, Priority, Status, Date, Actions
- Color-coded priority badges: low (green), medium (yellow), high (orange), very_high (red)
- Color-coded status badges: submitted (blue), in_progress (yellow), resolved (green)
- "View" button opens ComplaintDetails
- Fetches from `GET /api/reports`

**ComplaintDetails.tsx**
- Full complaint view with:
  - Header: title, location, date, phone number
  - Priority + status badges
  - Image/evidence section (with fallback if no image)
  - Full description text
  - Category and department info
  - 5 AI-suggested actions (hardcoded suggestions based on complaint type)
  - Action buttons: Assign to Department, Mark as Resolved, Request More Info
- Fetches from `GET /api/reports/{id}`

**JharkhandHeatmap.tsx**
- Interactive Mapbox GL map showing complaint locations as markers
- Clicking a marker opens a side panel with complaint details
- **Filter controls:** category, priority, department, status (all dropdowns)
- Active filter chips displayed below the filters
- Backend connection indicator (green/red dot)
- Auto-refreshes every 10 minutes
- "View Full Details" button navigates to ComplaintDetails
- Fetches from `GET /api/reports/by-location` with query parameters for filters

**ChatbotPage.tsx**
- Chat interface with message bubbles (user on right, bot on left)
- 4 stat cards at top: Total Complaints, Recent, Status Distribution, Priority Distribution
- Quick-action buttons for common queries (e.g., "Show latest complaints", "High priority issues")
- Auto-scrolls to latest message
- Loading indicator with bouncing dots animation
- Enter key sends message
- Sends to `POST /api/chatbot/message`, fetches stats from `GET /api/chatbot/stats`

**ResourcesPage.tsx**
- Grid of resource cards (policies, guidelines, forms, reports)
- Search bar and type filter buttons
- Each card shows: title, description, type badge, file size, download count
- Download and Preview buttons (placeholder functionality)

### 5.3 services/api.ts — API Layer

Centralized API communication with full TypeScript type definitions.

**Base URL:** `http://localhost:8000/api`

**Key Interfaces:**
```typescript
Report {
  report_id, session_id, citizen_phone, description,
  coordinates?: {lat, lng}, image_path?, category,
  priority: "low"|"medium"|"high"|"very_high",
  department, resolution_days?, status: "submitted"|"in_progress"|"resolved",
  location_lat, location_lon, address_extracted?, created_at, updated_at
}

Location {
  lng, lat, name, info, category?, priority?,
  department?, status?, report_id?, description?,
  created_at?, phone_number?, resolution_days?
}

ComprehensiveStats {
  cards: { total_complaints, resolved_this_month, pending_review, avg_resolution_time },
  monthly_data, category_data, by_status, by_priority, by_department, total_reports
}
```

**API Methods:**

| Method | Endpoint | Returns |
|--------|----------|---------|
| `getAllReports()` | `GET /reports` | `Report[]` |
| `getComprehensiveStats()` | `GET /reports/stats` | `ComprehensiveStats` |
| `getReportsByLocation(filters?)` | `GET /reports/by-location` | `Location[]` |
| `getFilterOptions()` | `GET /filter-options` | Available filter values |
| `getReportDetails(id)` | `GET /reports/{id}` | `Report` |
| `checkConnection()` | `GET /health` | `boolean` |
| `sendChatMessage(msg, history)` | `POST /chatbot/message` | `{response, status}` |
| `getChatbotStats()` | `GET /chatbot/stats` | Stats object |

### 5.4 hooks/useApi.ts — Custom Hooks

```typescript
useReports()           // Returns { reports, loading, error, refetch }
useReportStats()       // Returns { stats, loading, error, refetch }
useBackendConnection() // Returns { isConnected, checking, checkConnection }
                       // Polls every 60 seconds
```

---

## 6. API Reference

### WhatsApp Webhook

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/webhook` | GET | WhatsApp verification — validates `hub.verify_token` and returns `hub.challenge` |
| `/webhook` | POST | Receives incoming WhatsApp messages (text, audio, image, location) |

### Complaint Reports

| Endpoint | Method | Query Params | Response |
|----------|--------|-------------|----------|
| `/api/reports` | GET | — | `{ success, data: Report[] }` |
| `/api/reports/{id}` | GET | — | `{ success, data: Report }` |
| `/api/reports/stats` | GET | — | `{ success, data: ComprehensiveStats }` |
| `/api/reports/by-location` | GET | `category, priority, department, status` | `{ success, data: Location[] }` |
| `/api/filter-options` | GET | — | `{ success, data: { categories, priorities, departments, statuses } }` |
| `/reports/{phone}` | GET | — | `{ reports: Report[] }` |

### Chatbot

| Endpoint | Method | Body | Response |
|----------|--------|------|----------|
| `/api/chatbot/message` | POST | `{ message: string, chat_history: ChatMessage[] }` | `{ response: string, status: string }` |
| `/api/chatbot/stats` | GET | — | `{ total_complaints, by_status, by_priority, by_category, recent_complaints }` |

### Utility

| Endpoint | Method | Response |
|----------|--------|----------|
| `/api/uploads/{filename}` | GET | Serves uploaded image file |
| `/analytics` | GET | `{ total_reports, by_status, by_department }` |
| `/health` | GET | `{ status: "healthy", service: "WhatsApp Bot" }` |

---

## 7. WhatsApp Bot Conversation Flow

A complete citizen interaction looks like this:

```
Citizen                              Bot
───────                              ───
"There is a huge pothole             "Thank you for reporting the
 on MG Road near the market"    →     road damage issue. Could you
                                       please share your location?"

[Shares GPS location]           →    "Location received. Could you
                                      please share a photo of the
                                      pothole so we can assess it?"

[Sends photo of pothole]        →    "✅ COMPLAINT REGISTERED

                                      📄 Report ID: GOV20260314A1B2C3
                                      📝 Pothole on MG Road near market
                                      📍 GPS: 23.3441, 85.3096
                                      🏷  Category: Road Infrastructure
                                      ⚡ Priority: High
                                      🏢 Dept: Public Works Department
                                      ⏰ Est. Resolution: 7 days

                                      We'll keep you updated!"
```

**Audio messages** are transcribed to text by Gemini and then processed normally.
**Invalid inputs** (greetings, unrelated messages) prompt the user to describe an actual complaint.

---

## 8. How the Admin Chatbot Works

The chatbot uses a **LangGraph ReAct (Reasoning + Acting) agent** pattern:

```
Admin: "Which department has the most complaints?"
  │
  ▼
Agent THINKS: "I need to query the database grouped by department"
  │
  ▼
Agent ACTS: complaint_query("SELECT department, COUNT(*) as count
             FROM complaint_reports GROUP BY department
             ORDER BY count DESC LIMIT 1")
  │
  ▼
Agent OBSERVES: "Public Works Department: 18"
  │
  ▼
Agent RESPONDS: "Public Works Department handles the most complaints
                 with 18 total. This suggests road and infrastructure
                 issues are the most common in your area."
```

The agent can handle follow-up questions using chat history context and can run arbitrarily complex SQL queries against the complaint database.

---

## 9. Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 16+
- Google Gemini API key (get at https://aistudio.google.com/apikey)
- WhatsApp Business API credentials (for WhatsApp bot functionality)

### Backend

```bash
cd Backend
python3 -m venv venv
source venv/bin/activate        # Linux/Mac
# venv\Scripts\activate         # Windows

pip install -r requirements.txt

cp .env.example .env
# Edit .env with your API keys:
#   GEMINI_API_KEY=your_key
#   GOOGLE_API_KEY=your_key
#   WHATSAPP_TOKEN=your_token       (optional — only for WhatsApp bot)
#   PHONE_NUMBER_ID=your_id         (optional — only for WhatsApp bot)
#   VERIFY_TOKEN=your_verify_token  (optional — only for WhatsApp bot)

python server.py
# Server runs at http://localhost:8000
```

### Frontend

```bash
cd Frontend
npm install

cp .env.example .env
# Default config points to http://localhost:8000/api

npm run dev
# Dev server runs at http://localhost:3000
```

### Required API Keys

| Key | Required For | How to Get |
|-----|-------------|------------|
| `GEMINI_API_KEY` | AI chatbot + complaint classification | https://aistudio.google.com/apikey |
| `GOOGLE_API_KEY` | Gemini AI (workflow) | Same as above |
| `WHATSAPP_TOKEN` | WhatsApp bot | Meta Developer Portal |
| `PHONE_NUMBER_ID` | WhatsApp bot | Meta Developer Portal |
| `VERIFY_TOKEN` | Webhook verification | Any string you choose |

The dashboard (frontend) works without WhatsApp credentials — you only need the Gemini API key for the chatbot feature.

---

## 10. Database

**Engine:** SQLite (file: `whatsapp_bot.db` at project root)

**complaint_reports** — Stores all submitted complaints

| Column | Type | Description |
|--------|------|-------------|
| `report_id` | TEXT (PK) | Unique ID, format: `GOV{timestamp}{uuid}` |
| `session_id` | TEXT | Links to the user session |
| `phone_number` | TEXT | Citizen's WhatsApp number |
| `description` | TEXT | Full complaint description |
| `coordinates` | TEXT | Location (e.g., "GPS: 23.5, 85.3") |
| `image_path` | TEXT | Path to uploaded image |
| `category` | TEXT | AI-classified category |
| `priority` | TEXT | low / medium / high / very_high |
| `department` | TEXT | Assigned government department |
| `resolution_days` | INTEGER | Estimated days to resolve |
| `status` | TEXT | submitted / in_progress / resolved |
| `created_at` | TEXT | Submission timestamp |
| `updated_at` | TEXT | Last update timestamp |

**user_sessions** — Tracks in-progress WhatsApp conversations

| Column | Type | Description |
|--------|------|-------------|
| `session_id` | TEXT (PK) | Unique session ID |
| `phone_number` | TEXT | User's WhatsApp number |
| `session_status` | TEXT | active / closed |
| `complaint_text` | TEXT | Complaint being collected |
| `coordinates` | TEXT | Location being collected |
| `image_data` | BLOB | Temporary image storage |
| `expires_at` | TEXT | 24-hour TTL |

---

## 11. Tech Stack Summary

### Backend
| Technology | Purpose |
|------------|---------|
| FastAPI | Web framework + REST API |
| Uvicorn | ASGI server |
| SQLite | Database |
| Google Gemini AI | Text understanding, image analysis, classification |
| LangChain + LangGraph | ReAct agent framework for admin chatbot |
| python-dotenv | Environment variable management |
| Pydantic | Data validation and serialization |

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool and dev server |
| Tailwind CSS | Styling |
| Radix UI | Accessible UI component primitives |
| Recharts | Bar and pie charts |
| Mapbox GL | Interactive map |
| Lucide React | Icons |

---

## 12. Key Design Decisions

1. **WhatsApp as the citizen interface** — No need for citizens to install a separate app. WhatsApp is already ubiquitous in India, making adoption frictionless.

2. **AI-driven classification** — Gemini analyzes complaint text + images to automatically assign category, priority, department, and estimated resolution time. This eliminates manual triage.

3. **State machine workflow** — Enforces a strict complaint → location → image flow. Prevents incomplete submissions and ensures data quality.

4. **ReAct agent for admin chatbot** — Instead of building dozens of specific query endpoints, a single AI agent can answer arbitrary data questions by generating SQL on the fly.

5. **Session-based conversations** — 24-hour session TTL prevents abandoned conversations from lingering. Each phone number gets one active session at a time.

6. **Separation of sessions and reports** — `user_sessions` holds temporary in-progress data; `complaint_reports` holds finalized complaints. This keeps the reports table clean.

7. **SQLite for MVP** — Simple, zero-config database perfect for prototyping. Production deployment should migrate to PostgreSQL.

8. **Mapbox for geographic visualization** — Enables spatial analysis of complaint density across Jharkhand districts.
