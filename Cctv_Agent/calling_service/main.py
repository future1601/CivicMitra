from __future__ import annotations

import uvicorn

from .config import AUDIO_ROOT, COLLECTED_CALLS_FILE
from .app import app
from .runtime import logger, runtime


def main() -> None:
    logger.info(
        "Starting calling service: host=%s port=%s public_base_url=%s twilio_phone=%s gemini_tts_enabled=%s audio_root=%s collected_calls_file=%s",
        runtime.settings.host,
        runtime.settings.port,
        runtime.settings.public_base_url or "<empty>",
        runtime.settings.twilio_phone_number or "<empty>",
        bool(runtime.tts_service.client),
        AUDIO_ROOT,
        COLLECTED_CALLS_FILE,
    )
    uvicorn.run(
        app,
        host=runtime.settings.host,
        port=runtime.settings.port,
    )


if __name__ == "__main__":
    main()
