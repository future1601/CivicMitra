from __future__ import annotations

from datetime import datetime
from time import perf_counter

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from twilio.twiml.voice_response import VoiceResponse

from .runtime import logger, runtime
from .schemas import BroadcastCallRequest, CollectDetailsCallRequest

app = FastAPI(
    title="New Calling Service",
    description="Minimal FastAPI service for Twilio broadcast and details-collection calls.",
)


def _query_suffix(request: Request) -> str:
    return f"?{request.url.query}" if request.url.query else ""


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = perf_counter()
    path_with_query = f"{request.url.path}{_query_suffix(request)}"
    logger.info(
        "Incoming request: method=%s path=%s client=%s forwarded_host=%s forwarded_proto=%s content_type=%s user_agent=%s",
        request.method,
        path_with_query,
        request.client.host if request.client else "unknown",
        request.headers.get("x-forwarded-host", ""),
        request.headers.get("x-forwarded-proto", ""),
        request.headers.get("content-type", ""),
        request.headers.get("user-agent", ""),
    )
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (perf_counter() - start_time) * 1000
        logger.exception(
            "Request failed: method=%s path=%s duration_ms=%.1f",
            request.method,
            path_with_query,
            duration_ms,
        )
        raise

    duration_ms = (perf_counter() - start_time) * 1000
    logger.info(
        "Completed request: method=%s path=%s status=%s duration_ms=%.1f",
        request.method,
        path_with_query,
        response.status_code,
        duration_ms,
    )
    return response


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.api_route("/", methods=["GET", "POST"])
async def root() -> JSONResponse:
    return JSONResponse(
        {
            "status": "ok",
            "service": "calling-service",
            "docs": "/docs",
            "health": "/health",
            "webhook": "/webhooks/twilio/call-flow",
        }
    )


@app.get("/audio/{filename}")
async def serve_audio(filename: str) -> FileResponse:
    file_path = runtime.audio_file(filename)
    if not file_path.exists():
        logger.warning("Audio file not found: filename=%s path=%s", filename, file_path)
        raise HTTPException(status_code=404, detail="Audio file not found.")
    logger.info("Serving audio file: filename=%s path=%s", filename, file_path)
    return FileResponse(file_path, media_type="audio/wav")


@app.post("/api/calls/broadcast")
async def create_broadcast_call(
    payload: BroadcastCallRequest,
) -> JSONResponse:
    ready, message = runtime.ensure_twilio_ready()
    if not ready:
        raise HTTPException(status_code=500, detail=message)

    base_url = runtime.resolve_base_url()
    logger.info(
        "Broadcast call request: number=%s resolved_base_url=%s message_chars=%d",
        payload.number,
        base_url,
        len(payload.message),
    )
    session = runtime.create_broadcast_session(
        number=payload.number,
        message=payload.message,
        base_url=base_url,
    )
    webhook_url = (
        f"{base_url}/webhooks/twilio/call-flow"
        f"?flow=broadcast&token={session['token']}"
    )
    logger.info(
        "Broadcast session created: token=%s webhook_url=%s audio_filename=%s",
        session["token"],
        webhook_url,
        session.get("audio_filename") or "<twilio-say>",
    )

    try:
        call = runtime.twilio_client().calls.create(
            url=webhook_url,
            to=payload.number,
            from_=runtime.settings.twilio_phone_number,
            method="POST",
        )
    except Exception as exc:
        runtime.clear_session(session["token"])
        logger.error("Failed to create broadcast call: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    logger.info(
        "Broadcast call created: call_sid=%s number=%s webhook_url=%s",
        call.sid,
        payload.number,
        webhook_url,
    )

    return JSONResponse(
        {
            "status": "success",
            "flow": "broadcast",
            "call_sid": call.sid,
            "number": payload.number,
            "webhook_url": webhook_url,
        }
    )


