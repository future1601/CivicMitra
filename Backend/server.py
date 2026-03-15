from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import base64
import requests
import os
import json
import uuid
import sqlite3
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from database import WhatsAppBotDatabase
from workflow import ComplaintWorkflow
from models import ComplaintState
from chatbot import ComplaintChatbot
from typing import List, Dict, Any, Optional, Literal

# Load environment variables
load_dotenv()

app = FastAPI(title="WhatsApp Government Complaint Bot")

# Add CORS middleware for Frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:4173"],  # Common dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
db = WhatsAppBotDatabase()
workflow = ComplaintWorkflow()
chatbot = ComplaintChatbot()

# WhatsApp API configuration
VERIFY_TOKEN = os.getenv("VERIFY_TOKEN", "my_verify_token")
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
PHONE_NUMBER_ID = os.getenv("PHONE_NUMBER_ID")
CALLING_SERVICE_BASE_URL = os.getenv(
    "NEW_CALLING_SERVICE_BASE_URL",
    "http://127.0.0.1:5002",
).rstrip("/")
CALLING_SERVICE_PUBLIC_BASE_URL = os.getenv(
    "NEW_CALLING_SERVICE_PUBLIC_BASE_URL",
    os.getenv("CALLING_SERVICE_PUBLIC_BASE_URL", ""),
).rstrip("/")
CIVICCONNECT_PUBLIC_BASE_URL = os.getenv(
    "CIVICCONNECT_PUBLIC_BASE_URL",
    "",
).rstrip("/")
CALLING_SERVICE_TIMEOUT = float(os.getenv("CALLING_SERVICE_TIMEOUT", "15"))
PROJECT_ROOT = Path(__file__).resolve().parents[2]
CALLING_SERVICE_COLLECTED_CALLS_FILE = (
    PROJECT_ROOT
    / "testproj"
    / "newservice"
    / "calling_service"
    / "storage"
    / "collected_calls.json"
)

def get_or_create_session(phone_number: str) -> dict:
    """Get existing session or create new one"""
    print(f"🔍 Looking for session for phone: {phone_number}")
    
    # Check for existing active session
    session = db.get_user_session(phone_number)
    
    if not session:
        print(f"📞 Creating new session for: {phone_number}")
        session_id = db.create_user_session(phone_number)
        session = {
            "session_id": session_id,
            "phone_number": phone_number,
            "status": "active"
        }
        print(f"✅ Created new session: {session_id}")
    else:
        print(f"🔄 Found existing session: {session['session_id']} - Status: {session.get('status')}")
    
    return session

def save_completed_report(state: ComplaintState, session: dict) -> str:
    """Save completed report to database"""
    print(f"📊 Saving completed report: {state.report_id}")
    
    # Prepare report data
    report_data = {
        "report_id": state.report_id,
        "citizen_phone": state.phone_number,
        "session_id": session["session_id"],
        "description": state.complaint_text or state.image_analysis.description,
        "category": state.image_analysis.category or "general",
        "priority": state.image_analysis.priority or "medium",
        "coordinates": state.coordinates,
        "department": state.image_analysis.department or "General Administration",
        "resolution_days": state.image_analysis.resolution_days or 7,
        "submitted_at": datetime.now().isoformat(),
        "image_analysis": json.dumps(state.image_analysis.dict()) if state.image_analysis else None
    }
    
    # Save to database
    db.save_government_report(report_data)
    
    # Mark session as completed
    db.update_user_session(session["session_id"], {"session_status": "closed"})
    
    return state.report_id

def save_image_to_storage(image_data: bytes, report_id: str) -> str:
    """Save image to local storage"""
    os.makedirs("uploads/reports", exist_ok=True)
    file_path = f"uploads/reports/{report_id}.jpg"
    
    with open(file_path, "wb") as f:
        f.write(image_data)
    
    return file_path

def download_whatsapp_media(media_id: str) -> bytes:
    """Download media from WhatsApp"""
    # Get media URL
    media_url_response = requests.get(
        f"https://graph.facebook.com/v20.0/{media_id}",
        headers={"Authorization": f"Bearer {WHATSAPP_TOKEN}"}
    )
    media_url = media_url_response.json().get("url")
    
    # Download media content
    media_response = requests.get(
        media_url,
        headers={"Authorization": f"Bearer {WHATSAPP_TOKEN}"}
    )
    
    return media_response.content

