from fastapi import FastAPI, Request
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
import httpx
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from typing import Optional


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test')]

# Create the main app
app = FastAPI()

# Node.js Express server URL (runs on port 5000)
NODEJS_URL = "http://127.0.0.1:5000"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Async HTTP client for proxying to Node.js (60s timeout for long WHM API calls like AutoSSL)
http_client = httpx.AsyncClient(timeout=60.0)


# ============================================================
# PROXY: Forward all /api/* requests to Node.js Express on :5000
# ============================================================
@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_to_nodejs(request: Request, path: str):
    """Proxy all /api/* requests to the Node.js Express server on port 5000."""
    target_url = f"{NODEJS_URL}/{path}"
    
    if request.query_params:
        target_url += f"?{request.query_params}"
    
    try:
        body = await request.body()
        
        headers = dict(request.headers)
        headers.pop("host", None)
        headers.pop("content-length", None)
        
        response = await http_client.request(
            method=request.method,
            url=target_url,
            content=body,
            headers=headers,
        )
        
        response_headers = dict(response.headers)
        response_headers.pop("transfer-encoding", None)
        response_headers.pop("content-encoding", None)
        response_headers.pop("content-length", None)
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=response_headers,
        )
    except httpx.ConnectError:
        logger.error(f"Cannot connect to Node.js server at {NODEJS_URL}/{path}")
        return Response(content='{"error":"Node.js server unavailable"}', status_code=502, media_type="application/json")
    except httpx.TimeoutException:
        logger.error(f"Timeout proxying to Node.js for {path}")
        return Response(content='{"error":"Request timed out — the operation may still be running"}', status_code=504, media_type="application/json")
    except Exception as e:
        logger.error(f"Proxy error for {path}: {str(e)}")
        import json as _json
        return Response(content=_json.dumps({"error": str(e)}), status_code=502, media_type="application/json")


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    await http_client.aclose()