@app.post("/api/calls/collect-details")
async def create_collect_details_call(
    payload: CollectDetailsCallRequest,
) -> JSONResponse:
    ready, message = runtime.ensure_twilio_ready()
    if not ready:
        raise HTTPException(status_code=500, detail=message)

    base_url = runtime.resolve_base_url()
    logger.info(
        "Collect-details call request: number=%s resolved_base_url=%s prompt_chars=%d location_prompt_chars=%d",
        payload.number,
        base_url,
        len(payload.prompt),
        len(payload.location_prompt),
    )
    session = runtime.create_collect_session(
        number=payload.number,
        prompt=payload.prompt,
        location_prompt=payload.location_prompt,
        base_url=base_url,
    )
    webhook_url = (
        f"{base_url}/webhooks/twilio/call-flow"
        f"?flow=collect&token={session['token']}"
    )
    logger.info(
        "Collect session created: token=%s webhook_url=%s prompt_audio_filename=%s location_prompt_audio_filename=%s",
        session["token"],
        webhook_url,
        session.get("prompt_audio_filename") or "<twilio-say>",
        session.get("location_prompt_audio_filename") or "<twilio-say>",
    )

    try:
        call = runtime.twilio_client().calls.create(
            url=webhook_url,
            to=payload.number,
            from_=runtime.settings.twilio_phone_number,
            method="POST",
        )
    except Exception as exc:
        runtime.clear_session(session["token"])
        logger.error("Failed to create collect-details call: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    logger.info(
        "Collect-details call created: call_sid=%s number=%s webhook_url=%s",
        call.sid,
        payload.number,
        webhook_url,
    )

    return JSONResponse(
        {
            "status": "success",
            "flow": "collect",
            "call_sid": call.sid,
            "number": payload.number,
            "webhook_url": webhook_url,
        }
    )