def send_whatsapp_message(to_number: str, message: str):
    """Send message to WhatsApp"""
    url = f"https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "text",
        "text": {"body": message}
    }
    
    print(f"📤 Sending message to {to_number}: {message[:50]}...")
    
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code == 200:
        print("✅ Message sent successfully!")
    else:
        print(f"❌ Failed to send message: {response.status_code}")
        print(f"Response: {response.text}")


def build_calling_service_url(path: str) -> str:
    return f"{CALLING_SERVICE_BASE_URL}{path}"


def calling_service_public_endpoint(path: str) -> str | None:
    if not CALLING_SERVICE_PUBLIC_BASE_URL:
        return None
    return f"{CALLING_SERVICE_PUBLIC_BASE_URL}{path}"


def civicconnect_public_endpoint(path: str) -> str | None:
    if not CIVICCONNECT_PUBLIC_BASE_URL:
        return None
    return f"{CIVICCONNECT_PUBLIC_BASE_URL}{path}"


def parse_report_coordinates(
    raw_coordinates: Optional[str],
) -> tuple[Optional[Dict[str, float]], float, float, str]:
    coordinates = None
    location_lat = 0.0
    location_lon = 0.0
    address_extracted = "No location"

    if not raw_coordinates:
        return coordinates, location_lat, location_lon, address_extracted

    coords_str = raw_coordinates.strip()

    try:
        if coords_str.startswith("GPS: "):
            coords_part = coords_str[5:]
            lat_str, lng_str = coords_part.split(", ")
            location_lat = float(lat_str.strip())
            location_lon = float(lng_str.strip())
            coordinates = {"lat": location_lat, "lng": location_lon}
            address_extracted = f"Lat: {location_lat}, Lng: {location_lon}"
            return coordinates, location_lat, location_lon, address_extracted

        coord_data = json.loads(coords_str)
        if isinstance(coord_data, dict) and "lat" in coord_data and "lng" in coord_data:
            location_lat = float(coord_data["lat"])
            location_lon = float(coord_data["lng"])
            coordinates = {"lat": location_lat, "lng": location_lon}
            address_extracted = str(
                coord_data.get("label")
                or coord_data.get("address")
                or f"Lat: {location_lat}, Lng: {location_lon}"
            )
            return coordinates, location_lat, location_lon, address_extracted
    except (json.JSONDecodeError, ValueError, TypeError, IndexError):
        pass

    address_extracted = coords_str
    return coordinates, location_lat, location_lon, address_extracted


def create_detector_location(
    location: Optional[str],
    source: Optional[str],
    camera_id: Optional[str],
) -> str:
    cleaned_location = (location or "").strip()
    cleaned_source = (source or "CCTV").strip() or "CCTV"
    cleaned_camera_id = (camera_id or "").strip()

    if cleaned_location:
        return cleaned_location
    if cleaned_camera_id:
        return f"{cleaned_source} Camera {cleaned_camera_id}"
    return cleaned_source


