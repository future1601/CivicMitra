import os
import uuid
import sqlite3
from datetime import datetime
from typing import Dict, Any
from google import genai
from google.genai import types
from models import QuestionValidation, ComplaintValidation, ComplaintState, AudioTranscription

class ComplaintWorkflow:
    def __init__(self):
        self.client = genai.Client()
    
    def detect_message_type(self, message: Dict[str, Any]) -> str:
        """Detect WhatsApp message type - ALWAYS CALLED FIRST"""
        msg_type = message.get("type", "").lower()
        if msg_type == "audio":
            return "audio"
        elif msg_type == "text":
            return "text"
        elif msg_type == "image":
            return "image"
        elif msg_type == "location":
            return "location"
        else:
            return "other"
    
    def validate_question(self, text: str) -> Dict[str, Any]:
        """Validate if text is a complaint - core validation function"""
        prompt = f"""Validate if this text is a complaint about any issue: '{text}'.

ACCEPT these as valid complaints:
- Any problem mentioned (pothole, water leak, garbage, electricity, etc.)
- Short descriptions are fine
- Basic location info is acceptable
- Don't demand excessive details

REJECT only if:
- Just greetings without any issue (hi, hello, hey, namaste)
- Completely unrelated text
- Random words with no issue mentioned

If valid, set isvalid=true and question=null.
If invalid, set isvalid=false and generate a friendly question asking them to describe their issue.

For greetings like "hi", "hello", "hey" - respond with: "Hello! Welcome to the Government Complaint Registration System. Please tell me about any issue you're facing."

Example: "pothole near my area" = VALID
Example: "hello" = INVALID (question: "Hello! Welcome to the Government Complaint Registration System. Please tell me about any issue you're facing.")
Example: "hey" = INVALID (question: "Hello! Welcome to the Government Complaint Registration System. Please tell me about any issue you're facing.")
"""
        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": QuestionValidation,
            },
        )
        
        result = response.parsed
        return {
            "is_valid": result.isvalid,
            "question": result.question,
            "description": text if result.isvalid else None
        }
    
    def audio_to_text(self, file_path: str) -> Dict[str, Any]:
        """Transcribe audio and send to validate_question"""
        try:
            myfile = self.client.files.upload(file=file_path)
            prompt = """Listen to this audio and transcribe exactly what the person said (word for word).
Just provide the transcription, nothing else."""
            
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[prompt, myfile]
            )
            
            transcribed_text = response.text.strip()
            print(f"🎤 DEBUG - Transcribed: '{transcribed_text}'")
            
            # Now send transcribed text to validate_question
            return self.validate_question(transcribed_text)
            
        except Exception as e:
            print(f"❌ Audio processing error: {e}")
            return {
                "is_valid": False,
                "question": "Sorry, I couldn't understand the audio. Please type your complaint or try again.",
                "description": None
            }
    
    def ask_coordinates(self, text: str) -> Dict[str, Any]:
        """Validate coordinate input - STRICTLY only accepts coordinates/locations"""
        prompt = f"""Strictly validate if this text contains ACTUAL location/coordinate information: '{text}'.

ACCEPT ONLY these as valid coordinates/locations:
- Specific street names, area names, locality names
- Full or partial addresses  
- GPS coordinates (lat, long format)
- Specific landmarks (school name, hospital name, market name)
- WhatsApp location messages

REJECT everything else including:
- Vague descriptions ("somewhere", "here", "there")
- General directions ("left", "right", "near")
- Non-location text
- Greetings or random words
- "I don't know" or similar responses

Be STRICT - if not clearly a location, mark as invalid.

If valid, set isvalid=true and question=null.
If invalid, set isvalid=false and question asking for location.

Example: "Main Street Colony" = VALID
Example: "near the market" = VALID  
Example: "somewhere around" = INVALID
Example: "I don't know" = INVALID
"""
        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": QuestionValidation,
            },
        )
        
        result = response.parsed
        if not result.isvalid:
            # Generate custom question about using WhatsApp location feature
            custom_question = """Please share your exact location. You can:
1. Use WhatsApp's location feature (📍 attachment > Location > Send your current location)
2. Or type the specific area name/address where the issue is located"""
            return {
                "is_valid": False,
                "question": custom_question,
                "coordinates": None
            }
        
        return {
            "is_valid": True,
            "question": None,
            "coordinates": text
        }
    
    def generate_custom_response(self, description: str) -> str:
        """Generate custom personalized message for valid complaint"""
        prompt = f"""Generate a short, empathetic response for a user who reported this issue: '{description}'.

The response should:
- Be very short (under 30 words)
- Show understanding of their specific issue
- Ask for location/coordinates
- Be friendly and professional
- Use VARIED phrasing, don't repeat same patterns

Examples of DIFFERENT response styles:
Input: "pothole on road"
Output: "Thanks for reporting the pothole issue. Please share your location so we can address it."

Input: "street lights not working"
Output: "Got it - street lighting problem noted. Where exactly is this happening?"

Input: "water leakage"
Output: "Water leakage reported. Could you provide the specific location?"

Input: "garbage not collected"
Output: "Understood about the garbage collection issue. What's the area/address?"

Generate a UNIQUE response for: '{description}'"""

        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            # Fallback message if API fails
            return f"I understand your concern about {description}. Can you please share your location coordinates?"
    
    def ask_image(self, description: str) -> str:
        """Generate short prompt asking for location image based on description"""
        prompt = f"""Based on this issue description: '{description}', generate a very short question asking for an image.

The message should:
- Be very short (under 25 words)
- Ask for a photo of the issue
- Reference the specific problem mentioned

Examples:
Input: "pothole on road"
Output: "Can you please share a photo of the pothole?"

Input: "water leakage"
Output: "Please send a picture of the water leakage."

Generate a similar short request for: '{description}'"""

        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            return f"Can you please share a photo of the {description}?"
    
    def validate_image(self, image_data: bytes, description: str) -> Dict[str, Any]:
        """Validate if image matches the complaint description"""
        prompt = f"""Analyze this image for a complaint about: '{description}'.

Check if the image matches the described problem.

If they match:
- Set valid=true 
- Provide analysis details
- CLASSIFY the complaint:
  * category: Choose from [road_infrastructure, water_sanitation, electricity_power, waste_management, traffic_transport, public_safety, environment_pollution, healthcare_medical, education_schools, telecommunication, housing_construction, general_administration]
  * priority: Choose from [low, medium, high, very_high] based on urgency
  * department: Choose from [Public Works Department, Water & Sanitation Department, Power Department, Waste Management Department, Traffic Police Department, Public Safety Department, Environmental Department, Health Department, Education Department, Telecommunication Department, Housing & Construction Department, Fire Department, Municipal Corporation, Revenue Department, General Administration]
  * resolution_days: Estimate days to resolve (1-30 days)

If they don't match:
- Set valid=false
- Generate a question asking for the correct image

Examples:
- Pothole image → category: road_infrastructure, priority: high, department: Public Works Department, resolution_days: 7
- Street light issue → category: electricity_power, priority: medium, department: Power Department, resolution_days: 3"""

        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=image_data, mime_type="image/jpeg"),
                prompt
            ],
            config={
                "response_mime_type": "application/json",
                "response_schema": ComplaintValidation,
            },
        )
        
        result = response.parsed
        return {
            "is_valid": result.valid,
            "question": result.question if not result.valid else None,
            "analysis": result if result.valid else None
        }
    
    def save_image_to_uploads(self, image_data: bytes, report_id: str) -> str:
        """Save image to uploads folder and return the file path"""
        try:
            import os
            uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
            os.makedirs(uploads_dir, exist_ok=True)
            
            # Create filename with report ID and timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"{report_id}_{timestamp}.jpg"
            file_path = os.path.join(uploads_dir, filename)
            
            # Save image data to file
            with open(file_path, 'wb') as f:
                f.write(image_data)
            
            print(f"✅ Image saved to: {file_path}")
            return file_path
            
        except Exception as e:
            print(f"❌ Error saving image: {e}")
            return None
    
    def save_complaint_to_database(self, state: ComplaintState, image_path: str = None):
        """Save completed complaint to database"""
        try:
            print(f"🔍 DEBUG - Attempting to save complaint: {state.report_id}")
            print(f"🔍 DEBUG - Image path: {image_path}")
            print(f"🔍 DEBUG - Category: {state.category}")
            print(f"🔍 DEBUG - Priority: {state.priority}")
            
            # Use the same absolute DB path as database.py (project root whatsapp_bot.db)
            db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'whatsapp_bot.db'))
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO complaint_reports (
                    report_id, session_id, phone_number, description, coordinates, image_path, category,
                    priority, department, resolution_days, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                state.report_id,
                state.session_id,
                state.phone_number,
                state.complaint_text,
                state.coordinates,
                image_path,
                state.category,
                state.priority,
                state.department,
                state.resolution_days,
                'submitted',
                datetime.now().isoformat()
            ))
            
            conn.commit()
            conn.close()
            print(f"✅ SUCCESS - Complaint {state.report_id} saved to database")
            
        except Exception as e:
            print(f"❌ ERROR - Failed to save complaint to database: {e}")
            print(f"🔍 DEBUG - Error details: {type(e).__name__}: {str(e)}")
    
    def generate_report_id(self) -> str:
        """Generate unique government report ID"""
        return f"GOV{datetime.now().strftime('%Y%m%d%H%M%S')}{str(uuid.uuid4())[:6].upper()}"
    
    def process_message(self, state: ComplaintState, user_input: dict) -> ComplaintState:
        """Main processing function following your simplified workflow"""
        
        # Step 1: Detect message type
        message_type = self.detect_message_type(user_input)
        print(f"🔍 Message type detected: {message_type}")
        
        # Step 2: Route based on message type
        if message_type == "text":
            return self._handle_text_message(state, user_input)
        elif message_type == "audio":
            return self._handle_audio_message(state, user_input)
        elif message_type == "image":
            return self._handle_image_message(state, user_input)
        elif message_type == "location":
            return self._handle_location_message(state, user_input)
        else:
            state.message = "Please send text, audio, image, or location message."
            return state
    
    def _handle_text_message(self, state: ComplaintState, user_input: dict) -> ComplaintState:
        """Handle text messages based on current state"""
        text = user_input.get("text", "")
        
        if not state.complaint_text:
            # Need description - validate question
            result = self.validate_question(text)
            if result["is_valid"]:
                state.complaint_text = result["description"]
                # Generate custom response using the new function
                state.message = self.generate_custom_response(state.complaint_text)
            else:
                state.message = result["question"]
        
        elif not state.coordinates:
            # Need coordinates
            result = self.ask_coordinates(text)
            if result["is_valid"]:
                state.coordinates = result["coordinates"]
                image_request = self.ask_image(state.complaint_text)
                state.message = image_request
            else:
                state.message = result["question"]
        
        else:
            state.message = "Please share an image of the issue."
        
        return state
    
    def _handle_audio_message(self, state: ComplaintState, user_input: dict) -> ComplaintState:
        """Handle audio messages"""
        file_path = user_input.get("file_path")
        
        if not state.complaint_text:
            # Transcribe and validate
            result = self.audio_to_text(file_path)
            if result["is_valid"]:
                state.complaint_text = result["description"]
                # Generate custom response using the new function
                state.message = self.generate_custom_response(state.complaint_text)
            else:
                state.message = result["question"]
        else:
            state.message = "Please share your location coordinates as text or use the location feature."
        
        return state
    
    def _handle_image_message(self, state: ComplaintState, user_input: dict) -> ComplaintState:
        """Handle image messages"""
        if state.complaint_text and state.coordinates:
            # Validate image matches description
            image_data = user_input.get("image_data")
            result = self.validate_image(image_data, state.complaint_text)
            
            if result["is_valid"]:
                # Extract classification data from the analysis result
                analysis = result["analysis"]  # This is the ComplaintValidation object
                
                # Generate report ID and complete
                state.report_id = self.generate_report_id()
                state.status = "completed"
                state.image_analysis = analysis
                
                # Set classification fields from the analysis
                state.category = analysis.category if analysis.category else "general_administration"
                state.priority = analysis.priority if analysis.priority else "medium"
                state.department = analysis.department if analysis.department else "Municipal Corporation"
                state.resolution_days = analysis.resolution_days if analysis.resolution_days else 7
                
                # Save image to uploads folder
                image_path = self.save_image_to_uploads(image_data, state.report_id)
                
                # Save to database
                self.save_complaint_to_database(state, image_path)
                
                state.message = f"""✅ COMPLAINT REGISTERED SUCCESSFULLY

📄 Report ID: {state.report_id}
📝 Description: {state.complaint_text}
📍 Location: {state.coordinates}
🏷 Category: {state.category.replace('_', ' ').title()}
⚡ Priority: {state.priority.title()}
🏢 Department: {state.department}
⏰ Expected Resolution: {state.resolution_days} days

Thank you for reporting! We will update you on the status soon."""
            else:
                state.message = result["question"]
        else:
            if not state.complaint_text:
                state.message = "Please first describe your issue."
            else:
                state.message = "Please share your location coordinates first."
        
        return state
    
    def _handle_location_message(self, state: ComplaintState, user_input: dict) -> ComplaintState:
        """Handle WhatsApp location messages"""
        if state.complaint_text:
            lat = user_input.get("latitude")
            lon = user_input.get("longitude")
            state.coordinates = f"GPS: {lat}, {lon}"
            
            image_request = self.ask_image(state.complaint_text)
            state.message = image_request
        else:
            # DEBUG: Check why complaint_text is missing
            print(f"🚨 DEBUG - Location received but complaint_text is empty!")
            print(f"🚨 DEBUG - State: {state._dict_}")
            state.message = "I received your location. Please first describe your issue, then I'll use your location for the complaint."
        
        return state