from __future__ import annotations

from pydantic import BaseModel, Field


class BroadcastCallRequest(BaseModel):
    number: str = Field(..., description="Phone number to call in E.164 format.")
    message: str = Field(..., min_length=1, description="Message to speak in the call.")


class CollectDetailsCallRequest(BaseModel):
    number: str = Field(..., description="Phone number to call in E.164 format.")
    prompt: str = Field(
        default="Hello from the grievance helpline. Please describe your issue after the beep.",
        min_length=1,
        description="Prompt that will be played before recording the issue description.",
    )
    location_prompt: str = Field(
        default="Please state the exact location of the issue after the beep.",
        min_length=1,
        description="Prompt that will be played before recording the location.",
    )


class CallRecord(BaseModel):
    token: str
    flow: str
    call_sid: str | None = None
    number: str
    prompt: str
    recording_url: str | None = None
    transcript: str | None = None
    created_at: str
    completed_at: str | None = None
