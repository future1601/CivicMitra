#!/usr/bin/env python3
"""
Test script for the complaint chatbot functionality
"""
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from chatbot import ComplaintChatbot

def test_chatbot():
    """Test the chatbot functionality"""
    print("🤖 WhatsApp Complaint Chatbot Test")
    print("=" * 50)
    
    try:
        # Initialize chatbot
        chatbot = ComplaintChatbot()
        print("✅ Chatbot initialized successfully!")
        
        # Test database stats
        stats = chatbot.get_database_stats()
        print(f"📊 Database Stats: {stats}")
        
        # Test queries
        test_queries = [
            "How many total complaints do we have?",
            "Show me complaints by category",
            "Which complaints have high priority?",
            "Show me the latest 3 complaints"
        ]
        
        history = []
        
        for query in test_queries:
            print(f"\nQ: {query}")
            response = chatbot.get_chatbot_response(query, history)
            print(f"A: {response}")
            
            history.append({"sender": "user", "text": query})
            history.append({"sender": "bot", "text": response})
            
        print("\n✅ All tests completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_chatbot()