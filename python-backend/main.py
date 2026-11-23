from contextlib import asynccontextmanager
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()
log = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Load the face models before accepting requests (set SKIP_WARMUP=1 to disable).
    if os.getenv("SKIP_WARMUP") != "1":
        from services.face_service import warmup
        log.info("Loading face models...")
        log.info("Face models ready in %.0fs", warmup())
    yield


app = FastAPI(title="EduVerify API", version="2.0.0", lifespan=lifespan)

origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routes import attendance, face, health
app.include_router(health.router, prefix="/api")
app.include_router(face.router, prefix="/api/face")
app.include_router(attendance.router, prefix="/api/attendance")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