def normalize_detector_timestamp(raw_value: Optional[str]) -> str:
    cleaned_value = (raw_value or "").strip()
    if not cleaned_value:
        return datetime.now().isoformat(timespec="seconds")

    try:
        normalized = datetime.fromisoformat(cleaned_value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.now().isoformat(timespec="seconds")

    return normalized.isoformat(timespec="seconds")


def decode_detector_image(image_base64: Optional[str]) -> bytes | None:
    encoded = (image_base64 or "").strip()
    if not encoded:
        return None

    if "," in encoded:
        encoded = encoded.split(",", 1)[1]

    padding = len(encoded) % 4
    if padding:
        encoded += "=" * (4 - padding)

    try:
        return base64.b64decode(encoded, validate=False)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image_base64 payload: {exc}") from exc


def load_calling_service_collected_calls() -> List[Dict[str, Any]]:
    if not CALLING_SERVICE_COLLECTED_CALLS_FILE.exists():
        return []

    try:
        with open(CALLING_SERVICE_COLLECTED_CALLS_FILE, "r", encoding="utf-8") as file_obj:
            data = json.load(file_obj)
    except (OSError, json.JSONDecodeError):
        return []

    return data if isinstance(data, list) else []


def sync_collected_call_records() -> int:
    synced_count = 0

    for record in load_calling_service_collected_calls():
        token = str(record.get("token", "")).strip()
        if not token or db.collected_call_exists(token):
            continue

        db.save_collected_call_record(record)
        synced_count += 1

    return synced_count


def trigger_calling_service_broadcast(number: str, message: str) -> Dict[str, Any]:
    try:
        response = requests.post(
            build_calling_service_url("/api/calls/broadcast"),
            json={"number": number, "message": message},
            timeout=CALLING_SERVICE_TIMEOUT,
        )
    except requests.RequestException as exc:
        print(f"❌ Error reaching calling service: {exc}")
        raise HTTPException(
            status_code=502,
            detail=f"Calling service unreachable: {exc}",
        ) from exc

    if not response.ok:
        try:
            error_payload = response.json()
        except ValueError:
            error_payload = {"detail": response.text or "Calling service request failed"}
        raise HTTPException(status_code=response.status_code, detail=error_payload)

    return response.json()


def trigger_calling_service_collect_details(
    number: str,
    prompt: str,
    location_prompt: str,
) -> Dict[str, Any]:
    try:
        response = requests.post(
            build_calling_service_url("/api/calls/collect-details"),
            json={
                "number": number,
                "prompt": prompt,
                "location_prompt": location_prompt,
            },
            timeout=CALLING_SERVICE_TIMEOUT,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Calling service unreachable: {exc}",
        ) from exc

    if not response.ok:
        try:
            error_payload = response.json()
        except ValueError:
            error_payload = {"detail": response.text or "Calling service request failed"}
        raise HTTPException(status_code=response.status_code, detail=error_payload)

    return response.json()


async def proxy_calling_service_request(request: Request, path: str) -> Response:
    target_url = build_calling_service_url(path)
    flow = request.query_params.get("flow", "").strip()
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"

    headers = {}
    content_type = request.headers.get("content-type")
    if content_type:
        headers["content-type"] = content_type

    body = await request.body()

    try:
        upstream = requests.request(
            method=request.method,
            url=target_url,
            data=body if body else None,
            headers=headers,
            timeout=CALLING_SERVICE_TIMEOUT,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Calling service proxy failed: {exc}",
        ) from exc

    media_type = upstream.headers.get("content-type", "application/octet-stream")
    if ";" in media_type:
        media_type = media_type.split(";", 1)[0].strip()

    if path == "/webhooks/twilio/call-flow" and flow == "collect":
        synced_count = sync_collected_call_records()
        if synced_count:
            print(f"Synced {synced_count} collected call record(s) into CivicConnect DB.")

    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        media_type=media_type,
    )


def create_detector_report(payload: "DetectorBroadcastPayload") -> Dict[str, str]:
    report_id = str(uuid.uuid4())
    source_name = (payload.source or "CCTV").strip() or "CCTV"
    submitted_at = normalize_detector_timestamp(payload.detected_at)
    description = (payload.issue or payload.message).strip()
    location_label = create_detector_location(
        payload.location,
        payload.source,
        payload.camera_id,
    )
    image_bytes = decode_detector_image(payload.image_base64)
    image_path = save_image_to_storage(image_bytes, report_id) if image_bytes else None

    db.save_government_report(
        {
            "report_id": report_id,
            "session_id": f"detection-{uuid.uuid4()}",
            "citizen_phone": source_name,
            "description": description,
            "coordinates": location_label,
            "image_path": image_path,
            "category": payload.category or "public_safety",
            "priority": payload.priority or "very_high",
            "department": payload.department or "Public Safety Department",
            "resolution_days": payload.resolution_days or 1,
            "submitted_at": submitted_at,
        }
    )

    return {
        "report_id": report_id,
        "source": source_name,
        "location": location_label,
        "submitted_at": submitted_at,
        "image_path": image_path or "",
    }

@app.get("/")
@app.get("/webhook")
async def verify_webhook(request: Request):
    """Verify WhatsApp webhook"""
    params = dict(request.query_params)
    if params.get("hub.verify_token") == VERIFY_TOKEN:
        return int(params["hub.challenge"])
    return "Invalid verification token"

