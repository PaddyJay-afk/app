from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
from enum import Enum
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class PropType(str, Enum):
    stainless = "stainless"
    aluminum = "aluminum"
    bronze = "bronze"

class JobStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"

# Data Models
class BoatInfo(BaseModel):
    year: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    length: Optional[str] = None
    hin: Optional[str] = None

class EngineInfo(BaseModel):
    engine_type: Optional[str] = None
    serial_number: Optional[str] = None
    year: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    horsepower: Optional[str] = None
    hours: Optional[str] = None

class CustomerImage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    base64_data: str
    description: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str
    status: JobStatus = JobStatus.pending
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Note(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str
    author: str = "User"
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Customer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    boat: BoatInfo = Field(default_factory=BoatInfo)
    engine: EngineInfo = Field(default_factory=EngineInfo)
    prop_type: Optional[PropType] = None
    images: List[CustomerImage] = Field(default_factory=list)
    jobs: List[Job] = Field(default_factory=list)
    notes: List[Note] = Field(default_factory=list)
    last_activity: datetime = Field(default_factory=datetime.utcnow)

class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    boat: Optional[BoatInfo] = None
    engine: Optional[EngineInfo] = None
    prop_type: Optional[PropType] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    boat: Optional[BoatInfo] = None
    engine: Optional[EngineInfo] = None
    prop_type: Optional[PropType] = None

class ImageUpload(BaseModel):
    base64_data: str
    description: Optional[str] = None

class JobCreate(BaseModel):
    description: str

class JobUpdate(BaseModel):
    description: Optional[str] = None
    status: Optional[JobStatus] = None

class NoteCreate(BaseModel):
    content: str
    author: str = "User"

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Boat Repair Customer Management API"}


def _safe_float(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _fetch_json(url: str):
    response = requests.get(url, timeout=12)
    response.raise_for_status()
    return response.json()


def _open_meteo_snapshot(lat: float, lon: float):
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&current=temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,"
        "relative_humidity_2m,cloud_cover,uv_index,is_day,weather_code"
    )
    payload = _fetch_json(url)
    current = payload.get("current", {})
    return {
        "timestamp": current.get("time"),
        "temperature_c": _safe_float(current.get("temperature_2m")),
        "pressure_hpa": _safe_float(current.get("pressure_msl")),
        "wind_speed_kph": _safe_float(current.get("wind_speed_10m")),
        "wind_direction_deg": _safe_float(current.get("wind_direction_10m")),
        "humidity_pct": _safe_float(current.get("relative_humidity_2m")),
        "cloud_cover_pct": _safe_float(current.get("cloud_cover")),
        "uv_index": _safe_float(current.get("uv_index")),
    }


def _swpc_space_snapshot():
    # Free NOAA SWPC endpoints (no API key required)
    k_index_rows = _fetch_json("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json")
    plasma_rows = _fetch_json("https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json")
    mag_rows = _fetch_json("https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json")

    k_latest = k_index_rows[-1] if len(k_index_rows) > 1 else []
    plasma_latest = plasma_rows[-1] if len(plasma_rows) > 1 else []
    mag_latest = mag_rows[-1] if len(mag_rows) > 1 else []

    return {
        "kp_index": _safe_float(k_latest[1] if len(k_latest) > 1 else None),
        "kp_timestamp": k_latest[0] if len(k_latest) > 0 else None,
        "solar_wind_speed_km_s": _safe_float(plasma_latest[2] if len(plasma_latest) > 2 else None),
        "solar_wind_density_p_cm3": _safe_float(plasma_latest[1] if len(plasma_latest) > 1 else None),
        "solar_wind_timestamp": plasma_latest[0] if len(plasma_latest) > 0 else None,
        "interplanetary_bt_nt": _safe_float(mag_latest[1] if len(mag_latest) > 1 else None),
        "interplanetary_bz_nt": _safe_float(mag_latest[3] if len(mag_latest) > 3 else None),
        "mag_timestamp": mag_latest[0] if len(mag_latest) > 0 else None,
    }


@api_router.get("/uap/telemetry")
async def get_uap_telemetry(lat: float = 36.7783, lon: float = -119.4179):
    """
    Free, no-key telemetry blend for UAP skywatch:
    - Open-Meteo for local atmospheric values
    - NOAA SWPC for geomagnetic/solar-wind variables
    """
    try:
        weather = _open_meteo_snapshot(lat, lon)
        space = _swpc_space_snapshot()
        estimated_cloud_potential_kv = (
            round((weather["cloud_cover_pct"] or 0) * (weather["humidity_pct"] or 0) * 0.08, 2)
        )
        dusty_plasma_index = round(
            ((space["solar_wind_density_p_cm3"] or 0) * 0.4)
            + ((space["interplanetary_bt_nt"] or 0) * 0.8)
            + ((weather["cloud_cover_pct"] or 0) * 0.03),
            2,
        )

        return {
            "source": {
                "weather": "Open-Meteo (free, no-key)",
                "space": "NOAA SWPC public products (free, no-key)",
            },
            "location": {"lat": lat, "lon": lon},
            "captured_at": datetime.utcnow().isoformat(),
            "weather": weather,
            "space_weather": space,
            "experimental": {
                "estimated_cloud_potential_kv": estimated_cloud_potential_kv,
                "dusty_plasma_index": dusty_plasma_index,
            },
        }
    except requests.RequestException as exc:
        raise HTTPException(status_code=503, detail=f"Upstream telemetry source unavailable: {exc}")

# Customer endpoints
@api_router.post("/customers", response_model=Customer)
async def create_customer(customer_data: CustomerCreate):
    customer_dict = customer_data.dict()
    if customer_dict.get('boat') is None:
        customer_dict['boat'] = {}
    if customer_dict.get('engine') is None:
        customer_dict['engine'] = {}
    
    customer = Customer(**customer_dict)
    result = await db.customers.insert_one(customer.dict())
    return customer

@api_router.get("/customers", response_model=List[Customer])
async def get_customers():
    customers = await db.customers.find().to_list(1000)
    # Sort by last_activity (most recent first) then by name alphabetically
    sorted_customers = sorted(customers, key=lambda x: (-x.get('last_activity', datetime.min).timestamp(), x.get('name', '').lower()))
    return [Customer(**customer) for customer in sorted_customers]

@api_router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str):
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return Customer(**customer)

