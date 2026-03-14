#!/usr/bin/env python3
"""
Start the WhatsApp Government Complaint Bot server with chatbot functionality
"""
import uvicorn
import os

if __name__ == "__main__":
    # Change to the backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(backend_dir)
    
    print("🚀 Starting WhatsApp Government Complaint Bot with Chatbot...")
    print("📍 Server will be available at: http://localhost:8000")
    print("🤖 Chatbot API endpoints:")
    print("   - POST /api/chatbot/message")
    print("   - GET /api/chatbot/stats")
    print("   - GET /health")
    print("=" * 50)
    
    # Start the server
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[backend_dir]
    )