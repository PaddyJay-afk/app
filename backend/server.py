from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional
import hashlib
import hmac
import os
import uuid

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="LakeReady Intake API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_TTL_HOURS = int(os.getenv("JWT_TTL_HOURS", "12"))
DEFAULT_ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "owner@lakeready.local")
DEFAULT_ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "LakeReady123!")


class PreferredContact(str, Enum):
    call = "call"
    text = "text"
    email = "email"


class CustomerType(str, Enum):
    new = "new"
    existing = "existing"


class EngineCount(str, Enum):
    single = "single"
    twin = "twin"


class Status(str, Enum):
    new = "New"
    reviewed = "Reviewed"
    contacted = "Contacted"
    scheduled = "Scheduled"
    converted = "Converted"
    closed = "Closed"
    spam = "Spam"


class Urgency(str, Enum):
    stranded = "stranded/on water"
    taking_water = "taking on water"
    unusable = "boat unusable"
    trip_soon = "trip planned soon"
    normal = "normal service"
    not_urgent = "not urgent"


class UploadPayload(BaseModel):
    fileName: str
    fileType: str
    fileUrl: str
    notes: Optional[str] = ""


class ServiceRequestCreate(BaseModel):
    honeypot: Optional[str] = ""
    customerName: str
    customerPhone: str
    customerEmail: Optional[EmailStr] = None
    preferredContactMethod: PreferredContact
    bestCallbackTime: Optional[str] = ""
    customerType: CustomerType
    boatYear: Optional[str] = ""
    boatMake: Optional[str] = ""
    boatModel: Optional[str] = ""
    boatLocationType: str
    boatLocationDetails: Optional[str] = ""
    hullOrRegistration: Optional[str] = ""
    engineType: str
    engineBrand: str
    engineModel: Optional[str] = ""
    engineHours: Optional[str] = ""
    engineCount: EngineCount
    problemCategory: str
    issueDescription: str
    startTimeDescription: Optional[str] = ""
    precedingEvent: Optional[str] = ""
    engineRuns: Optional[str] = ""
    alarmsOrCodes: Optional[str] = ""
    recentService: Optional[str] = ""
    fuelInfo: Optional[str] = ""
    batteryInfo: Optional[str] = ""
    urgency: Urgency
    disclaimerAccepted: bool
    uploadedFiles: List[UploadPayload] = Field(default_factory=list)


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class StatusUpdate(BaseModel):
    status: Status
    internalNotes: Optional[str] = ""


class SettingsUpdate(BaseModel):
    name: str
    logoUrl: Optional[str] = ""
    businessHours: Optional[str] = ""
    serviceEmail: EmailStr
    notificationPhone: Optional[str] = ""
    disclaimerText: str
    categoryCustomization: List[str] = Field(default_factory=list)
    engineBrandCustomization: List[str] = Field(default_factory=list)
    webhookUrl: Optional[str] = ""


RATE_LIMIT_WINDOW_SECONDS = 30
RATE_LIMIT_MAX = 5
request_times: Dict[str, List[datetime]] = {}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _sign(payload: str) -> str:
    return hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()


def create_token(user_id: str, shop_id: str) -> str:
    exp = int((now_utc() + timedelta(hours=JWT_TTL_HOURS)).timestamp())
    payload = f"{user_id}:{shop_id}:{exp}"
    return f"{payload}:{_sign(payload)}"


def verify_token(token: str) -> Dict[str, str]:
    parts = token.split(":")
    if len(parts) != 4:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id, shop_id, exp, signature = parts
    payload = f"{user_id}:{shop_id}:{exp}"
    if not hmac.compare_digest(signature, _sign(payload)):
        raise HTTPException(status_code=401, detail="Invalid token signature")
    if int(exp) < int(now_utc().timestamp()):
        raise HTTPException(status_code=401, detail="Token expired")
    return {"user_id": user_id, "shop_id": shop_id}


async def get_auth_context(credentials: HTTPAuthorizationCredentials = security) -> Dict[str, str]:
    return verify_token(credentials.credentials)


