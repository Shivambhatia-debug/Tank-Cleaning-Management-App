# Tank Cleaning Management & Live Tracking App

## 🚀 Production-Ready Mobile Application

A comprehensive role-based mobile application built with **React Native (Expo)** for managing tank cleaning operations with real-time GPS tracking, photo verification, and AI-powered quality assessment.

---

## 📱 Features

### 👤 Authentication
- **Phone OTP Login** - Secure authentication using phone numbers
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
  - Job notes
- **Live Tracking** - Real-time staff location on Google Maps
- **Job Monitoring** - Track job status and timeline
- **Photo Verification** - View before/after photos
- **AI Analysis** - Automated quality assessment of completed work

### 👷 Staff Features
- **Job List** - View all assigned jobs
- **Job Details** - See customer info and location
- **Start Job** - Begin work and start location tracking
- **GPS Navigation** - Navigate to job location
- **Photo Upload** - Capture before and after photos
- **Mark Complete** - Finish job with notes
- **Real-time Location** - Automatic GPS tracking during active jobs

### 🤖 AI Integration
- **Photo Analysis** - Verify cleaning quality using GPT-4o-mini
- **Fraud Detection** - Detect suspicious or reused photos
- **Quality Scoring** - Rate staff performance automatically
- **Work Verification** - Ensure job completion standards

---

## 🛠️ Tech Stack

### Frontend
- **React Native** (Expo 54)
- **Expo Router** - File-based navigation
- **TypeScript** - Type-safe development
- **React Native Maps** - Map integration
- **Expo Location** - GPS tracking
- **Expo Camera** - Photo capture
- **Socket.IO Client** - Real-time updates
- **Axios** - API communication
- **Zustand** - State management
- **AsyncStorage** - Local data persistence

### Backend
- **FastAPI** - High-performance Python API
- **MongoDB** - NoSQL database
- **Motor** - Async MongoDB driver
- **WebSockets** - Real-time communication
- **OpenAI API** - AI-powered analysis
- **Pydantic** - Data validation

---

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB
- Expo CLI
- iOS Simulator or Android Emulator (or Expo Go app)

### Backend Setup

```bash
cd backend
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your MongoDB URL and API keys

# Start backend server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend Setup

```bash
cd frontend
yarn install

# Start Expo development server
yarn start

# Or run on specific platform
yarn ios      # iOS simulator
yarn android  # Android emulator
yarn web      # Web browser
```

---

## 🔐 Environment Variables

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=tank_cleaning
EMERGENT_LLM_KEY=your_emergent_key
```

### Frontend (.env)
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
5. Restrict the key to your app's bundle IDs:
   - iOS: `com.tankcleaning.app`
   - Android: `com.tankcleaning.app`
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
│   ├── (staff)/             # Staff screens (Stack Navigation)
│   │   └── jobs.tsx
│   ├── _layout.tsx
│   └── index.tsx
├── contexts/
│   └── AuthContext.tsx      # Auth state management
├── utils/
│   └── api.ts               # API client
└── app.json                 # Expo configuration
```

---

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/request-otp` - Generate OTP for phone
- `POST /api/auth/verify-otp` - Verify OTP and login

### User Management
- `GET /api/users` - List all users
- `GET /api/users/{id}` - Get specific user
- `POST /api/users/create-staff` - Create staff member
- `PUT /api/users/{id}` - Update user

### Job Management
- `POST /api/jobs` - Create new job
- `GET /api/jobs` - List jobs (with filters)
- `GET /api/jobs/{id}` - Get job details
- `PUT /api/jobs/{id}` - Update job status

### Location Tracking
- `POST /api/location/update` - Update staff location
- `GET /api/location/{job_id}` - Get location history
- `GET /api/location/latest/{job_id}` - Get latest location

### Photos
- `POST /api/photos/upload` - Upload before/after photos

### AI Verification
- `POST /api/ai/verify-photos/{job_id}` - Analyze photos with AI

### Statistics
- `GET /api/stats/dashboard` - Dashboard stats

### WebSocket
- `WS /ws/{user_id}` - Real-time updates

---

## 🎯 Usage Flow

### Admin Flow
1. Login with phone number and OTP
2. View dashboard with statistics
3. Create staff accounts
4. Create tank cleaning jobs
5. Assign jobs to staff members
6. Monitor live location on map
7. View job progress and photos
8. Get AI verification reports

### Staff Flow
1. Login with phone number and OTP
2. View assigned jobs
3. Start a job
4. Navigate to location (GPS tracking starts)
5. Take before photos
6. Complete cleaning work
7. Take after photos
8. Mark job as complete
9. AI analyzes work automatically

---

## 🔒 Permissions Required

### iOS
- Camera - "Take photos of tank before and after cleaning"
- Photos - "Select photos from your library"
- Location (When In Use) - "Track location during active jobs"
- Location (Always) - "Track location in background"

### Android
- ACCESS_FINE_LOCATION
- ACCESS_COARSE_LOCATION
- ACCESS_BACKGROUND_LOCATION
- CAMERA
- READ_EXTERNAL_STORAGE
- WRITE_EXTERNAL_STORAGE

---

## 🧪 Testing

### Backend Testing
```bash
# Test API endpoints
curl -X POST http://localhost:8001/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890"}'
```

### Frontend Testing
1. Install Expo Go app on your phone
2. Scan QR code from terminal
3. Test on actual device for full features

---

## 📸 Screenshots

*(Add screenshots here after deployment)*

---

## 🚀 Deployment

### Backend Deployment
- Deploy to AWS EC2, Digital Ocean, or Heroku
- Ensure MongoDB is accessible
- Configure environment variables
- Use production WSGI server (Gunicorn)

### Mobile App Deployment

#### iOS (App Store)
```bash
eas build --platform ios
eas submit --platform ios
```

#### Android (Play Store)
```bash
eas build --platform android
eas submit --platform android
```

---

## 🐛 Known Issues

1. **Web Platform**: Maps and camera features not fully supported on web
2. **Background Location**: Requires careful battery optimization
3. **iOS Background**: Requires specific permissions and careful testing

---

## 🔮 Future Enhancements

- [ ] Push notifications for job assignments
- [ ] Chat between admin and staff
- [ ] Route optimization for multiple jobs
- [ ] Detailed analytics and reporting
- [ ] Invoice generation
- [ ] Customer feedback system
- [ ] Multi-language support
- [ ] Dark mode support
- [ ] Offline mode with sync
- [ ] Video recording capability

---

## 📄 License

MIT License - feel free to use for commercial purposes

---

## 👨‍💻 Development

### First Time Setup
1. Clone the repository
2. Install dependencies (backend & frontend)
3. Configure environment variables
4. Start MongoDB
5. Start backend server
6. Start Expo development server
7. Open on device/simulator

### Default Admin Account
The first user to register becomes the admin automatically.

---

## 🆘 Support

For issues or questions:
1. Check the documentation above
2. Review API endpoint documentation
3. Check console logs for errors
4. Verify environment variables are set correctly

---

## 🎉 Credits

Built with ❤️ using modern mobile development best practices.

**Tech Stack:**
- React Native & Expo
- FastAPI & MongoDB
- OpenAI GPT-4o-mini
- Google Maps API
- Socket.IO for real-time features