@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, customer_data: CustomerUpdate):
    existing_customer = await db.customers.find_one({"id": customer_id})
    if not existing_customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    update_data = customer_data.dict(exclude_unset=True)
    update_data['last_activity'] = datetime.utcnow()
    
    await db.customers.update_one({"id": customer_id}, {"$set": update_data})
    updated_customer = await db.customers.find_one({"id": customer_id})
    return Customer(**updated_customer)

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted successfully"}

# Image endpoints
@api_router.post("/customers/{customer_id}/images")
async def add_customer_image(customer_id: str, image_data: ImageUpload):
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    new_image = CustomerImage(**image_data.dict())
    
    await db.customers.update_one(
        {"id": customer_id},
        {
            "$push": {"images": new_image.dict()},
            "$set": {"last_activity": datetime.utcnow()}
        }
    )
    return {"message": "Image added successfully", "image_id": new_image.id}

@api_router.delete("/customers/{customer_id}/images/{image_id}")
async def delete_customer_image(customer_id: str, image_id: str):
    result = await db.customers.update_one(
        {"id": customer_id},
        {
            "$pull": {"images": {"id": image_id}},
            "$set": {"last_activity": datetime.utcnow()}
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Image deleted successfully"}

# Job endpoints
@api_router.post("/customers/{customer_id}/jobs")
async def add_customer_job(customer_id: str, job_data: JobCreate):
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    new_job = Job(**job_data.dict())
    
    await db.customers.update_one(
        {"id": customer_id},
        {
            "$push": {"jobs": new_job.dict()},
            "$set": {"last_activity": datetime.utcnow()}
        }
    )
    return {"message": "Job added successfully", "job_id": new_job.id}

@api_router.put("/customers/{customer_id}/jobs/{job_id}")
async def update_customer_job(customer_id: str, job_id: str, job_data: JobUpdate):
    update_data = job_data.dict(exclude_unset=True)
    update_data['updated_at'] = datetime.utcnow()
    
    # Create update query for nested job object
    update_fields = {}
    for key, value in update_data.items():
        update_fields[f"jobs.$.{key}"] = value
    
    result = await db.customers.update_one(
        {"id": customer_id, "jobs.id": job_id},
        {
            "$set": {**update_fields, "last_activity": datetime.utcnow()}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer or job not found")
    return {"message": "Job updated successfully"}

@api_router.delete("/customers/{customer_id}/jobs/{job_id}")
async def delete_customer_job(customer_id: str, job_id: str):
    result = await db.customers.update_one(
        {"id": customer_id},
        {
            "$pull": {"jobs": {"id": job_id}},
            "$set": {"last_activity": datetime.utcnow()}
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Job deleted successfully"}

# Note endpoints
@api_router.post("/customers/{customer_id}/notes")
async def add_customer_note(customer_id: str, note_data: NoteCreate):
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    new_note = Note(**note_data.dict())
    
    await db.customers.update_one(
        {"id": customer_id},
        {
            "$push": {"notes": new_note.dict()},
            "$set": {"last_activity": datetime.utcnow()}
        }
    )
    return {"message": "Note added successfully", "note_id": new_note.id}

@api_router.delete("/customers/{customer_id}/notes/{note_id}")
async def delete_customer_note(customer_id: str, note_id: str):
    result = await db.customers.update_one(
        {"id": customer_id},
        {
            "$pull": {"notes": {"id": note_id}},
            "$set": {"last_activity": datetime.utcnow()}
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Note deleted successfully"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
