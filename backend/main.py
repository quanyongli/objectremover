import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict

from schema import FunctionCallResponse, MediaBinItem, TimelineState

load_dotenv()

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Message(BaseModel):
    # Be permissive with incoming payloads from the frontend
    model_config = ConfigDict(extra="ignore")

    message: str  # the full user message
    mentioned_scrubber_ids: list[str] | None = None  # scrubber ids mentioned via '@'
    # Accept any shape for resilience; backend does not mutate these
    timeline_state: dict[str, Any] | None = None  # current timeline state
    mediabin_items: list[dict[str, Any]] | None = None  # current media bin
    chat_history: list[dict[str, Any]] | None = None  # prior turns: [{"role":"user"|"assistant","content":"..."}]


@app.post("/ai")
async def process_ai_message(request: Message) -> FunctionCallResponse:
    """
    AI endpoint for video editor chat functionality.
    
    Note: This endpoint is currently disabled as the project uses Dify AI instead of Gemini.
    The ChatBox component should be migrated to use Dify API similar to ObjectSelectionChatBox.
    
    Returns a placeholder response indicating the endpoint is not available.
    """
    # TODO: Migrate this endpoint to use Dify API or remove if ChatBox is no longer used
    return FunctionCallResponse(
        function_call=None,
        assistant_message="此功能已迁移到 Dify AI。请使用新的 AI 助手。"
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=3000)
