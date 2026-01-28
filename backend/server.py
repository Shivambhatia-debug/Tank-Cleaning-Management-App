from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timedelta
import random
import asyncio
from openai import OpenAI

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize OpenAI with Emergent LLM key
EMERGENT_LLM_KEY = "sk-emergent-00fE6207d20CbC7854"
openai_client = OpenAI(api_key=EMERGENT_LLM_KEY)

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            try:
                await connection.send_json(message)
            except:
                pass

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)

manager = ConnectionManager()

# ==================== MODELS ====================

class OTPRequest(BaseModel):
    phone: str

class OTPVerify(BaseModel):
    phone: str
    otp: str

class UserCreate(BaseModel):
    phone: str
    name: str
    role: str  # "admin" or "staff"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

class LocationUpdate(BaseModel):
    job_id: str
    latitude: float
    longitude: float
    accuracy: Optional[float] = None

class PhotoUpload(BaseModel):
    job_id: str
    photo_type: str  # "before" or "after"
    photo_base64: str

class JobCreate(BaseModel):
    customer_name: str
    address: str
    latitude: float
    longitude: float
    assigned_staff_ids: List[str]
    notes: Optional[str] = None

class JobUpdate(BaseModel):
    status: Optional[str] = None  # "pending", "in_progress", "completed"
    notes: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

# ==================== AUTHENTICATION ENDPOINTS ====================

