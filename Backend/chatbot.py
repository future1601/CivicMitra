import os
import sqlite3
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langgraph.prebuilt import create_react_agent
from typing import Any, List, Dict

# Load environment variables
load_dotenv()


class ComplaintChatbot:
    @staticmethod
    def _normalize_ai_content(content: Any) -> str:
        if isinstance(content, str):
            return content.strip()

        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, str):
                    text = item
                elif isinstance(item, dict):
                    text = item.get("text") or item.get("content")
                else:
                    text = getattr(item, "text", None) or getattr(item, "content", None)

                if text:
                    cleaned = str(text).strip()
                    if cleaned:
                        parts.append(cleaned)

            return "\n".join(parts)

        return str(content).strip()

    def __init__(self, db_path="whatsapp_bot.db"):
        # Resolve DB path consistently: use the project root DB (one level up from this file)
        if os.path.isabs(db_path):
            self.db_path = db_path
        else:
            self.db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', db_path))

        # Initialize LLM
        self.chat_model = (
            os.getenv("GEMINI_CHAT_MODEL")
            or os.getenv("GEMINI_MODEL")
            or "gemini-2.5-flash"
        )
        self.google_api_key = os.getenv("GEMINI_API_KEY")

        self.llm = ChatGoogleGenerativeAI(
            model=self.chat_model,
            google_api_key=self.google_api_key,
        )

        # Create tool with closure over db_path
        db_path_ref = self.db_path

        @tool
        def complaint_query(sql_query: str) -> str:
            """Query the complaint_reports table to get complaint data.
            MUST be used for any question about complaints, statistics, or data analysis.
            Database schema:
            Table: complaint_reports
            Columns:
            - report_id (TEXT): Unique complaint identifier
            - phone_number (TEXT): Citizen's phone number
            - description (TEXT): Complaint description
            - category (TEXT): Complaint category (water_sanitation, traffic_transport, public_safety, waste_management, etc.)
            - priority (TEXT): Priority level (low, medium, high, very_high)
            - department (TEXT): Assigned department
            - status (TEXT): Current status (submitted, in_progress, resolved)
            - created_at (DATETIME): Submission timestamp
            - updated_at (DATETIME): Last update timestamp
            - coordinates (TEXT): Location coordinates
            - session_id (TEXT): Session identifier
            - image_path (TEXT): Path to attached image
            - resolution_days (INTEGER): Days to resolve

            Example queries:
            - Latest complaints: SELECT * FROM complaint_reports ORDER BY created_at DESC LIMIT 5
            - By category: SELECT * FROM complaint_reports WHERE category = 'water_sanitation'
            - High priority: SELECT * FROM complaint_reports WHERE priority IN ('high', 'very_high')
            Always use proper SQL syntax without markdown formatting.
            """
            return ComplaintChatbot._execute_query(db_path_ref, sql_query)

        self.complaint_tool = complaint_query

        # System prompt for the agent
        self.system_message = SystemMessage(content=(
            "You are a helpful assistant for WhatsApp complaint data analysis. "
            "You have access to a complaint_query tool that MUST be used for any data queries.\n"
            "\nCRITICAL: Always use the complaint_query tool when users ask about complaints, data, or statistics. "
            "Never try to answer data questions without first querying the database.\n"
            "\nCommon query patterns:\n"
            "- 'latest/recent complaints' → SELECT * FROM complaint_reports ORDER BY created_at DESC LIMIT 5\n"
            "- 'complaints by category' → SELECT * FROM complaint_reports WHERE category = 'category_name'\n"
            "- 'high priority' → SELECT * FROM complaint_reports WHERE priority IN ('high', 'very_high')\n"
            "- 'total count' → SELECT COUNT(*) FROM complaint_reports\n"
            "- 'by status' → SELECT status, COUNT(*) FROM complaint_reports GROUP BY status\n"
            "\nThe tool automatically formats results with bullet points and line breaks. "
            "After getting formatted data, provide helpful analysis and insights. "
            "IMPORTANT: Use plain text only - NO markdown formatting, no **bold**, no ``` code blocks, no * bullets."
        ))

        # Create the react agent
        self.agent = create_react_agent(
            self.llm,
            tools=[self.complaint_tool],
        )

    @staticmethod
    def _execute_query(db_path: str, sql_query: str) -> str:
        """Execute SQL query on the WhatsApp bot database"""
        conn = None
        try:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute(sql_query)
            rows = cur.fetchall()

            if not rows:
                return "No data found."

            # Get column names
            column_names = [description[0] for description in cur.description]

            # Format results in a readable line-by-line format
            result_lines = []
            for i, row in enumerate(rows, 1):
                row_dict = dict(zip(column_names, row))

                # Format each complaint with proper structure
                complaint_lines = [f"Complaint {i}:"]

                # Add each field in a structured way with better formatting
                for key, value in row_dict.items():
                    if value is not None:  # Only show non-null values
                        # Format field names to be more readable
                        formatted_key = key.replace('_', ' ').title()
                        complaint_lines.append(f"  • {formatted_key}: {value}")

                result_lines.append("\n".join(complaint_lines))

            formatted_result = "\n\n".join(result_lines)
            return formatted_result

        except Exception as e:
            return f"SQL error: {e}"
        finally:
            if conn:
                conn.close()

    def execute_whatsapp_db_query(self, sql_query: str) -> str:
        """Execute SQL query on the WhatsApp bot database (instance method)"""
        return self._execute_query(self.db_path, sql_query)

    def get_chatbot_response(self, user_message: str, chat_history: List[Dict] = None) -> str:
        """Get response from the chatbot"""
        try:
            if chat_history is None:
                chat_history = []

            # Build message history
            messages = [self.system_message]

            for message in chat_history:
                if message.get('sender') == 'user':
                    messages.append(HumanMessage(content=message.get('text', '')))
                elif message.get('sender') == 'bot':
                    messages.append(AIMessage(content=message.get('text', '')))

            messages.append(HumanMessage(content=user_message))

            # Invoke the agent
            response = self.agent.invoke({"messages": messages})

            # Extract the final AI message
            ai_messages = [
                m for m in response["messages"]
                if isinstance(m, AIMessage) and m.content
            ]
            if ai_messages:
                final_content = self._normalize_ai_content(ai_messages[-1].content)
                if final_content:
                    return final_content

            return "Sorry, I couldn't generate a response."

        except Exception as e:
            error_message = str(e)
            if "NOT_FOUND" in error_message and "models/" in error_message:
                return (
                    f"Sorry, the configured Gemini model '{self.chat_model}' is not available. "
                    "Set GEMINI_CHAT_MODEL in your Backend .env to a supported model such as "
                    "'gemini-2.5-flash' and restart the backend."
                )

            return f"Sorry, I encountered an error: {error_message}"

    def get_database_stats(self) -> Dict:
        """Get basic database statistics"""
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            cur = conn.cursor()

            stats = {}

            # Total complaints
            cur.execute("SELECT COUNT(*) FROM complaint_reports")
            stats['total_complaints'] = cur.fetchone()[0]

            # Complaints by status
            cur.execute("SELECT status, COUNT(*) FROM complaint_reports GROUP BY status")
            stats['by_status'] = dict(cur.fetchall())

            # Complaints by priority
            cur.execute("SELECT priority, COUNT(*) FROM complaint_reports GROUP BY priority")
            stats['by_priority'] = dict(cur.fetchall())

            # Complaints by category
            cur.execute("SELECT category, COUNT(*) FROM complaint_reports GROUP BY category")
            stats['by_category'] = dict(cur.fetchall())

            # Recent complaints (last 7 days)
            cur.execute("""
                SELECT COUNT(*) FROM complaint_reports
                WHERE created_at >= datetime('now', '-7 days')
            """)
            stats['recent_complaints'] = cur.fetchone()[0]

            return stats

        except Exception as e:
            return {"error": str(e)}
        finally:
            if conn:
                conn.close()
