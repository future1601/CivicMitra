# CivicConnect

CivicConnect is an AI-powered civic intelligence, grievance redressal, and emergency-response platform built for hackathon-scale public sector operations.

It combines:

- a citizen-facing WhatsApp complaint workflow
- an admin-facing web command dashboard
- AI-assisted complaint understanding and classification
- CCTV-linked incident escalation for fights, falls, accidents, suspicious activity, and broader calamity-response scenarios
- a voice-calling agent layer for broadcast alerts and structured information collection

In practical terms, CivicConnect is positioned as more than a complaint portal. It is the operational core of a multimodal governance stack that can ingest citizen complaints, process live public-safety incidents, escalate them through voice workflows, and give authorities a single administrative surface for monitoring and action.

## What The Project Does

At a high level, CivicConnect helps collect public complaints, structure them, and present them to an operator-friendly dashboard.

Core capabilities:

- accept complaints from WhatsApp users
- guide the user through complaint text, location, and image submission
- use Gemini to validate and classify the complaint
- save structured reports in SQLite
- display those reports on an admin dashboard with charts, map layers, and filters
- provide an AI chatbot for database-backed admin queries
- receive detector-originated alerts from live vision pipelines
- escalate emergencies through a Twilio-driven voice agent
- support both broadcast alert calls and collect-details call flows
- serve as the administrative layer for broader calamity and emergency-response workflows

## Architecture

```text
Citizens -> WhatsApp Cloud API ----------------------------+
                                                          |
CCTV / Smart Vision Detectors -> Incident Alert Payloads -+-> CivicConnect Backend -> SQLite
                                                          |          |
                                                          |          +-> Gemini AI
                                                          |          +-> Uploaded evidence storage
                                                          |          +-> Admin REST APIs
                                                          |          +-> Calling-service proxy
                                                          |                     |
                                                          |                     +-> Twilio + Voice Agent
                                                          |
Admin Dashboard (React + Vite) ---------------------------+
```

## Repository Layout

```text
CivicConnect/
|-- Backend/
|   |-- server.py
|   |-- workflow.py
|   |-- chatbot.py
|   |-- database.py
|   |-- models.py
|   |-- requirements.txt
|   |-- start_server.py
|   |-- .env.example
|   `-- uploads/
|-- Frontend/
|   |-- src/
|   |   |-- App.tsx
|   |   |-- components/
|   |   |-- services/
|   |   |-- hooks/
|   |   `-- styles/
|   |-- package.json
|   |-- vite.config.ts
|   `-- .env.example
|-- PROJECT_DOCUMENTATION.md
|-- .gitignore
`-- README.md
```

## Broader Solution Stack

Within the larger workspace, CivicConnect acts as the administrative and orchestration layer for a wider public-safety stack.

Companion modules currently used with it include:

- `testproj/detection_services/fall_fight_detection.py`
  Pose-based live detection for falls and fights.
- `testproj/detection_services/accident_suspicious_detection.py`
  Vehicle accident and suspicious-activity detection.
- `testproj/newservice/calling_service`
  FastAPI + Twilio voice service for outbound alerting and collect-details call flows.
- `testproj/newservice/detection_service`
  Helper client layer used by detector services to trigger broadcast or collect-details requests.

This means the full hackathon narrative is:

- citizen grievance intake through WhatsApp
- AI-assisted complaint understanding
- real-time CCTV anomaly detection
- emergency call escalation through a voice agent
- unified monitoring through the CivicConnect admin dashboard

## Frontend Overview

The frontend is a React 18 + TypeScript administrative command surface built with Vite, Radix UI primitives, Recharts, and Mapbox GL.

Main dashboard tabs:

- `Home`
  Combines the overview surface, map snapshot, statistics, and calling summary.
- `Map`
  Full geographic complaint monitoring view.
- `Complaints`
  Searchable and filterable complaint queue with detail drill-down.
- `Calls`
  Read-only monitoring surface for the emergency voice-agent integration, detector-facing endpoints, and collected call data.
- `Chatbot`
  Natural-language interface for complaint-data queries backed by the backend chatbot API.

Important frontend files:

- `Frontend/src/App.tsx`
  Main shell and state-based tab routing.