@app.post("/")
@app.post("/webhook")
async def receive_webhook(request: Request):
    """Handle incoming WhatsApp messages"""
    data = await request.json()
    print(f"📨 Received webhook data")
    
    try:
        changes = data["entry"][0]["changes"][0]["value"]
        
        if "messages" in changes:
            msg = changes["messages"][0]
            from_number = msg["from"]
            msg_type = msg.get("type")
            
            print(f"👤 From: {from_number}, Type: {msg_type}")
            
            # Get or create user session
            session = get_or_create_session(from_number)
            
            # Check if session is already completed
            if session.get("status") == "completed":
                reply = "Thank you! Your report has been submitted. For a new complaint, please start a fresh conversation."
                send_whatsapp_message(from_number, reply)
                return {"status": "ok"}
            
            # Create state object
            state = ComplaintState(
                phone_number=from_number,
                session_id=session["session_id"],
                complaint_text=session.get("complaint_text"),
                coordinates=session.get("coordinates")
            )
            
            # Prepare user input based on message type
            user_input = {"type": msg_type}
            
            if msg_type == "text":
                user_input["text"] = msg["text"]["body"]
            
            elif msg_type == "image":
                media_id = msg["image"]["id"]
                image_data = download_whatsapp_media(media_id)
                user_input["image_data"] = image_data
                
                # Save image
                if state.report_id:
                    image_path = save_image_to_storage(image_data, state.report_id)
                    user_input["image_path"] = image_path
            
            elif msg_type == "location":
                user_input["latitude"] = msg["location"]["latitude"]
                user_input["longitude"] = msg["location"]["longitude"]
            
            elif msg_type == "audio":
                media_id = msg["audio"]["id"]
                audio_data = download_whatsapp_media(media_id)
                # Save audio temporarily for processing
                audio_path = f"temp_audio_{session['session_id']}.ogg"
                with open(audio_path, "wb") as f:
                    f.write(audio_data)
                user_input["file_path"] = audio_path
            
            # Process through workflow
            updated_state = workflow.process_message(state, user_input)
            
            # Update session in database - only update fields that exist in the table
            session_updates = {
                "complaint_text": updated_state.complaint_text,
                "coordinates": updated_state.coordinates
            }
            
            # Only update session status when workflow is completed
            if updated_state.status == "completed":
                session_updates["session_status"] = "closed"
            
            db.update_user_session(session["session_id"], session_updates)
            
            # Send reply to user
            reply = updated_state.message or "Please continue with your complaint registration."
            send_whatsapp_message(from_number, reply)
            
            # Clean up temporary files
            if msg_type == "audio" and "file_path" in user_input:
                if os.path.exists(user_input["file_path"]):
                    os.remove(user_input["file_path"])
    
    except Exception as e:
        print(f"❌ Error processing webhook: {e}")
        import traceback
        traceback.print_exc()
    
    return {"status": "ok"}

@app.get("/reports/{phone_number}")
async def get_user_reports(phone_number: str):
    """Get all reports for a user"""
    reports = db.get_reports_by_phone(phone_number)
    return {"reports": reports}

@app.get("/analytics")
async def get_analytics():
    """Get system analytics"""
    analytics = db.get_analytics()
    return analytics

