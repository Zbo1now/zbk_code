from __future__ import annotations

import warnings

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

warnings.filterwarnings(
    "ignore",
    message=r".*resume_download.*deprecated.*",
    category=FutureWarning,
)

from model_service.api.routes import router, warmup_models
from model_service.settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.service_name,
        version="0.1.0",
        description="Embedding/Rerank model service for hybrid retrieval platform",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)

    @app.on_event("startup")
    def _warmup() -> None:
        try:
            warmup_models()
        except Exception:
            # Keep service available even if model warmup fails.
            pass

    return app


app = create_app()
