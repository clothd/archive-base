from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ArcHive API")

# MUST be added before routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers after middleware
from app.routers import auth, pipelines, pins, documents  # noqa: E402

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(pipelines.router, prefix="/pipelines", tags=["pipelines"])
app.include_router(pins.router, prefix="/pins", tags=["pins"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])


@app.get("/health")
def health():
    return {"status": "ok"}
