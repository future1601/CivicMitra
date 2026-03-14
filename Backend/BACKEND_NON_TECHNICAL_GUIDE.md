# How Our Backend Works

This document explains the backend in plain language for someone who does not read code.

## What the backend does

The backend is the part of the system that listens to incoming WhatsApp messages, understands what the citizen is reporting, stores the complaint, and then makes that complaint available to the dashboard and chatbot.

In simple terms, it does five jobs:

1. Receives messages from WhatsApp.
2. Guides the citizen through the complaint process.
3. Uses AI to understand the complaint, location, and photo.
4. Saves the complaint in the database.
5. Shares complaint data with the admin dashboard and the analytics chatbot.

## The complaint journey, step by step

Here is the main flow a citizen goes through:

1. A citizen sends a WhatsApp message.
2. The backend checks whether this person already has an active complaint session.
3. If not, it creates a new session for that phone number.
4. The backend accepts the complaint in text or audio form.
5. If the message is just a greeting like "hi" or "hello", the bot asks the person to describe the actual problem.
6. Once the issue is understood, the backend asks for the location.
7. The location can come in two ways:
   - typed as an area or address
   - shared as a WhatsApp location pin
8. After location is received, the backend asks for a photo of the issue.
9. The backend uses AI to check whether the photo matches the complaint.
10. If the photo matches, the system creates a complaint record and generates a report ID.
11. The citizen receives a confirmation message showing:
   - report ID
   - complaint description
   - location
   - category
   - priority
   - department
   - estimated resolution time

If something is missing, the bot keeps asking for the next required item instead of registering the complaint too early.

## What AI is doing in this backend

AI is used in several places:

- It checks whether the first message is really a complaint or just a greeting.
- It turns audio complaints into text.
- It checks whether a typed location looks valid enough to use.
- It creates short, natural replies so the conversation feels less robotic.
- It checks whether the uploaded image matches the issue being reported.
- It classifies the complaint into a category, priority level, department, and estimated resolution time.

So the AI is not only chatting. It is helping the backend decide whether the complaint has enough information to be properly registered.

## What gets stored

The system currently stores data in a local SQLite database file named `whatsapp_bot.db`.

There are two main kinds of records:

### 1. Temporary conversation sessions

These keep track of what the citizen has already shared during the conversation, such as:

- phone number
- complaint text
- coordinates or typed location
- session status
- timestamps
- expiry time

This allows the backend to continue the conversation instead of starting from the beginning every time a new WhatsApp message arrives.

In the current design, these sessions are intended to stay active for about 24 hours unless the complaint is completed earlier.

### 2. Final complaint reports

Once a complaint is complete, the backend stores:

- report ID
- phone number
- session ID
- complaint description
- location
- image path
- category
- priority
- department
- expected resolution days
- complaint status
- creation and update timestamps

The complaint status starts as `submitted`. The data model also supports later statuses such as `in_progress` and `resolved`.

## Where images are stored

Complaint photos are saved locally on the server, and the complaint record stores the path to that photo.

This means the current design is a local-storage setup, not a cloud file-storage setup.

## The main backend files and what they mean

These are the main backend files in plain language:

- `server.py`
  This is the front door. It receives WhatsApp webhook messages, sends replies back to WhatsApp, and exposes dashboard and chatbot APIs.

- `workflow.py`
  This is the conversation brain. It decides what the bot should ask next and when a complaint is complete enough to save.

- `models.py`
  This defines the structure of the data the backend uses, such as complaint state, image analysis result, and audio transcription result.

- `database.py`
  This creates and manages the local database tables for complaint reports and user sessions.

- `chatbot.py`
  This powers the dashboard chatbot. It lets a user ask questions like "show recent complaints" or "how many high priority complaints do we have?" and answers by reading the complaint database.

- `start_server.py`
  This is a helper file to start the backend server locally.

- `test_chatbot.py`, `test_coordinates.py`, `check_coordinates.py`
  These are support scripts used for testing and checking backend behavior.

## What the dashboard gets from the backend

The backend is not only for WhatsApp. It also gives data to the frontend dashboard.

The dashboard can ask the backend for:

- all complaint reports
- complaint statistics
- complaint locations for map view
- filter options such as category, priority, department, and status
- details for one specific complaint
- chatbot answers based on the database

So one backend supports both sides of the product:

- the citizen-facing WhatsApp experience
- the admin-facing dashboard experience

## A simple picture of the whole flow

Citizen on WhatsApp
-> backend receives message
-> backend continues or creates session
-> AI checks complaint text or audio
-> backend asks for location
-> backend asks for photo
-> AI validates and classifies the complaint
-> backend saves complaint in database
-> dashboard and chatbot can now use that complaint data

## External services the backend depends on

The current backend depends on these outside services:

- WhatsApp Business API
  Used to receive messages and send replies.

- Google Gemini
  Used for AI tasks such as validation, transcription, image analysis, and chatbot responses.

- SQLite
  Used as the local database.

- FastAPI
  Used to run the backend service and expose APIs.

## Important practical notes

These points are important for understanding the backend honestly:

- The real working path today is mainly: WhatsApp message -> workflow -> complaint saved in `complaint_reports`.
- The backend does classify a complaint into a department, but it does not currently send that complaint into an external government system. It stores the complaint locally.
- The system is currently designed around one local database file and local image storage, so it is best described as a local or single-server setup.
- Some older helper code still exists in the backend, but the main complaint registration flow described above is the active one.

## One-sentence summary

The backend acts like a smart intake desk: it talks to citizens on WhatsApp, collects the right details in the right order, uses AI to understand the complaint, saves everything in a local database, and then makes that information available to the dashboard and chatbot.
