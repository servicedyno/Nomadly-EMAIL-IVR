from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone
import httpx


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test')]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Node.js Express server URL (runs on port 5000)
NODEJS_URL = "http://127.0.0.1:5000"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Async HTTP client for proxying to Node.js
http_client = httpx.AsyncClient(timeout=30.0)

# Railway MongoDB for reading phone data
railway_mongo_url = os.environ.get('RAILWAY_MONGO_URL', '')
railway_client = None
railway_db = None
if railway_mongo_url:
    railway_client = AsyncIOMotorClient(railway_mongo_url)
    railway_db = railway_client[os.environ.get('DB_NAME', 'test')]

# ============================================================
# SIP Test: Serve credentials for the SIP test page
# ============================================================
@app.get("/api/sip-test-credentials")
async def get_sip_test_credentials():
    """Return first active SIP user credentials for testing."""
    if railway_db is None:
        return {"error": "Database not configured"}
    
    try:
        records = await railway_db.phoneNumbersOf.find({}).to_list(100)
        for rec in records:
            numbers = rec.get("val", {}).get("numbers", [])
            for num in numbers:
                if num.get("sipUsername") and num.get("status") == "active":
                    return {
                        "sipUsername": num["sipUsername"],
                        "sipPassword": num.get("sipPassword", ""),
                        "phoneNumber": num.get("phoneNumber", ""),
                        "provider": num.get("provider", ""),
                        "plan": num.get("plan", ""),
                    }
        return {"error": "No active SIP credentials found"}
    except Exception as e:
        logger.error(f"SIP credentials error: {e}")
        return {"error": str(e)}


# ============================================================
# PROXY: Forward all /api/* requests to Node.js Express on :5000
# ============================================================
@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_to_nodejs(request: Request, path: str):
    """Proxy all /api/* requests to the Node.js Express server on port 5000."""
    target_url = f"{NODEJS_URL}/{path}"
    
    # Build query string
    if request.query_params:
        target_url += f"?{request.query_params}"
    
    try:
        # Read body
        body = await request.body()
        
        # Forward headers (filter out host)
        headers = dict(request.headers)
        headers.pop("host", None)
        headers.pop("content-length", None)
        
        # Make the proxied request
        response = await http_client.request(
            method=request.method,
            url=target_url,
            content=body,
            headers=headers,
        )
        
        # Build response headers (filter out transfer-encoding for chunked responses)
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
    except Exception as e:
        logger.error(f"Proxy error for {path}: {str(e)}")
        return Response(content=f'{{"error":"{str(e)}"}}', status_code=502, media_type="application/json")


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
