#!/usr/bin/env python3
"""
Test the fixed coordinate parsing
"""
import requests
import json

print("🧪 Testing Backend API Coordinate Parsing")
print("=" * 50)

try:
    # Test the /api/reports/by-location endpoint
    response = requests.get("http://localhost:8000/api/reports/by-location")
    
    if response.status_code == 200:
        data = response.json()
        print("✅ /api/reports/by-location endpoint working!")
        print(f"Success: {data.get('success', False)}")
        
        locations = data.get('data', [])
        print(f"📍 Found {len(locations)} locations:")
        
        for i, loc in enumerate(locations, 1):
            print(f"  {i}. {loc['name']}")
            print(f"     Lat: {loc['lat']}, Lng: {loc['lng']}")
            print(f"     Info: {loc['info'][:50]}...")
            print()
    else:
        print(f"❌ API Error: {response.status_code}")
        print(f"Response: {response.text}")

except requests.exceptions.ConnectionError:
    print("❌ Could not connect to backend server")
    print("Make sure the backend is running on http://localhost:8000")
except Exception as e:
    print(f"❌ Error: {e}")

print("\n🎯 To test this:")
print("1. Start backend: python server.py")  
print("2. Run this test: python test_coordinates.py")
print("3. Check frontend map at http://localhost:3000 or 5173")