- `Frontend/src/components/Navigation.tsx`
  Top navigation bar.
- `Frontend/src/components/Heatmap.tsx`
  Map page integration.
- `Frontend/src/components/StatisticsSection.tsx`
  Charts and summary cards.
- `Frontend/src/components/ComplaintsTable.tsx`
  Complaint list and filters.
- `Frontend/src/components/ComplaintDetails.tsx`
  Single complaint detail view.
- `Frontend/src/components/ChatbotPage.tsx`
  Admin AI chat interface.
- `Frontend/src/components/CallingConsolePage.tsx`
  Calling-service status and transcript monitoring.
- `Frontend/src/services/api.ts`
  Frontend API client and response types.

## Backend Overview

The backend is a FastAPI application that handles both citizen messaging workflows and admin/dashboard APIs.

Main backend responsibilities:

- receive and verify WhatsApp webhooks
- manage complaint intake sessions
- validate and classify complaint data with Gemini
- persist sessions and completed reports in SQLite
- serve analytics and filter data to the dashboard
- serve uploaded images
- provide a chatbot endpoint for admin users
- ingest detector-originated incident payloads
- proxy the voice-agent calling service for emergency alert workflows

Important backend files:

- `Backend/server.py`
  Main FastAPI app, routes, webhook handling, REST API, and calling-service proxy endpoints.
- `Backend/workflow.py`
  Complaint state machine and Gemini-backed intake logic.
- `Backend/chatbot.py`
  Admin chatbot integration for database-backed queries.
- `Backend/database.py`
  SQLite schema setup and CRUD operations.
- `Backend/models.py`
  Pydantic-style state and payload models.
- `Backend/start_server.py`
  Local dev startup helper.

## Citizen Complaint Flow

The WhatsApp intake flow is designed as a guided conversation rather than a single raw form submission.

Typical flow:

1. A citizen messages the WhatsApp bot.
2. The backend either resumes an active session or creates a new one.
3. The citizen submits the issue as text or audio.
4. Gemini validates whether the message is a genuine complaint.
5. The backend asks for location.
6. The citizen can respond with typed location text or a WhatsApp location pin.
7. The backend asks for an image of the issue.
8. Gemini validates that the image matches the complaint and classifies the issue.
9. The backend generates a report ID and stores the complaint.
10. The citizen receives a structured acknowledgement including category, priority, department, and expected resolution time.

## Admin Dashboard Flow

The admin dashboard consumes backend APIs and turns stored complaints into an operational workspace.

What the dashboard supports:

- overview metrics and charts
- geographic clustering and complaint map review
- queue-based complaint review
- complaint detail inspection including image preview
- chatbot-assisted querying of complaint data
- monitoring of calling-service health and collected transcripts

## Real-Time Incident Intelligence Layer

Beyond WhatsApp complaint intake, CivicConnect is also integrated into a real-time incident-response pipeline.

Current live-event use cases represented in the wider system:

- fall detection
- fight detection
- accident detection
- suspicious public-safety activity
- extensible calamity-response escalation scenarios

Current detector services generate structured incident payloads that can include:

- issue summary
- spoken alert message
- priority
- department
- category
- resolution estimate
- location or camera label
- camera ID
- detection timestamp
- optional base64-encoded evidence image

Those payloads are received by CivicConnect, normalized into dashboard-visible records, and then forwarded into the voice-alert layer when escalation is required.

This makes the platform useful not only for citizen-initiated complaints, but also for machine-detected emergency incidents from surveillance infrastructure.

## Voice Agent And Emergency Calling Layer

The calling workflow is a core hackathon feature, not a side utility.

CivicConnect includes backend routes and frontend monitoring for a dedicated calling service used for:

- broadcast alert calls
- collect-details calls that gather spoken issue and location information

The calling service itself runs as a dedicated FastAPI service and is integrated into CivicConnect through backend proxy routes. In the current workspace, that service lives under `testproj/newservice/calling_service`.

This layer is responsible for:

- calling responders or designated contacts
- speaking AI-generated emergency alerts
- collecting spoken information back from users
- transcribing issue details and exact locations
- syncing collected transcripts back into CivicConnect

The CivicConnect backend connects to that service through:

- `NEW_CALLING_SERVICE_BASE_URL`
- `CIVICCONNECT_PUBLIC_BASE_URL`
- `NEW_CALLING_SERVICE_PUBLIC_BASE_URL`

Relevant backend route groups:

- `GET /api/calling/status`
- `POST /api/calling/broadcast`
- `POST /api/calling/collect-details`
- `POST /api/calls/broadcast`
- `POST /api/calls/collect-details`
- `GET /api/calling/collected-records`
- `GET|POST /webhooks/twilio/call-flow`
- `GET|HEAD /audio/{filename}`

This lets CivicConnect act as the public orchestration layer while the calling service handles Twilio webhooks, audio generation, and transcription flows behind it.

## Data Model

The SQLite database currently contains three main tables.

### `complaint_reports`

Stores completed complaints.

Key fields:

- `report_id`
- `session_id`
- `phone_number`
- `description`
- `coordinates`
- `image_path`
- `category`
- `priority`
- `department`
- `resolution_days`
- `status`
- `created_at`
- `updated_at`

### `user_sessions`

Stores in-progress complaint conversations.

Key fields:

- `session_id`
- `phone_number`
- `session_status`
- `complaint_text`
- `coordinates`
- `image_data`
- `created_at`
- `updated_at`
- `expires_at`

### `collected_call_records`

Stores synchronized results from collect-details call workflows.

Key fields:

- `token`
- `flow`
- `call_sid`
- `phone_number`
- `prompt`
- `recording_url`
- `transcript`
- `created_at`
- `completed_at`
- `status`
- `raw_payload`
- `synced_at`

## Main API Surface

The backend exposes several groups of routes.

### WhatsApp Webhook

- `GET /webhook`
- `POST /webhook`
- `GET /`
- `POST /`

These are used for webhook verification and inbound WhatsApp message handling.

### Reports And Analytics

- `GET /api/reports`
- `GET /api/reports/{report_id}`
- `GET /api/reports/stats`
- `GET /api/reports/by-location`
- `GET /api/filter-options`
- `GET /analytics`
- `GET /reports/{phone_number}`

### Chatbot

- `POST /api/chatbot/message`
- `GET /api/chatbot/stats`

### Uploads And Health

- `GET /api/uploads/{filename}`
- `GET /health`

### Calling Integration

- `GET /api/calling/status`
- `POST /api/calls/broadcast`
- `POST /api/calls/collect-details`
- `GET /api/calling/collected-records`

## Tech Stack

### Backend

- FastAPI
- Uvicorn
- SQLite
- Requests
- Python-dotenv
- Google Gemini SDKs
- LangChain / LangChain Google GenAI integration

### Frontend

- React 18
- TypeScript
- Vite
- Lucide React
- Mapbox GL
- Recharts
- Radix UI

## Local Development Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm
- a Gemini API key
- WhatsApp Cloud API credentials if you want to test the citizen workflow
- Mapbox public token for map rendering

## Backend Setup

From the `CivicConnect/Backend` directory:

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create `Backend/.env` from `Backend/.env.example` and provide values for:

```env
WHATSAPP_TOKEN=...
PHONE_NUMBER_ID=...
VERIFY_TOKEN=...
GEMINI_API_KEY=...
DATABASE_URL=whatsapp_bot.db
HOST=0.0.0.0
PORT=8000
DEBUG=False
```

Calling integration variables:

```env
NEW_CALLING_SERVICE_BASE_URL=http://127.0.0.1:5002
CIVICCONNECT_PUBLIC_BASE_URL=https://your-public-backend-url
NEW_CALLING_SERVICE_PUBLIC_BASE_URL=https://your-public-backend-url
CALLING_SERVICE_TIMEOUT=15
```

Start the backend:

```bash
python server.py
```

or:

```bash
python start_server.py
```

Default backend URL:

```text
http://localhost:8000
```

## Frontend Setup

From the `CivicConnect/Frontend` directory:

```bash
npm install
```

Create `Frontend/.env` from `Frontend/.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_public_token
VITE_APP_NAME=Admin Dashboard
VITE_APP_VERSION=1.0.0
```

Start the frontend:

```bash
npm run dev
```

Default frontend URL:

```text
http://localhost:3000
```

