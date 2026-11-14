from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import events, admin, agent  # Добавили agent

app = FastAPI(
    title="Афиша культуры Башкортостана",
    version="0.3.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router)
app.include_router(admin.router)
app.include_router(agent.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "afisha-api"}


@app.get("/")
async def root():
    return {
        "service": "Афиша культуры Башкортостана",
        "docs": "/docs",
        "health": "/health",
        "agent_chat": "/api/v1/agent/chat",
    }