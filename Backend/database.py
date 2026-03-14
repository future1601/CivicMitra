import sqlite3
import json
import uuid
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional

class WhatsAppBotDatabase:
    def __init__(self, db_path="whatsapp_bot.db"):
        # Resolve DB path consistently: use the project root DB (one level up from this file)
        if os.path.isabs(db_path):
            self.db_path = db_path
        else:
            self.db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', db_path))
        self.init_database()
    
    def init_database(self):
        """Initialize database with clean structure"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Only create tables if they don't exist (don't drop existing data)
        # cursor.execute("DROP TABLE IF EXISTS complaint_reports")
        # cursor.execute("DROP TABLE IF EXISTS user_sessions") 
        # cursor.execute("DROP TABLE IF EXISTS government_reports")
        # cursor.execute("DROP TABLE IF EXISTS user_conversations")
        # cursor.execute("DROP TABLE IF EXISTS report_media")
        # cursor.execute("DROP TABLE IF EXISTS departments")
        
        # Main complaints table - stores only completed complaints
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS complaint_reports (
            report_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            phone_number TEXT NOT NULL,
            description TEXT NOT NULL,
            coordinates TEXT NOT NULL,
            image_path TEXT,
            category TEXT,
            priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'very_high')),
            department TEXT,
            resolution_days INTEGER,
            status TEXT DEFAULT 'submitted' CHECK(status IN ('submitted', 'in_progress', 'resolved')),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
        # Session tracking table - manages active/closed sessions
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_sessions (
            session_id TEXT PRIMARY KEY,
            phone_number TEXT NOT NULL,
            session_status TEXT DEFAULT 'active' CHECK(session_status IN ('active', 'closed')),
            complaint_text TEXT,
            coordinates TEXT,
            image_data BLOB,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            expires_at TEXT
        )
        """)
        
        conn.commit()
        conn.close()
        
        print(f"✅ Database initialized at: {self.db_path}")
    
    def create_user_session(self, phone_number: str) -> str:
        """Create a new user session"""
        session_id = str(uuid.uuid4())
        expires_at = (datetime.now() + timedelta(hours=24)).isoformat()
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
        INSERT INTO user_sessions 
        (session_id, phone_number, expires_at)
        VALUES (?, ?, ?)
        """, (session_id, phone_number, expires_at))
        
        conn.commit()
        conn.close()
        
        return session_id
    
    def get_user_session(self, phone_number: str) -> Optional[Dict]:
        """Get active user session"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Debug: Check all sessions for this phone number
        cursor.execute("""
        SELECT session_id, session_status, expires_at, created_at FROM user_sessions 
        WHERE phone_number = ?
        ORDER BY created_at DESC
        """, (phone_number,))
        
        all_sessions = cursor.fetchall()
        print(f"🔍 DEBUG - All sessions for {phone_number}: {all_sessions}")
        
        cursor.execute("""
        SELECT * FROM user_sessions 
        WHERE phone_number = ? AND session_status = 'active'
        AND datetime(expires_at) > datetime('now')
        ORDER BY created_at DESC LIMIT 1
        """, (phone_number,))
        
        row = cursor.fetchone()
        
        if row:
            columns = [desc[0] for desc in cursor.description]
            result = dict(zip(columns, row))
            print(f"✅ DEBUG - Found session: {result['session_id']}")
            conn.close()
            return result
        else:
            print(f"❌ DEBUG - No active session found for {phone_number}")
        
        conn.close()
        return None
    
    def update_user_session(self, session_id: str, updates: Dict):
        """Update user session data"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Build dynamic UPDATE query
        set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
        values = list(updates.values()) + [datetime.now().isoformat(), session_id]
        
        cursor.execute(f"""
        UPDATE user_sessions 
        SET {set_clause}, updated_at = ?
        WHERE session_id = ?
        """, values)
        
        conn.commit()
        conn.close()
    
    def save_government_report(self, report_data: Dict) -> str:
        """Save completed government report"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
        INSERT INTO complaint_reports (
            report_id, session_id, phone_number, description, coordinates, category, priority,
            department, resolution_days, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            report_data["report_id"], 
            report_data.get("session_id"), 
            report_data["citizen_phone"], 
            report_data["description"], 
            report_data["coordinates"], 
            report_data["category"], 
            report_data["priority"],
            report_data["department"], 
            report_data.get("resolution_days"),
            'submitted',
            report_data["submitted_at"]
        ))
        
        conn.commit()
        conn.close()
        
        return report_data["report_id"]
    
    def save_report_media(self, media_data: Dict):
        """Save report media information"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
        INSERT INTO report_media (
            media_id, report_id, media_type, file_path, mime_type, analysis_result
        ) VALUES (?, ?, ?, ?, ?, ?)
        """, (
            media_data["media_id"], media_data["report_id"], media_data["media_type"],
            media_data["file_path"], media_data["mime_type"], media_data["analysis_result"]
        ))
        
        conn.commit()
        conn.close()
    
    def get_reports_by_phone(self, phone_number: str) -> List[Dict]:
        """Get all reports for a specific phone number"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
        SELECT report_id, description, category, priority, status, 
               department, submitted_at, estimated_resolution
        FROM government_reports 
        WHERE citizen_phone = ?
        ORDER BY submitted_at DESC
        """, (phone_number,))
        
        rows = cursor.fetchall()
        conn.close()
        
        reports = []
        for row in rows:
            reports.append({
                "report_id": row[0],
                "description": row[1], 
                "category": row[2],
                "priority": row[3],
                "status": row[4],
                "department": row[5],
                "submitted_at": row[6],
                "estimated_resolution": row[7]
            })
        
        return reports
    
    def close_expired_sessions(self):
        """Close expired user sessions"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
        UPDATE user_sessions 
        SET session_status = 'expired'
        WHERE datetime(expires_at) < datetime('now') AND session_status = 'active'
        """)
        
        conn.commit()
        conn.close()
    
    def get_analytics(self) -> Dict:
        """Get basic analytics"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM complaint_reports")
        total_reports = cursor.fetchone()[0]
        
        cursor.execute("SELECT status, COUNT(*) FROM complaint_reports GROUP BY status")
        by_status = dict(cursor.fetchall())
        
        cursor.execute("SELECT department, COUNT(*) FROM complaint_reports GROUP BY department")
        by_department = dict(cursor.fetchall())
        
        conn.close()
        
        return {
            "total_reports": total_reports,
            "by_status": by_status,
            "by_department": by_department
        }

# Test the database
if __name__ == "__main__":
    db = WhatsAppBotDatabase()
    print("🗄 WhatsApp Bot Database created successfully!")
    
    analytics = db.get_analytics()
    print(f"📊 Analytics: {analytics}")