# Dashboard API endpoints for Frontend
@app.get("/api/reports")
async def get_all_reports():
    """Get all complaint reports for the dashboard"""
    try:
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
        SELECT 
            report_id,
            session_id,
            phone_number,
            description,
            coordinates,
            image_path,
            category,
            priority,
            department,
            resolution_days,
            status,
            created_at,
            updated_at
        FROM complaint_reports 
        ORDER BY created_at DESC
        """)
        
        rows = cursor.fetchall()
        conn.close()
        
        reports = []
        for row in rows:
            coordinates, location_lat, location_lon, address_extracted = parse_report_coordinates(row[4])
            
            report = {
                "report_id": row[0],
                "session_id": row[1],
                "citizen_phone": row[2],
                "description": row[3],
                "coordinates": coordinates,
                "image_path": row[5],
                "category": row[6] or "general",
                "priority": row[7] or "medium",
                "department": row[8] or "general",
                "resolution_days": row[9],
                "status": row[10],
                "created_at": row[11],
                "updated_at": row[12],
                # Additional fields for Frontend compatibility
                "location_lat": location_lat,
                "location_lon": location_lon,
                "address_extracted": address_extracted,
            }
            reports.append(report)
        
        return {"success": True, "data": reports}
        
    except Exception as e:
        print(f"❌ Error fetching reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports/stats")
async def get_report_statistics():
    """Get comprehensive report statistics for dashboard"""
    try:
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()
        
        # Basic counts
        cursor.execute("SELECT COUNT(*) FROM complaint_reports")
        total_reports = cursor.fetchone()[0]
        
        # Status breakdown
        cursor.execute("SELECT status, COUNT(*) FROM complaint_reports GROUP BY status")
        status_data = cursor.fetchall()
        by_status = dict(status_data)
        
        # Priority breakdown
        cursor.execute("SELECT priority, COUNT(*) FROM complaint_reports GROUP BY priority")
        priority_data = cursor.fetchall()
        by_priority = dict(priority_data)
        
        # Category breakdown (using department field)
        cursor.execute("SELECT department, COUNT(*) FROM complaint_reports GROUP BY department")
        department_data = cursor.fetchall()
        by_department = dict(department_data)
        
        # Monthly data for the last 6 months
        cursor.execute("""
            SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
            FROM complaint_reports 
            WHERE created_at >= date('now', '-6 months')
            GROUP BY strftime('%Y-%m', created_at)
            ORDER BY month ASC
        """)
        monthly_raw = cursor.fetchall()
        
        # Convert to month names for frontend
        monthly_data = []
        month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        for month_year, count in monthly_raw:
            if month_year:
                year, month = month_year.split('-')
                month_name = month_names[int(month) - 1]
                monthly_data.append({"month": month_name, "complaints": count})
        
        # If no data, provide sample data structure
        if not monthly_data:
            monthly_data = [
                {"month": "Jan", "complaints": 0},
                {"month": "Feb", "complaints": 0},
                {"month": "Mar", "complaints": 0},
                {"month": "Apr", "complaints": 0},
                {"month": "May", "complaints": 0},
                {"month": "Jun", "complaints": 0}
            ]
        
        # This month vs last month statistics
        cursor.execute("""
            SELECT COUNT(*) FROM complaint_reports 
            WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
        """)
        this_month = cursor.fetchone()[0] or 0
        
        cursor.execute("""
            SELECT COUNT(*) FROM complaint_reports 
            WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', '-1 month')
        """)
        last_month = cursor.fetchone()[0] or 1  # Avoid division by zero
        
        # Calculate percentage change
        if last_month > 0:
            total_change = round(((this_month - last_month) / last_month) * 100)
        else:
            total_change = 0 if this_month == 0 else 100
        
        # Resolved this month
        cursor.execute("""
            SELECT COUNT(*) FROM complaint_reports 
            WHERE status = 'resolved' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
        """)
        resolved_this_month = cursor.fetchone()[0] or 0
        
        cursor.execute("""
            SELECT COUNT(*) FROM complaint_reports 
            WHERE status = 'resolved' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', '-1 month')
        """)
        resolved_last_month = cursor.fetchone()[0] or 1
        
        if resolved_last_month > 0:
            resolved_change = round(((resolved_this_month - resolved_last_month) / resolved_last_month) * 100)
        else:
            resolved_change = 0 if resolved_this_month == 0 else 100
        
        # Pending complaints
        pending_count = by_status.get('submitted', 0) + by_status.get('in_progress', 0)
        
        # Calculate average resolution time
        cursor.execute("""
            SELECT AVG(resolution_days) FROM complaint_reports 
            WHERE status = 'resolved' AND resolution_days IS NOT NULL
        """)
        avg_resolution = cursor.fetchone()[0]
        avg_resolution_days = round(avg_resolution, 1) if avg_resolution else 3.2
        
        # Category percentages for pie chart
        total_for_categories = sum(by_department.values()) or 1
        category_data = []
        colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4']
        
        for i, (dept, count) in enumerate(by_department.items()):
            if dept:  # Skip None values
                percentage = round((count / total_for_categories) * 100)
                category_data.append({
                    "name": dept,
                    "value": percentage,
                    "color": colors[i % len(colors)]
                })
        
        # If no data, provide sample structure
        if not category_data:
            category_data = [
                {"name": "General Administration", "value": 100, "color": "#3B82F6"}
            ]
        
        conn.close()
        
        # Comprehensive statistics response
        stats = {
            "cards": {
                "total_complaints": {
                    "value": total_reports,
                    "change": f"+{total_change}%" if total_change >= 0 else f"{total_change}%",
                    "change_type": "increase" if total_change >= 0 else "decrease"
                },
                "resolved_this_month": {
                    "value": resolved_this_month,
                    "change": f"+{resolved_change}%" if resolved_change >= 0 else f"{resolved_change}%",
                    "change_type": "increase" if resolved_change >= 0 else "decrease"
                },
                "pending_review": {
                    "value": pending_count,
                    "change": f"-{abs(total_change - resolved_change)}%",
                    "change_type": "decrease"
                },
                "avg_resolution_time": {
                    "value": f"{avg_resolution_days} days",
                    "change": "-15%",
                    "change_type": "decrease"
                }
            },
            "monthly_data": monthly_data,
            "category_data": category_data,
            "by_status": by_status,
            "by_priority": by_priority,
            "by_department": by_department,
            "total_reports": total_reports
        }
        
        return {"success": True, "data": stats}
        
    except Exception as e:
        print(f"❌ Error fetching comprehensive stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports/by-location")
async def get_reports_by_location(
    category: str = None,
    priority: str = None, 
    department: str = None,
    status: str = None
):
    """Get reports formatted for map display with optional filters"""
    try:
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()
        
        # Build dynamic WHERE clause based on filters
        where_conditions = ["coordinates IS NOT NULL AND coordinates != ''"]
        params = []
        
        if category:
            where_conditions.append("category = ?")
            params.append(category)
            
        if priority:
            where_conditions.append("priority = ?")
            params.append(priority)
            
        if department:
            where_conditions.append("department = ?")
            params.append(department)
            
        if status:
            where_conditions.append("status = ?")
            params.append(status)
        
        where_clause = " AND ".join(where_conditions)
        
        query = f"""
        SELECT 
            report_id,
            description,
            coordinates,
            priority,
            status,
            category,
            department,
            created_at,
            phone_number,
            resolution_days
        FROM complaint_reports 
        WHERE {where_clause}
        ORDER BY created_at DESC
        """
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        locations = []
        for row in rows:
            try:
                # Parse coordinates - handle both JSON format and "GPS: lat, lng" format
                coords_str = row[2]
                if coords_str.startswith("GPS: "):
                    # Handle "GPS: lat, lng" format
                    coords_part = coords_str[5:]  # Remove "GPS: " prefix
                    lat_str, lng_str = coords_part.split(", ")
                    lat = float(lat_str.strip())
                    lng = float(lng_str.strip())
                else:
                    # Handle JSON format
                    coord_data = json.loads(coords_str)
                    lat = float(coord_data["lat"])
                    lng = float(coord_data["lng"])
                
                location = {
                    "lng": lng,
                    "lat": lat,
                    "name": f"Report {row[0][:8]}...",
                    "info": f"Priority: {row[3]}\nStatus: {row[4]}\nCategory: {row[5]}\nDepartment: {row[6]}\nDescription: {row[1][:100]}...",
                    # Add filter data for frontend marker customization
                    "category": row[5],
                    "priority": row[3], 
                    "department": row[6],
                    "status": row[4],
                    "report_id": row[0],
                    # Add detailed complaint information for popup
                    "description": row[1],
                    "created_at": row[7],
                    "phone_number": row[8],
                    "resolution_days": row[9]
                }
                locations.append(location)
            except (json.JSONDecodeError, KeyError, ValueError, TypeError, IndexError) as e:
                print(f"⚠️ Skipping invalid coordinates for report {row[0]}: {e}")
                continue
        
        return {"success": True, "data": locations}
        
    except Exception as e:
        print(f"❌ Error fetching locations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/filter-options")
async def get_filter_options():
    """Get all available filter options from the database"""
    try:
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()
        
        # Get unique categories
        cursor.execute("SELECT DISTINCT category FROM complaint_reports WHERE category IS NOT NULL ORDER BY category")
        categories = [row[0] for row in cursor.fetchall()]
        
        # Get unique priorities
        cursor.execute("SELECT DISTINCT priority FROM complaint_reports WHERE priority IS NOT NULL ORDER BY priority")
        priorities = [row[0] for row in cursor.fetchall()]
        
        # Get unique departments
        cursor.execute("SELECT DISTINCT department FROM complaint_reports WHERE department IS NOT NULL ORDER BY department")
        departments = [row[0] for row in cursor.fetchall()]
        
        # Get unique statuses
        cursor.execute("SELECT DISTINCT status FROM complaint_reports WHERE status IS NOT NULL ORDER BY status")
        statuses = [row[0] for row in cursor.fetchall()]
        
        conn.close()
        
        # Return both actual data and schema-defined options
        filter_options = {
            "categories": {
                "available": categories,
                "all_options": [
                    "road_infrastructure", "water_sanitation", "electricity_power", "waste_management",
                    "traffic_transport", "public_safety", "environment_pollution", "healthcare_medical", 
                    "education_schools", "telecommunication", "housing_construction", "general_administration"
                ]
            },
            "priorities": {
                "available": priorities,
                "all_options": ["low", "medium", "high", "very_high"]
            },
            "departments": {
                "available": departments,
                "all_options": [
                    "Public Works Department", "Water & Sanitation Department", "Power Department",
                    "Waste Management Department", "Traffic Police Department", "Public Safety Department",
                    "Environmental Department", "Health Department", "Education Department",
                    "Telecommunication Department", "Housing & Construction Department", "Fire Department",
                    "Municipal Corporation", "Revenue Department", "General Administration"
                ]
            },
            "statuses": {
                "available": statuses,
                "all_options": ["submitted", "in_progress", "resolved"]
            }
        }
        
        return {"success": True, "data": filter_options}
        
    except Exception as e:
        print(f"❌ Error fetching filter options: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports/{report_id}")
async def get_report_details(report_id: str):
    """Get specific report details"""
    try:
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
        SELECT 
            report_id,
            session_id,
            phone_number,
            description,
            coordinates,
            image_path,
            category,
            priority,
            department,
            resolution_days,
            status,
            created_at,
            updated_at
        FROM complaint_reports 
        WHERE report_id = ?
        """, (report_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")
        
        coordinates, location_lat, location_lon, address_extracted = parse_report_coordinates(row[4])
        
        report = {
            "report_id": row[0],
            "session_id": row[1],
            "citizen_phone": row[2],
            "description": row[3],
            "coordinates": coordinates,
            "image_path": row[5],
            "category": row[6] or "general",
            "priority": row[7] or "medium",
            "department": row[8] or "general",
            "resolution_days": row[9],
            "status": row[10],
            "created_at": row[11],
            "updated_at": row[12],
            "location_lat": location_lat,
            "location_lon": location_lon,
            "address_extracted": address_extracted,
        }
        
        return {"success": True, "data": report}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching report details: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Calling Service API Models
class BroadcastCallPayload(BaseModel):
    number: str
    message: str


class CollectDetailsCallPayload(BaseModel):
    number: str
    prompt: str = "Hello from the grievance helpline. Please describe your issue after the beep."
    location_prompt: str = "Please state the exact location of the issue after the beep."


class DetectorBroadcastPayload(BaseModel):
    number: str
    message: str
    issue: Optional[str] = None
    priority: Optional[Literal["low", "medium", "high", "very_high"]] = None
    department: Optional[str] = None
    category: Optional[str] = None
    resolution_days: Optional[int] = None
    location: Optional[str] = None
    source: Optional[str] = "CCTV"
    camera_id: Optional[str] = None
    detected_at: Optional[str] = None
    image_base64: Optional[str] = None


@app.get("/api/calling/status")
async def get_calling_service_status(request: Request):
    """Get calling-service connectivity and endpoint information for the dashboard."""
    health_url = build_calling_service_url("/health")
    public_broadcast_endpoint = calling_service_public_endpoint("/api/calls/broadcast")
    public_collect_endpoint = calling_service_public_endpoint("/api/calls/collect-details")
    backend_public_base_url = CIVICCONNECT_PUBLIC_BASE_URL

    if not backend_public_base_url:
        forwarded_host = request.headers.get("x-forwarded-host", "").strip()
        if forwarded_host:
            forwarded_proto = request.headers.get("x-forwarded-proto", "https").strip() or "https"
            backend_public_base_url = f"{forwarded_proto}://{forwarded_host}".rstrip("/")

    status_payload = {
        "configured": bool(CALLING_SERVICE_BASE_URL),
        "base_url": CALLING_SERVICE_BASE_URL,
        "public_base_url": CALLING_SERVICE_PUBLIC_BASE_URL or None,
        "backend_public_base_url": backend_public_base_url or None,
        "public_broadcast_endpoint": public_broadcast_endpoint,
        "public_collect_endpoint": public_collect_endpoint,
        "detector_broadcast_endpoint": (
            f"{backend_public_base_url}/api/calls/broadcast"
            if backend_public_base_url
            else None
        ),
        "detector_collect_endpoint": (
            f"{backend_public_base_url}/api/calls/collect-details"
            if backend_public_base_url
            else None
        ),
        "reachable": False,
        "health": None,
        "detail": None,
    }

    try:
        response = requests.get(health_url, timeout=5)
        response.raise_for_status()
        status_payload["reachable"] = True
        status_payload["health"] = response.json()
    except requests.RequestException as exc:
        status_payload["detail"] = str(exc)

    return {"success": True, "data": status_payload}


@app.post("/api/calling/broadcast")
async def create_broadcast_call(payload: BroadcastCallPayload):
    """Proxy a broadcast-call request to the FastAPI calling service."""
    return {
        "success": True,
        "data": trigger_calling_service_broadcast(payload.number, payload.message),
    }
    try:
        response = requests.post(
            build_calling_service_url("/api/calls/broadcast"),
            json=payload.model_dump(),
            timeout=CALLING_SERVICE_TIMEOUT,
        )
    except requests.RequestException as exc:
        print(f"❌ Error reaching calling service: {exc}")
        raise HTTPException(
            status_code=502,
            detail=f"Calling service unreachable: {exc}",
        ) from exc

    if not response.ok:
        try:
            error_payload = response.json()
        except ValueError:
            error_payload = {"detail": response.text or "Calling service request failed"}
        raise HTTPException(status_code=response.status_code, detail=error_payload)

    return {"success": True, "data": response.json()}


@app.post("/api/calling/collect-details")
@app.post("/api/calls/collect-details")
@app.post("/api/detection/alerts/collect-details")
async def create_collect_details_call(payload: CollectDetailsCallPayload):
    """Proxy a collect-details call request to the FastAPI calling service."""
    return {
        "success": True,
        "data": trigger_calling_service_collect_details(
            payload.number,
            payload.prompt,
            payload.location_prompt,
        ),
    }


@app.get("/api/calling/collected-records")
async def get_collected_call_records():
    """Return collected call transcripts and recording metadata stored in CivicConnect."""
    sync_collected_call_records()
    return {"success": True, "data": db.get_collected_call_records()}


@app.post("/api/calls/broadcast")
@app.post("/api/detection/alerts/broadcast")
async def create_detector_broadcast(payload: DetectorBroadcastPayload):
    """Detector endpoint: store a CCTV incident and relay the alert call."""
    report = create_detector_report(payload)
    call_response = trigger_calling_service_broadcast(payload.number, payload.message)

    return {
        "success": True,
        "data": {
            "report_id": report["report_id"],
            "source": report["source"],
            "location": report["location"],
            "submitted_at": report["submitted_at"],
            "image_path": report["image_path"] or None,
            "call": call_response,
        },
    }


@app.api_route("/webhooks/twilio/call-flow", methods=["GET", "POST"])
async def proxy_twilio_call_flow(request: Request):
    """Expose the local calling-service webhook through the CivicConnect backend."""
    return await proxy_calling_service_request(request, "/webhooks/twilio/call-flow")


@app.api_route("/audio/{filename}", methods=["GET", "HEAD"])
async def proxy_calling_audio(filename: str, request: Request):
    """Expose generated calling-service audio through the CivicConnect backend."""
    return await proxy_calling_service_request(request, f"/audio/{filename}")


# Chatbot API Models
class ChatMessage(BaseModel):
    message: str
    chat_history: List[Dict] = []

class ChatResponse(BaseModel):
    response: str
    status: str = "success"

# Chatbot API Endpoints
@app.post("/api/chatbot/message", response_model=ChatResponse)
async def send_chat_message(chat_message: ChatMessage):
    """Send message to chatbot and get response"""
    try:
        response = chatbot.get_chatbot_response(
            chat_message.message, 
            chat_message.chat_history
        )
        return ChatResponse(response=response)
    except Exception as e:
        print(f"❌ Error in chatbot: {e}")
        raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")

@app.get("/api/chatbot/stats")
async def get_chatbot_stats():
    """Get database statistics for chatbot context"""
    try:
        stats = chatbot.get_database_stats()
        return stats
    except Exception as e:
        print(f"❌ Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/uploads/{filename}")
async def get_uploaded_file(filename: str):
    """Serve uploaded images from the uploads directory"""
    candidate_paths = [
        os.path.join("uploads", filename),
        os.path.join("uploads", "reports", filename),
    ]

    for file_path in candidate_paths:
        if os.path.exists(file_path):
            return FileResponse(file_path)

    raise HTTPException(status_code=404, detail="File not found")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "WhatsApp Government Complaint Bot"}

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting WhatsApp Government Complaint Bot...")
    print("📱 Bot is ready to receive complaints via WhatsApp!")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