@app.api_route("/webhooks/twilio/call-flow", methods=["GET", "POST"])
async def twilio_call_flow(request: Request) -> Response:
    flow = request.query_params.get("flow", "").strip()
    token = request.query_params.get("token", "").strip()
    stage = request.query_params.get("stage", "").strip()
    logger.info(
        "Twilio webhook received: flow=%s token=%s stage=%s method=%s",
        flow or "<empty>",
        token or "<empty>",
        stage or "<empty>",
        request.method,
    )

    if not flow or not token:
        raise HTTPException(status_code=400, detail="Missing flow or token.")

    session = runtime.get_session(token)
    if not session:
        logger.warning("Twilio webhook session not found: token=%s flow=%s", token, flow)
        raise HTTPException(status_code=404, detail="Call session not found.")

    base_url = session.get("base_url") or runtime.resolve_base_url(request)
    twiml = VoiceResponse()
    logger.info(
        "Twilio webhook session resolved: token=%s flow=%s base_url=%s",
        token,
        flow,
        base_url,
    )

    if flow == "broadcast":
        audio_filename = session.get("audio_filename")
        if audio_filename:
            logger.info(
                "Broadcast webhook responding with Play: token=%s audio_filename=%s",
                token,
                audio_filename,
            )
            twiml.play(f"{base_url}/audio/{audio_filename}")
        else:
            logger.info("Broadcast webhook responding with Say fallback: token=%s", token)
            twiml.say(session["message"])
        twiml.hangup()
        runtime.clear_session(token)
        return Response(content=str(twiml), media_type="application/xml")

    if flow != "collect":
        raise HTTPException(status_code=400, detail="Unsupported flow.")

    form_data = await request.form()
    recording_url = str(form_data.get("RecordingUrl", "")).strip()
    call_sid = str(form_data.get("CallSid", "")).strip()
    logger.info(
        "Collect webhook form data: token=%s call_sid=%s has_recording_url=%s stage=%s",
        token,
        call_sid or "<empty>",
        bool(recording_url),
        stage or "<empty>",
    )

    def prompt_for_stage(
        prompt_text: str,
        audio_filename: str | None,
        next_stage: str,
        prompt_name: str,
    ) -> Response:
        if audio_filename:
            logger.info(
                "Collect webhook responding with Play %s: token=%s audio_filename=%s",
                prompt_name,
                token,
                audio_filename,
            )
            twiml.play(f"{base_url}/audio/{audio_filename}")
        else:
            logger.info(
                "Collect webhook responding with Say %s fallback: token=%s",
                prompt_name,
                token,
            )
            twiml.say(prompt_text)

        next_webhook = (
            f"{base_url}/webhooks/twilio/call-flow"
            f"?flow=collect&token={token}&stage={next_stage}"
        )
        logger.info(
            "Collect webhook requesting %s recording: token=%s next_webhook=%s",
            next_stage,
            token,
            next_webhook,
        )
        twiml.record(
            action=next_webhook,
            method="POST",
            max_length=60,
            timeout=3,
            play_beep=True,
            trim="trim-silence",
        )
        return Response(content=str(twiml), media_type="application/xml")

    if not stage:
        return prompt_for_stage(
            session["prompt"],
            session.get("prompt_audio_filename"),
            "issue",
            "issue prompt",
        )

    if stage not in {"issue", "location"}:
        raise HTTPException(status_code=400, detail="Unsupported collect stage.")

    if not recording_url:
        retry_key = "issue_retry_count" if stage == "issue" else "location_retry_count"
        retry_count = int(session.get(retry_key, 0))
        if retry_count >= 1:
            logger.warning(
                "Collect webhook missing %s recording after retry: token=%s retry_count=%d",
                stage,
                token,
                retry_count,
            )
            if stage == "issue":
                twiml.say("Sorry, no issue details were recorded. Please try again later.")
            else:
                twiml.say(
                    "Thank you. Your issue details were recorded, but the location was not captured."
                )
                runtime.save_collected_call(
                    {
                        "token": token,
                        "flow": "collect",
                        "call_sid": call_sid or None,
                        "number": session["number"],
                        "prompt": session["prompt"],
                        "location_prompt": session.get("location_prompt"),
                        "recording_url": session.get("issue_recording_url"),
                        "issue_recording_url": session.get("issue_recording_url"),
                        "location_recording_url": None,
                        "issue_transcript": session.get("issue_transcript"),
                        "location_transcript": None,
                        "transcript": session.get("issue_transcript"),
                        "created_at": session["created_at"],
                        "completed_at": datetime.utcnow().isoformat(),
                    }
                )
            twiml.hangup()
            runtime.clear_session(token)
            return Response(content=str(twiml), media_type="application/xml")

        session[retry_key] = retry_count + 1
        runtime.save_session(token, session)
        logger.info(
            "Collect webhook retrying %s recording: token=%s retry_count=%d",
            stage,
            token,
            session[retry_key],
        )
        if stage == "issue":
            twiml.say("I did not catch that. Please describe the issue after the beep.")
        else:
            twiml.say("I did not catch the location. Please state the location after the beep.")
        retry_webhook = (
            f"{base_url}/webhooks/twilio/call-flow"
            f"?flow=collect&token={token}&stage={stage}"
        )
        twiml.record(
            action=retry_webhook,
            method="POST",
            max_length=60,
            timeout=3,
            play_beep=True,
            trim="trim-silence",
        )
        return Response(content=str(twiml), media_type="application/xml")

    transcript: str | None = None
    try:
        audio_bytes = runtime.download_recording(recording_url)
        transcript = runtime.transcriber.transcribe(audio_bytes)
    except Exception as exc:
        logger.warning("Could not download or transcribe %s recording: %s", stage, exc)
    else:
        logger.info(
            "Collect webhook %s recording processed: token=%s transcript_chars=%d",
            stage,
            token,
            len(transcript or ""),
        )

    if stage == "issue":
        session["issue_recording_url"] = f"{recording_url}.mp3"
        session["issue_transcript"] = transcript
        runtime.save_session(token, session)
        return prompt_for_stage(
            session.get("location_prompt")
            or "Please state the exact location of the issue after the beep.",
            session.get("location_prompt_audio_filename"),
            "location",
            "location prompt",
        )

    issue_transcript = session.get("issue_transcript")
    location_transcript = transcript
    combined_transcript_parts = []
    if issue_transcript:
        combined_transcript_parts.append(f"Issue: {issue_transcript}")
    if location_transcript:
        combined_transcript_parts.append(f"Location: {location_transcript}")
    combined_transcript = "\n".join(combined_transcript_parts) or None

    runtime.save_collected_call(
        {
            "token": token,
            "flow": "collect",
            "call_sid": call_sid or None,
            "number": session["number"],
            "prompt": session["prompt"],
            "location_prompt": session.get("location_prompt"),
            "recording_url": session.get("issue_recording_url"),
            "issue_recording_url": session.get("issue_recording_url"),
            "location_recording_url": f"{recording_url}.mp3",
            "issue_transcript": issue_transcript,
            "location_transcript": location_transcript,
            "transcript": combined_transcript,
            "created_at": session["created_at"],
            "completed_at": datetime.utcnow().isoformat(),
        }
    )
    logger.info(
        "Collect webhook completed: token=%s call_sid=%s issue_present=%s location_present=%s",
        token,
        call_sid or "<empty>",
        bool(issue_transcript),
        bool(location_transcript),
    )
    runtime.clear_session(token)
    twiml.say("Thank you. Your issue details and location have been recorded.")
    twiml.hangup()
    return Response(content=str(twiml), media_type="application/xml")