def build_summary(data: ServiceRequestCreate) -> str:
    return (
        f"{data.customerName} reported '{data.problemCategory}' on a {data.boatYear} {data.boatMake} {data.boatModel}. "
        f"Engine: {data.engineBrand} {data.engineModel} ({data.engineType}, {data.engineCount}). "
        f"Urgency: {data.urgency}. Runs now: {data.engineRuns or 'unknown'}. "
        f"Start: {data.startTimeDescription or 'not specified'}. Contact via {data.preferredContactMethod}."
    )


def compute_priority(urgency: Urgency, category: str) -> int:
    category = category.lower()
    high = {
        "overheating",
        "alarm/limp mode",
        "no start/no crank",
    }
    medium = {"rough running", "low power/won’t plane", "vibration", "electrical issue"}

    if urgency in {Urgency.stranded, Urgency.taking_water, Urgency.unusable} or category in high:
        return 90
    if urgency == Urgency.trip_soon or category in medium:
        return 60
    if urgency in {Urgency.normal, Urgency.not_urgent} or category in {
        "maintenance",
        "winterization",
        "spring commissioning",
    }:
        return 30
    return 45


async def ensure_default_shop() -> Dict[str, Any]:
    existing = await db.shops.find_one({"name": "LakeReady Demo Shop"})
    if existing:
        return existing

    shop_id = str(uuid.uuid4())
    shop = {
        "id": shop_id,
        "name": "LakeReady Demo Shop",
        "logoUrl": "",
        "businessHours": "Mon-Fri 8:00 AM - 5:00 PM",
        "serviceEmail": "service@lakeready.local",
        "notificationPhone": "",
        "disclaimerText": "If there is immediate danger, call 911 or local marine emergency services.",
        "categoryCustomization": [],
        "engineBrandCustomization": [],
        "webhookUrl": "",
        "createdAt": now_utc(),
    }
    await db.shops.insert_one(shop)

    user = {
        "id": str(uuid.uuid4()),
        "shopId": shop_id,
        "name": "Owner",
        "email": DEFAULT_ADMIN_EMAIL,
        "password": DEFAULT_ADMIN_PASSWORD,
        "role": "owner",
        "createdAt": now_utc(),
    }
    await db.users.insert_one(user)
    return shop


@api_router.get("/")
async def root() -> Dict[str, str]:
    return {"message": "LakeReady Intake API"}


@api_router.post("/auth/login")
async def login(payload: LoginInput) -> Dict[str, Any]:
    shop = await ensure_default_shop()
    user = await db.users.find_one({"email": payload.email})
    if not user or payload.password != user.get("password"):
        raise HTTPException(status_code=401, detail="Invalid email/password")

    token = create_token(user["id"], user["shopId"])
    return {
        "token": token,
        "user": {"name": user["name"], "email": user["email"], "role": user["role"]},
        "shop": {"id": shop["id"], "name": shop["name"]},
    }


@api_router.get("/public/config")
async def public_config() -> Dict[str, str]:
    shop = await ensure_default_shop()
    return {
        "shopName": shop["name"],
        "logoUrl": shop.get("logoUrl", ""),
        "disclaimerText": shop["disclaimerText"],
    }


@api_router.post("/public/service-requests")
async def create_service_request(payload: ServiceRequestCreate, request: Request) -> Dict[str, Any]:
    await ensure_default_shop()

    if payload.honeypot:
        raise HTTPException(status_code=400, detail="Spam detected")
    if not payload.disclaimerAccepted:
        raise HTTPException(status_code=400, detail="Disclaimer acknowledgement required")

    ip = request.client.host if request.client else "unknown"
    now = now_utc()
    bucket = [ts for ts in request_times.get(ip, []) if (now - ts).total_seconds() < RATE_LIMIT_WINDOW_SECONDS]
    if len(bucket) >= RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Too many attempts")
    bucket.append(now)
    request_times[ip] = bucket

    shop = await db.shops.find_one({"name": "LakeReady Demo Shop"})
    count = await db.service_requests.count_documents({"shopId": shop["id"]})
    request_number = f"LR-{count + 1:05d}"

    req_id = str(uuid.uuid4())
    priority = compute_priority(payload.urgency, payload.problemCategory)
    summary = build_summary(payload)

    doc = {
        "id": req_id,
        "shopId": shop["id"],
        "requestNumber": request_number,
        **payload.model_dump(exclude={"uploadedFiles", "honeypot"}),
        "aiSummary": summary,
        "priorityScore": priority,
        "status": Status.new.value,
        "internalNotes": "",
        "createdAt": now,
        "updatedAt": now,
    }
    await db.service_requests.insert_one(doc)

    files = []
    for file in payload.uploadedFiles:
        file_doc = {
            "id": str(uuid.uuid4()),
            "serviceRequestId": req_id,
            "fileUrl": file.fileUrl,
            "fileName": file.fileName,
            "fileType": file.fileType,
            "notes": file.notes,
            "createdAt": now,
        }
        files.append(file_doc)

    if files:
        await db.uploaded_files.insert_many(files)

    await db.automation_logs.insert_one(
        {
            "id": str(uuid.uuid4()),
            "serviceRequestId": req_id,
            "eventType": "email_notification_prepared",
            "status": "ready",
            "message": f"Prepared notification for {shop['serviceEmail']} - {request_number}",
            "createdAt": now,
        }
    )

    return {"requestId": req_id, "requestNumber": request_number, "summary": summary}


