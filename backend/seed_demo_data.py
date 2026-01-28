"""
Demo Data Seeding Script for Tank Cleaning App Testing
Creates test users, jobs, and sample data
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timedelta
import uuid

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'tank_cleaning_db')

async def seed_demo_data():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🚀 Starting demo data seeding...")
    
    # Clear existing data
    print("🗑️  Clearing existing data...")
    await db.users.delete_many({})
    await db.jobs.delete_many({})
    await db.otps.delete_many({})
    await db.locations.delete_many({})
    
    # Create Admin User
    admin_user = {
        "id": str(uuid.uuid4()),
        "phone": "+919876543210",
        "name": "Admin Kumar",
        "role": "admin",
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    await db.users.insert_one(admin_user)
    print(f"✅ Admin created: {admin_user['phone']}")
    
    # Create Staff Users
    staff_users = [
        {
            "id": str(uuid.uuid4()),
            "phone": "+919876543211",
            "name": "Rajesh Singh",
            "role": "staff",
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "phone": "+919876543212",
            "name": "Priya Sharma",
            "role": "staff",
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "phone": "+919876543213",
            "name": "Amit Patel",
            "role": "staff",
            "is_active": True,
            "created_at": datetime.utcnow()
        }
    ]
    
    for staff in staff_users:
        await db.users.insert_one(staff)
        print(f"✅ Staff created: {staff['name']} - {staff['phone']}")
    
    # Create OTPs for all users (fixed OTP: 123456 for demo)
    all_users = [admin_user] + staff_users
    for user in all_users:
        otp_record = {
            "phone": user["phone"],
            "otp": "123456",
            "expires_at": datetime.utcnow() + timedelta(days=365),  # Long expiry for demo
            "created_at": datetime.utcnow()
        }
        await db.otps.insert_one(otp_record)
    print("✅ Demo OTPs created (OTP: 123456 for all)")
    
    # Create Sample Jobs
    jobs = [
        {
            "id": str(uuid.uuid4()),
            "customer_name": "Sharma Residency",
            "address": "123 MG Road, Bangalore, Karnataka",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "assigned_staff_ids": [staff_users[0]["id"]],
            "status": "pending",
            "notes": "Underground water tank cleaning required",
            "photos": {"before": [], "after": []},
            "timeline": {"created_at": datetime.utcnow()},
            "ai_verification": None,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "customer_name": "Green Valley Apartments",
            "address": "456 Park Street, Mumbai, Maharashtra",
            "latitude": 19.0760,
            "longitude": 72.8777,
            "assigned_staff_ids": [staff_users[0]["id"], staff_users[1]["id"]],
            "status": "in_progress",
            "notes": "Both overhead and underground tanks need cleaning",
            "photos": {"before": [], "after": []},
            "timeline": {
                "created_at": datetime.utcnow() - timedelta(days=1),
                "start_time": datetime.utcnow() - timedelta(hours=2)
            },
            "ai_verification": None,
            "created_at": datetime.utcnow() - timedelta(days=1)
        },
        {
            "id": str(uuid.uuid4()),
            "customer_name": "Tech Park Complex",
            "address": "789 IT Park, Hyderabad, Telangana",
            "latitude": 17.3850,
            "longitude": 78.4867,
            "assigned_staff_ids": [staff_users[1]["id"]],
            "status": "completed",
            "notes": "Commercial building - 5 overhead tanks",
            "photos": {"before": [], "after": []},
            "timeline": {
                "created_at": datetime.utcnow() - timedelta(days=3),
                "start_time": datetime.utcnow() - timedelta(days=3),
                "end_time": datetime.utcnow() - timedelta(days=2)
            },
            "ai_verification": {
                "analyzed_at": datetime.utcnow().isoformat(),
                "ai_analysis": "Quality Score: 95/100. Work completed to high standards.",
                "model": "gpt-4o-mini"
            },
            "created_at": datetime.utcnow() - timedelta(days=3)
        },
        {
            "id": str(uuid.uuid4()),
            "customer_name": "Sunrise Villa",
            "address": "321 Beach Road, Chennai, Tamil Nadu",
            "latitude": 13.0827,
            "longitude": 80.2707,
            "assigned_staff_ids": [staff_users[2]["id"]],
            "status": "pending",
            "notes": "Residential villa - overhead tank",
            "photos": {"before": [], "after": []},
            "timeline": {"created_at": datetime.utcnow()},
            "ai_verification": None,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "customer_name": "Metro Mall",
            "address": "555 Commercial Street, Delhi",
            "latitude": 28.7041,
            "longitude": 77.1025,
            "assigned_staff_ids": [staff_users[2]["id"]],
            "status": "in_progress",
            "notes": "Large commercial facility - multiple tanks",
            "photos": {"before": [], "after": []},
            "timeline": {
                "created_at": datetime.utcnow(),
                "start_time": datetime.utcnow() - timedelta(hours=1)
            },
            "ai_verification": None,
            "created_at": datetime.utcnow()
        }
    ]
    
    for job in jobs:
        await db.jobs.insert_one(job)
        print(f"✅ Job created: {job['customer_name']} - Status: {job['status']}")
    
    # Add some location tracking data for in-progress jobs
    in_progress_jobs = [j for j in jobs if j["status"] == "in_progress"]
    for job in in_progress_jobs:
        for i in range(5):
            location = {
                "id": str(uuid.uuid4()),
                "job_id": job["id"],
                "latitude": job["latitude"] + (i * 0.001),
                "longitude": job["longitude"] + (i * 0.001),
                "accuracy": 10.0,
                "timestamp": datetime.utcnow() - timedelta(minutes=30-i*5)
            }
            await db.locations.insert_one(location)
    print("✅ Sample location tracking data added")
    
    print("\n" + "="*70)
    print("🎉 DEMO DATA SEEDING COMPLETE!")
    print("="*70)
    print("\n📱 TEST CREDENTIALS:")
    print("-" * 70)
    print("\n👨‍💼 ADMIN LOGIN:")
    print(f"   Phone: +919876543210")
    print(f"   OTP: 123456")
    print(f"   Name: Admin Kumar")
    print("\n👷 STAFF LOGINS:")
    print(f"   1. Phone: +919876543211 | OTP: 123456 | Name: Rajesh Singh")
    print(f"   2. Phone: +919876543212 | OTP: 123456 | Name: Priya Sharma")
    print(f"   3. Phone: +919876543213 | OTP: 123456 | Name: Amit Patel")
    print("\n📊 DEMO DATA SUMMARY:")
    print(f"   ✅ Users: 1 Admin + 3 Staff")
    print(f"   ✅ Jobs: 5 (2 Pending, 2 In Progress, 1 Completed)")
    print(f"   ✅ Location Tracking: Sample data for in-progress jobs")
    print("="*70)
    print("\n🚀 Ready for testing! Use the app now.\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_demo_data())