## Running The Full Local Stack

Run the backend first:

```bash
cd Backend
python server.py
```

Then run the frontend:

```bash
cd Frontend
npm run dev
```

For the full emergency-response flow, also run the separate calling service and point CivicConnect at it with `NEW_CALLING_SERVICE_BASE_URL`.

For the full hackathon demonstration, the typical stack is:

1. CivicConnect backend on `8000`
2. CivicConnect frontend on `3000`
3. calling service on `5002`
4. one or more detector services on a separate machine or process

Typical demonstration flow:

1. A citizen files a complaint on WhatsApp, or a detector identifies a live incident.
2. CivicConnect stores and structures the incident.
3. The admin dashboard immediately reflects the complaint or CCTV event.
4. If escalation is required, CivicConnect forwards the request to the voice agent.
5. Twilio places the outbound call and can collect spoken details back into the platform.

## Frontend To Backend Contract

The frontend expects the backend API base URL to point at `/api`.

Example:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

The backend itself still exposes some non-`/api` routes for WhatsApp webhooks and health checks.

## File Uploads

Complaint images are stored on disk under backend uploads directories, and the frontend accesses them through:

- `GET /api/uploads/{filename}`

Detector-originated images can also be normalized into backend storage so they appear in the complaint detail view.

## Environment Variables Summary

### Backend

- `WHATSAPP_TOKEN`
- `PHONE_NUMBER_ID`
- `VERIFY_TOKEN`
- `GEMINI_API_KEY`
- `DATABASE_URL`
- `HOST`
- `PORT`
- `DEBUG`
- `NEW_CALLING_SERVICE_BASE_URL`
- `NEW_CALLING_SERVICE_PUBLIC_BASE_URL`
- `CIVICCONNECT_PUBLIC_BASE_URL`
- `CALLING_SERVICE_TIMEOUT`
- `GEMINI_CHAT_MODEL` or `GEMINI_MODEL` for chatbot model override

### Frontend

- `VITE_API_BASE_URL`
- `VITE_MAPBOX_ACCESS_TOKEN`
- `VITE_APP_NAME`
- `VITE_APP_VERSION`

## Security And Operational Notes

- Do not commit `.env` files.
- Do not commit the live SQLite database.
- Do not commit uploaded user images.
- Rotate credentials immediately if they are ever committed to Git history.
- The Mapbox token used in the frontend is a public browser token, but it should still be scoped and managed properly.

## Troubleshooting

### Frontend cannot reach backend

Check:

- backend is running on port `8000`
- `VITE_API_BASE_URL` points to `http://localhost:8000/api`
- CORS is allowing your frontend dev origin

### WhatsApp webhook verification fails

Check:

- `VERIFY_TOKEN`
- public webhook URL configuration in Meta
- backend is publicly reachable through your tunnel or deployment setup

### Maps do not render

Check:

- `VITE_MAPBOX_ACCESS_TOKEN`
- browser console for blocked token or style-loading errors

### Calling routes show as unavailable

Check:

- `NEW_CALLING_SERVICE_BASE_URL`
- the separate calling service is running
- `CIVICCONNECT_PUBLIC_BASE_URL` is configured when Twilio callbacks need a public route

## Additional Documentation

For deeper details, also see:

- `PROJECT_DOCUMENTATION.md`
- `Backend/BACKEND_NON_TECHNICAL_GUIDE.md`

## Why This Matters

CivicConnect is designed as a unified civic operations stack rather than a narrow complaint form.

It brings together:

- citizen grievance intake
- AI-assisted classification and validation
- CCTV-driven incident intelligence
- emergency voice-call escalation
- structured transcript capture
- administrative analytics, mapping, and review

That combination makes it suitable for a hackathon narrative around smart governance, urban safety, responsive public administration, and real-time civic intelligence.

## Summary

CivicConnect is a full-stack governance and emergency-response platform with:

- a WhatsApp-based citizen complaint interface
- a React administrative dashboard
- Gemini-assisted complaint and incident understanding
- CCTV-linked fall, fight, accident, and suspicious-activity escalation
- a voice-agent calling layer for emergency alerts and data collection
- SQLite persistence and uploaded evidence handling
- map, analytics, and chatbot-driven operational visibility
