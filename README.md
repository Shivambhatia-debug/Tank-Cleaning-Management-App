# Tank Cleaning Management & Live Tracking App

## 🚀 Production-Ready Mobile Application

A comprehensive role-based mobile application built with **React Native (Expo)** for managing tank cleaning operations with real-time GPS tracking, photo verification, and live tracking.

---

## 📱 Features

### 👤 Authentication
- **Phone + Password Login** - Secure authentication (Admin: phone + password; Staff: as created by admin)
- **Role-Based Access** - Admin and Staff roles with different permissions
- **Persistent Sessions** - Stay logged in across app restarts

### 🔐 Admin Features
- **Dashboard** - Real-time statistics and overview
  - Total jobs count
  - Pending, in-progress, and completed jobs
  - Active staff count
- **Staff Management** - Add, edit, and manage staff members
- **Job Creation** - Create tank cleaning jobs with:
  - Customer information
  - Address and GPS coordinates
  - Assignment to multiple staff
  - Job notes and CRM fields
- **Live Tracking** - Real-time staff location on map
- **Job Monitoring** - Track job status and timeline

### 👷 Staff Features
- **Job List** - View all assigned jobs
- **Job Details** - See customer info and location
- **Start Job** - Begin work
- **Photo Upload** - Upload completion photos
- **Mark Complete** - Finish job

---

## 🛠️ Tech Stack

### Frontend
- **React Native** (Expo 54)
- **Expo Router** - File-based navigation
- **TypeScript** - Type-safe development
- **React Native Maps** - Map integration (native)
- **Expo Location** - GPS tracking
- **Expo Camera / Image Picker** - Photo capture
- **Socket.IO Client** - Real-time updates
- **Axios** - API communication
- **AsyncStorage** - Local data persistence

### Backend
- **Node.js** (Express)
- **MongoDB** - NoSQL database
- **Mongoose** - ODM
- **Socket.IO** - Real-time communication
- **JWT** - Authentication
- **Multer** - File uploads

---

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+
- MongoDB
- Expo CLI
- iOS Simulator or Android Emulator (or Expo Go app)

### Backend Setup

```bash
cd backend_node
npm install

# Configure environment variables
# Create .env with:
# MONGO_URI=mongodb://localhost:27017/tank_cleaning
# JWT_SECRET=your_secret_key
# PORT=8001

# Start backend server
node server.js

# Or with auto-reload
npx nodemon server.js
```

### Frontend Setup

```bash
cd frontend
npm install

# Start Expo development server
npx expo start

# Or run on specific platform
npx expo start --ios
npx expo start --android
npx expo start --web
```

---

## 🔐 Environment Variables

### Backend (backend_node/.env)
```
MONGO_URI=mongodb://localhost:27017/tank_cleaning
JWT_SECRET=your_jwt_secret
PORT=8001
```

### Frontend (frontend/.env)
```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

---

## 🗺️ Google Maps Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable these APIs:
   - Maps SDK for Android
   - Maps SDK for iOS
4. Generate API key
5. Restrict the key to your app's bundle IDs
6. Add the key to `app.json` and `.env`

---

## 📱 App Structure

```
frontend/
├── app/
│   ├── (auth)/              # Authentication screens
│   │   ├── login.tsx
│   │   └── verify-otp.tsx
│   ├── (admin)/             # Admin dashboard (Tab Navigation)
│   │   ├── dashboard.tsx
│   │   ├── staff.tsx
│   │   ├── jobs.tsx
│   │   └── map.tsx
│   ├── (staff)/             # Staff screens
│   │   ├── jobs.tsx
│   │   └── job-detail.tsx
│   ├── _layout.tsx
│   └── index.tsx
├── contexts/
│   └── AuthContext.tsx
├── utils/
│   └── api.ts
└── app.json

backend_node/
├── server.js
├── manual_seed.js
└── models/
    ├── User.js
    ├── Job.js
    └── Location.js
```

---

## 🔌 API Endpoints (Node)

### Authentication
- `POST /api/auth/login` - Login with phone + password

### User Management
- `GET /api/users` - List staff (auth required)
- `POST /api/users/staff` - Create staff (admin only)

### Job Management
- `POST /api/jobs` - Create new job (admin)
- `GET /api/jobs` - List jobs (with filters)
- `GET /api/jobs/:id` - Get job details
- `PUT /api/jobs/:id` - Update job status

### Location
- `POST /api/location/update` - Update staff location

### Statistics
- `GET /api/stats/dashboard` - Dashboard stats (auth)

---

## 🎯 Usage Flow

### Admin
1. Login with phone and password (see DEMO_CREDENTIALS_HINDI.md for seed admin)
2. View dashboard, manage staff, create jobs, view live map

### Staff
1. Login with credentials provided by admin
2. View assigned jobs, open job detail, start job, upload photo, mark complete

---

## 🔒 Permissions Required

### iOS
- Camera, Photos, Location (When In Use / Always)

### Android
- ACCESS_FINE_LOCATION, CAMERA, READ/WRITE_EXTERNAL_STORAGE

---

## 🧪 Testing

### Backend
```bash
# Login
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"9319329339","password":"admin123"}'
```

### Frontend
1. Install Expo Go on device
2. Scan QR from `npx expo start`
3. Set EXPO_PUBLIC_BACKEND_URL to your machine IP when testing on device

---

## 🚀 Deployment

### Backend
- Deploy Node app to AWS, DigitalOcean, Heroku, etc.
- Set MONGO_URI, JWT_SECRET, PORT in environment

### Mobile
- EAS Build: `eas build --platform ios` / `eas build --platform android`

---

## 📄 License

MIT License - feel free to use for commercial purposes.

---

**Tech Stack:** React Native & Expo, Node.js & Express, MongoDB, Socket.IO, Google Maps API.
