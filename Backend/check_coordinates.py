#!/usr/bin/env python3
import sqlite3
import json
import os

# Get the database path
db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'whatsapp_bot.db'))

print(f"Checking database at: {db_path}")

if not os.path.exists(db_path):
    print("❌ Database file not found!")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check complaint_reports table
print("\n📋 COMPLAINT REPORTS TABLE:")
print("=" * 50)

cursor.execute("SELECT COUNT(*) FROM complaint_reports")
count = cursor.fetchone()[0]
print(f"Total reports: {count}")

if count > 0:
    # Get all reports with coordinates
    cursor.execute("""
    SELECT report_id, description, coordinates, category, priority, status, created_at 
    FROM complaint_reports 
    ORDER BY created_at DESC
    """)
    
    reports = cursor.fetchall()
    
    print(f"\n📄 ALL REPORTS ({len(reports)}):")
    print("-" * 30)
    
    for i, report in enumerate(reports, 1):
        report_id, desc, coords, category, priority, status, created = report
        print(f"\n{i}. Report ID: {report_id}")
        print(f"   Description: {desc[:50]}...")
        print(f"   Category: {category}")
        print(f"   Priority: {priority}")
        print(f"   Status: {status}")
        print(f"   Created: {created}")
        print(f"   Coordinates: {coords}")
        
        # Try to parse coordinates
        if coords:
            try:
                coord_data = json.loads(coords)
                if isinstance(coord_data, dict) and 'lat' in coord_data and 'lng' in coord_data:
                    print(f"   ✅ Parsed GPS: Lat={coord_data['lat']}, Lng={coord_data['lng']}")
                else:
                    print(f"   ⚠️ Invalid coordinate format: {coord_data}")
            except json.JSONDecodeError as e:
                print(f"   ❌ JSON decode error: {e}")
        else:
            print(f"   ❌ No coordinates stored")

# Check user_sessions table for any coordinate data
print(f"\n📋 USER SESSIONS TABLE:")
print("=" * 50)

cursor.execute("SELECT COUNT(*) FROM user_sessions")
count = cursor.fetchone()[0]
print(f"Total sessions: {count}")

if count > 0:
    cursor.execute("""
    SELECT session_id, phone_number, coordinates, session_status, created_at
    FROM user_sessions
    WHERE coordinates IS NOT NULL AND coordinates != ''
    ORDER BY created_at DESC
    """)
    
    sessions = cursor.fetchall()
    print(f"\nSessions with coordinates: {len(sessions)}")
    
    for session in sessions:
        session_id, phone, coords, status, created = session
        print(f"\nSession: {session_id}")
        print(f"Phone: {phone}")
        print(f"Status: {status}")
        print(f"Created: {created}")
        print(f"Coordinates: {coords}")

conn.close()
print("\n✅ Database inspection complete!")