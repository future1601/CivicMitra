from pydantic import BaseModel
from typing import Optional, Literal



class QuestionValidation(BaseModel):
    isvalid: bool
    question: Optional[str] = None

class AudioTranscription(BaseModel):
    transcribed_text: str
    isvalid: bool
    question: Optional[str] = None

class ComplaintValidation(BaseModel):
    valid: bool
    question: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[Literal["low", "medium", "high", "very_high"]] = None
    department: Optional[Literal["Public Works Department", "Water & Sanitation Department", "Power Department", "Waste Management Department", "Traffic Police Department", "Public Safety Department", "Environmental Department", "Health Department", "Education Department", "Telecommunication Department", "Housing & Construction Department", "Fire Department", "Municipal Corporation", "Revenue Department", "General Administration"]] = None
    category: Optional[Literal["road_infrastructure", "water_sanitation", "electricity_power", "waste_management", "traffic_transport", "public_safety", "environment_pollution", "healthcare_medical", "education_schools", "telecommunication", "housing_construction", "general_administration"]] = None
    resolution_days: Optional[int] = None

class ComplaintState(BaseModel):
    phone_number: Optional[str] = None
    session_id: Optional[str] = None
    complaint_text: Optional[str] = None
    coordinates: Optional[str] = None
    image_analysis: Optional[ComplaintValidation] = None
    image_data: Optional[bytes] = None
    report_id: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    department: Optional[str] = None
    resolution_days: Optional[int] = None
    status: str = "started"
    step: str = "step_1"
    message: Optional[str] = None
    user_input: Optional[dict] = None