@api_router.get("/admin/service-requests")
async def list_service_requests(auth: Dict[str, str] = security):
    ctx = verify_token(auth.credentials)
    rows = await db.service_requests.find({"shopId": ctx["shop_id"]}).sort("createdAt", -1).to_list(500)
    for row in rows:
        row["files"] = await db.uploaded_files.find({"serviceRequestId": row["id"]}).to_list(20)
    return rows


@api_router.get("/admin/service-requests/{request_id}")
async def request_detail(request_id: str, auth: Dict[str, str] = security):
    ctx = verify_token(auth.credentials)
    row = await db.service_requests.find_one({"id": request_id, "shopId": ctx["shop_id"]})
    if not row:
        raise HTTPException(status_code=404, detail="Request not found")
    row["files"] = await db.uploaded_files.find({"serviceRequestId": request_id}).to_list(20)
    return row


@api_router.patch("/admin/service-requests/{request_id}")
async def update_request(request_id: str, payload: StatusUpdate, auth: Dict[str, str] = security):
    ctx = verify_token(auth.credentials)
    result = await db.service_requests.update_one(
        {"id": request_id, "shopId": ctx["shop_id"]},
        {"$set": {"status": payload.status.value, "internalNotes": payload.internalNotes, "updatedAt": now_utc()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"ok": True}


@api_router.get("/admin/morning-digest")
async def morning_digest(auth: Dict[str, str] = security):
    ctx = verify_token(auth.credentials)
    since = now_utc() - timedelta(hours=16)
    rows = await db.service_requests.find(
        {"shopId": ctx["shop_id"], "createdAt": {"$gte": since}}
    ).sort("priorityScore", -1).to_list(500)

    lines = ["LakeReady Intake Morning Digest", f"Generated: {now_utc().isoformat()}", ""]
    for row in rows:
        lines.append(
            f"{row['requestNumber']} | {row['urgency']} | {row['customerName']} | {row['problemCategory']} | {row['status']}"
        )
    return {"count": len(rows), "digestText": "\n".join(lines), "requests": rows}


@api_router.get("/admin/settings")
async def get_settings(auth: Dict[str, str] = security):
    ctx = verify_token(auth.credentials)
    shop = await db.shops.find_one({"id": ctx["shop_id"]})
    return shop


@api_router.put("/admin/settings")
async def update_settings(payload: SettingsUpdate, auth: Dict[str, str] = security):
    ctx = verify_token(auth.credentials)
    await db.shops.update_one(
        {"id": ctx["shop_id"]},
        {"$set": {**payload.model_dump(), "updatedAt": now_utc()}},
    )
    return {"ok": True}


@api_router.post("/integrations/webhook/{provider}")
async def inbound_webhook(provider: str, body: Dict[str, Any], x_signature: Optional[str] = Header(default=None)):
    await db.automation_logs.insert_one(
        {
            "id": str(uuid.uuid4()),
            "serviceRequestId": body.get("serviceRequestId", "external"),
            "eventType": f"webhook_{provider}",
            "status": "received",
            "message": f"Signature={x_signature or 'none'} Payload keys={list(body.keys())}",
            "createdAt": now_utc(),
        }
    )
    return {"ok": True, "provider": provider}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client() -> None:
    client.close()