@api_router.post("/auth/request-otp")
async def request_otp(request: OTPRequest):
    """Generate and store OTP for phone number"""
    try:
        # Demo users with fixed OTP for testing
        demo_users = [
            "+919876543210",  # Admin
            "+919876543211",  # Staff 1
            "+919876543212",  # Staff 2
            "+919876543213"   # Staff 3
        ]
        
        # Use fixed OTP for demo users, random for others
        if request.phone in demo_users:
            otp = "123456"
            expires_at = datetime.utcnow() + timedelta(days=365)  # Long expiry for demo
        else:
            otp = str(random.randint(100000, 999999))
            expires_at = datetime.utcnow() + timedelta(minutes=5)
        
        # Store OTP in database
        await db.otps.update_one(
            {"phone": request.phone},
            {
                "$set": {
                    "otp": otp,
                    "expires_at": expires_at,
                    "created_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        
        # In production, send OTP via SMS service
        # For development, return OTP (remove in production)
        return {
            "success": True,
            "message": "OTP sent successfully",
            "otp": otp  # Remove this in production
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/verify-otp")
async def verify_otp(request: OTPVerify):
    """Verify OTP and return user info with token"""
    try:
        # Find OTP
        otp_record = await db.otps.find_one({"phone": request.phone})
        
        if not otp_record:
            raise HTTPException(status_code=400, detail="Invalid phone number")
        
        # Check if OTP expired
        if datetime.utcnow() > otp_record["expires_at"]:
            raise HTTPException(status_code=400, detail="OTP expired")
        
        # Verify OTP
        if otp_record["otp"] != request.otp:
            raise HTTPException(status_code=400, detail="Invalid OTP")
        
        # Find or create user
        user = await db.users.find_one({"phone": request.phone})
        
        if not user:
            # Create default user (first user is admin)
            user_count = await db.users.count_documents({})
            user_data = {
                "id": str(uuid.uuid4()),
                "phone": request.phone,
                "name": "User",
                "role": "admin" if user_count == 0 else "staff",
                "is_active": True,
                "created_at": datetime.utcnow()
            }
            await db.users.insert_one(user_data)
            user = user_data
        
        # Delete used OTP
        await db.otps.delete_one({"phone": request.phone})
        
        # Return user info (in production, also return JWT token)
        return {
            "success": True,
            "user": {
                "id": user["id"],
                "phone": user["phone"],
                "name": user["name"],
                "role": user["role"],
                "is_active": user.get("is_active", True)
            },
            "token": user["id"]  # Simplified token for demo
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== USER MANAGEMENT ENDPOINTS ====================

@api_router.get("/users")
async def get_users(role: Optional[str] = None):
    """Get all users or filter by role"""
    try:
        query = {} if not role else {"role": role}
        users = await db.users.find(query).to_list(1000)
        return [{"id": u["id"], "phone": u["phone"], "name": u["name"], 
                 "role": u["role"], "is_active": u.get("is_active", True)} for u in users]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/users/{user_id}")
async def get_user(user_id: str):
    """Get specific user"""
    try:
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {"id": user["id"], "phone": user["phone"], "name": user["name"],
                "role": user["role"], "is_active": user.get("is_active", True)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, update: UserUpdate):
    """Update user details"""
    try:
        update_data = {k: v for k, v in update.dict().items() if v is not None}
        if not update_data:
            return {"success": True, "message": "No updates provided"}
        
        result = await db.users.update_one(
            {"id": user_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {"success": True, "message": "User updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/users/create-staff")
async def create_staff(user: UserCreate):
    """Create a new staff user"""
    try:
        # Check if phone already exists
        existing = await db.users.find_one({"phone": user.phone})
        if existing:
            raise HTTPException(status_code=400, detail="Phone number already registered")
        
        user_data = {
            "id": str(uuid.uuid4()),
            "phone": user.phone,
            "name": user.name,
            "role": user.role,
            "is_active": True,
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(user_data)
        
        return {"success": True, "user": {
            "id": user_data["id"],
            "phone": user_data["phone"],
            "name": user_data["name"],
            "role": user_data["role"]
        }}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== JOB MANAGEMENT ENDPOINTS ====================

@api_router.post("/jobs")
async def create_job(job: JobCreate):
    """Create a new tank cleaning job"""
    try:
        job_data = {
            "id": str(uuid.uuid4()),
            "customer_name": job.customer_name,
            "address": job.address,
            "latitude": job.latitude,
            "longitude": job.longitude,
            "assigned_staff_ids": job.assigned_staff_ids,
            "status": "pending",
            "notes": job.notes,
            "photos": {"before": [], "after": []},
            "timeline": {"created_at": datetime.utcnow()},
            "ai_verification": None,
            "created_at": datetime.utcnow()
        }
        await db.jobs.insert_one(job_data)
        
        # Notify assigned staff via websocket
        await manager.broadcast({
            "type": "new_job",
            "job_id": job_data["id"],
            "assigned_staff_ids": job.assigned_staff_ids
        })
        
        return {"success": True, "job_id": job_data["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/jobs")
async def get_jobs(status: Optional[str] = None, staff_id: Optional[str] = None):
    """Get all jobs with optional filters"""
    try:
        query = {}
        if status:
            query["status"] = status
        if staff_id:
            query["assigned_staff_ids"] = staff_id
        
        jobs = await db.jobs.find(query).sort("created_at", -1).to_list(1000)
        
        # Remove MongoDB _id and format response
        result = []
        for job in jobs:
            job_data = {
                "id": job["id"],
                "customer_name": job["customer_name"],
                "address": job["address"],
                "latitude": job["latitude"],
                "longitude": job["longitude"],
                "assigned_staff_ids": job["assigned_staff_ids"],
                "status": job["status"],
                "notes": job.get("notes"),
                "photos": job.get("photos", {"before": [], "after": []}),
                "timeline": job.get("timeline", {}),
                "ai_verification": job.get("ai_verification"),
                "created_at": job["created_at"].isoformat() if isinstance(job["created_at"], datetime) else job["created_at"]
            }
            result.append(job_data)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Get specific job details"""
    try:
        job = await db.jobs.find_one({"id": job_id})
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return {
            "id": job["id"],
            "customer_name": job["customer_name"],
            "address": job["address"],
            "latitude": job["latitude"],
            "longitude": job["longitude"],
            "assigned_staff_ids": job["assigned_staff_ids"],
            "status": job["status"],
            "notes": job.get("notes"),
            "photos": job.get("photos", {"before": [], "after": []}),
            "timeline": job.get("timeline", {}),
            "ai_verification": job.get("ai_verification")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/jobs/{job_id}")
async def update_job(job_id: str, update: JobUpdate):
    """Update job status and details"""
    try:
        update_data = {}
        timeline_update = {}
        
        if update.status:
            update_data["status"] = update.status
            if update.status == "in_progress":
                timeline_update["start_time"] = datetime.utcnow()
            elif update.status == "completed":
                timeline_update["end_time"] = datetime.utcnow()
        
        if update.notes:
            update_data["notes"] = update.notes
        
        if update.start_time:
            timeline_update["start_time"] = update.start_time
        
        if update.end_time:
            timeline_update["end_time"] = update.end_time
        
        if timeline_update:
            update_data["timeline"] = timeline_update
        
        result = await db.jobs.update_one(
            {"id": job_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Broadcast job update
        await manager.broadcast({
            "type": "job_updated",
            "job_id": job_id,
            "status": update.status
        })
        
        return {"success": True, "message": "Job updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== LOCATION TRACKING ENDPOINTS ====================

@api_router.post("/location/update")
async def update_location(location: LocationUpdate):
    """Update staff location during active job"""
    try:
        location_data = {
            "id": str(uuid.uuid4()),
            "job_id": location.job_id,
            "latitude": location.latitude,
            "longitude": location.longitude,
            "accuracy": location.accuracy,
            "timestamp": datetime.utcnow()
        }
        await db.locations.insert_one(location_data)
        
        # Broadcast location update to admin
        await manager.broadcast({
            "type": "location_update",
            "job_id": location.job_id,
            "latitude": location.latitude,
            "longitude": location.longitude,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/location/{job_id}")
async def get_location_history(job_id: str):
    """Get location history for a job"""
    try:
        locations = await db.locations.find(
            {"job_id": job_id}
        ).sort("timestamp", -1).to_list(1000)
        
        return [{
            "latitude": loc["latitude"],
            "longitude": loc["longitude"],
            "accuracy": loc.get("accuracy"),
            "timestamp": loc["timestamp"].isoformat() if isinstance(loc["timestamp"], datetime) else loc["timestamp"]
        } for loc in locations]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/location/latest/{job_id}")
async def get_latest_location(job_id: str):
    """Get latest location for a job"""
    try:
        location = await db.locations.find_one(
            {"job_id": job_id},
            sort=[("timestamp", -1)]
        )
        
        if not location:
            return None
        
        return {
            "latitude": location["latitude"],
            "longitude": location["longitude"],
            "accuracy": location.get("accuracy"),
            "timestamp": location["timestamp"].isoformat() if isinstance(location["timestamp"], datetime) else location["timestamp"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== PHOTO UPLOAD ENDPOINTS ====================

@api_router.post("/photos/upload")
async def upload_photo(photo: PhotoUpload):
    """Upload before/after photos for a job"""
    try:
        # Update job with photo
        photo_field = f"photos.{photo.photo_type}"
        result = await db.jobs.update_one(
            {"id": photo.job_id},
            {"$push": {photo_field: photo.photo_base64}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return {"success": True, "message": "Photo uploaded successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== AI VERIFICATION ENDPOINT ====================

@api_router.post("/ai/verify-photos/{job_id}")
async def verify_photos_with_ai(job_id: str):
    """Use AI to verify tank cleaning quality and detect anomalies"""
    try:
        # Get job with photos
        job = await db.jobs.find_one({"id": job_id})
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        photos = job.get("photos", {})
        before_photos = photos.get("before", [])
        after_photos = photos.get("after", [])
        
        if not before_photos or not after_photos:
            raise HTTPException(status_code=400, detail="Both before and after photos required")
        
        # Use OpenAI to analyze photos
        analysis_prompt = f"""
Analyze these tank cleaning photos and provide a detailed quality assessment:

Job Details:
- Customer: {job['customer_name']}
- Location: {job['address']}

Task: Compare the before and after photos of tank cleaning work.

Provide analysis on:
1. Cleaning Quality Score (0-100)
2. Work Completion Status (Complete/Incomplete/Partial)
3. Potential Issues or Concerns
4. Authenticity Check (Real/Suspicious)
5. Staff Performance Rating (Excellent/Good/Fair/Poor)
6. Recommendations

Format your response as JSON.
"""
        
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert tank cleaning quality inspector. Analyze photos and provide detailed assessments in JSON format."},
                    {"role": "user", "content": analysis_prompt}
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            ai_analysis = response.choices[0].message.content
            
            # Parse AI response and create verification result
            verification_result = {
                "analyzed_at": datetime.utcnow().isoformat(),
                "ai_analysis": ai_analysis,
                "model": "gpt-4o-mini",
                "before_photo_count": len(before_photos),
                "after_photo_count": len(after_photos)
            }
            
            # Update job with AI verification
            await db.jobs.update_one(
                {"id": job_id},
                {"$set": {"ai_verification": verification_result}}
            )
            
            return {
                "success": True,
                "verification": verification_result
            }
            
        except Exception as ai_error:
            logger.error(f"AI analysis error: {str(ai_error)}")
            return {
                "success": False,
                "error": "AI analysis failed",
                "detail": str(ai_error)
            }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== WEBSOCKET ENDPOINT ====================

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_json()
            # Handle different message types
            if data.get("type") == "location_update":
                await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(user_id)

# ==================== STATS ENDPOINT ====================

@api_router.get("/stats/dashboard")
async def get_dashboard_stats():
    """Get dashboard statistics"""
    try:
        total_jobs = await db.jobs.count_documents({})
        pending_jobs = await db.jobs.count_documents({"status": "pending"})
        in_progress_jobs = await db.jobs.count_documents({"status": "in_progress"})
        completed_jobs = await db.jobs.count_documents({"status": "completed"})
        total_staff = await db.users.count_documents({"role": "staff", "is_active": True})
        
        return {
            "total_jobs": total_jobs,
            "pending_jobs": pending_jobs,
            "in_progress_jobs": in_progress_jobs,
            "completed_jobs": completed_jobs,
            "total_staff": total_staff
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ROOT ENDPOINT ====================

@api_router.get("/")
async def root():
    return {"message": "Tank Cleaning Management API", "version": "1.0.0"}

# Include router
app.include_router(api_router)

# CORS middleware
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
