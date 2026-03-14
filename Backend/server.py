from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import requests
import os
import json
import uuid
import sqlite3
from datetime import datetime
from dotenv import load_dotenv
from database import WhatsAppBotDatabase
from workflow import ComplaintWorkflow
from models import ComplaintState
from chatbot import ComplaintChatbot
from typing import List, Dict, Any

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
            # Parse coordinates if they exist
            coordinates = None
            location_lat, location_lon = 0, 0
            if row[4]:  # coordinates field
                try:
                    coords_str = row[4]
                    if coords_str.startswith("GPS: "):
                        # Handle "GPS: lat, lng" format
                        coords_part = coords_str[5:]  # Remove "GPS: " prefix
                        lat_str, lng_str = coords_part.split(", ")
                        lat = float(lat_str.strip())
                        lng = float(lng_str.strip())
                        coordinates = {"lat": lat, "lng": lng}
                        location_lat = lat
                        location_lon = lng
                    else:
                        # Handle JSON format
                        coord_data = json.loads(coords_str)
                        coordinates = {
                            "lat": coord_data.get("lat", 0),
                            "lng": coord_data.get("lng", 0)
                        }
                        location_lat = coordinates["lat"]
                        location_lon = coordinates["lng"]
                except (json.JSONDecodeError, ValueError, IndexError):
                    pass
            
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
                "address_extracted": f"Lat: {location_lat}, Lng: {location_lon}" if coordinates else "No location",
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
        
        # Parse coordinates
        coordinates = None
        location_lat, location_lon = 0, 0
        if row[4]:
            try:
                coords_str = row[4]
                if coords_str.startswith("GPS: "):
                    # Handle "GPS: lat, lng" format
                    coords_part = coords_str[5:]  # Remove "GPS: " prefix
                    lat_str, lng_str = coords_part.split(", ")
                    lat = float(lat_str.strip())
                    lng = float(lng_str.strip())
                    coordinates = {"lat": lat, "lng": lng}
                    location_lat = lat
                    location_lon = lng
                else:
                    # Handle JSON format
                    coord_data = json.loads(coords_str)
                    coordinates = {
                        "lat": coord_data.get("lat", 0),
                        "lng": coord_data.get("lng", 0)
                    }
                    location_lat = coordinates["lat"]
                    location_lon = coordinates["lng"]
            except (json.JSONDecodeError, ValueError, IndexError):
                pass
        
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
            "address_extracted": f"Lat: {location_lat}, Lng: {location_lon}" if coordinates else "No location",
        }
        
        return {"success": True, "data": report}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching report details: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
    file_path = os.path.join("uploads", filename)
    if os.path.exists(file_path):
        return FileResponse(file_path)
    else:
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