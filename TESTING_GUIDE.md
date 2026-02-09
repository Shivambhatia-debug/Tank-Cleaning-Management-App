# 🧪 Tank Cleaning App - Testing Guide

## 📱 Demo Login Credentials

### 👨‍💼 ADMIN LOGIN
```
Phone: +919876543210
OTP: 123456
Name: Admin Kumar
```

**Admin can:**
- ✅ View dashboard with statistics
- ✅ See all jobs (5 jobs created)
- ✅ Manage staff members
- ✅ Create new jobs
- ✅ Track live location of staff
- ✅ View job photos and AI analysis

---

### 👷 STAFF LOGINS

#### Staff 1 - Rajesh Singh
```
Phone: +919876543211
OTP: 123456
```
**Assigned Jobs:**
- Sharma Residency (Pending)
- Green Valley Apartments (In Progress)

---

#### Staff 2 - Priya Sharma
```
Phone: +919876543212
OTP: 123456
```
**Assigned Jobs:**
- Green Valley Apartments (In Progress)
- Tech Park Complex (Completed)

---

#### Staff 3 - Amit Patel
```
Phone: +919876543213
OTP: 123456
```
**Assigned Jobs:**
- Sunrise Villa (Pending)
- Metro Mall (In Progress)

---

## 📊 Sample Data Available

### Jobs Created (5 Total)

1. **Sharma Residency** - Bangalore
   - Status: Pending
   - Assigned to: Rajesh Singh
   - Type: Underground tank

2. **Green Valley Apartments** - Mumbai
   - Status: In Progress
   - Assigned to: Rajesh Singh + Priya Sharma
   - Type: Multiple tanks

3. **Tech Park Complex** - Hyderabad
   - Status: Completed ✅
   - Assigned to: Priya Sharma
   - Has AI Verification

4. **Sunrise Villa** - Chennai
   - Status: Pending
   - Assigned to: Amit Patel
   - Type: Overhead tank

5. **Metro Mall** - Delhi
   - Status: In Progress
   - Assigned to: Amit Patel
   - Type: Commercial facility

---

## 🧪 Testing Scenarios

### ✅ Admin Testing

1. **Login as Admin**
   - Use: +919876543210 / OTP: 123456
   - Verify: Lands on Dashboard screen

2. **Dashboard View**
   - Check stats cards:
     * Total Jobs: 5
     * Pending: 2
     * In Progress: 2
     * Completed: 1
     * Active Staff: 3

3. **Staff Management Tab**
   - View 3 staff members
   - Add new staff
   - Edit staff details
   - Disable/enable staff

4. **Jobs Tab**
   - View all 5 jobs
   - Filter by status
   - Create new job
   - Assign staff to jobs
   - View job details

5. **Live Map Tab**
   - See staff locations in real-time
   - Track in-progress jobs
   - View location history

---

### ✅ Staff Testing

1. **Login as Staff (any of the 3)**
   - Use credentials above
   - Verify: Lands on Jobs List screen

2. **View Assigned Jobs**
   - See only your assigned jobs
   - Check job status badges
   - View customer details

3. **Start a Job**
   - Open pending job
   - Click "Start Job"
   - Location tracking begins

4. **Upload Photos**
   - Take "Before" photos
   - Complete work
   - Take "After" photos

5. **Complete Job**
   - Mark job as complete
   - Add notes
   - View AI analysis

---

## 🔧 API Testing

### Quick API Tests

```bash
# 1. Request OTP
curl -X POST http://localhost:8001/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'

# 2. Verify OTP (Admin)
curl -X POST http://localhost:8001/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "otp": "123456"}'

# 3. Get Dashboard Stats
curl http://localhost:8001/api/stats/dashboard

# 4. List All Jobs
curl http://localhost:8001/api/jobs

# 5. Get Pending Jobs
curl "http://localhost:8001/api/jobs?status=pending"

# 6. List All Users
curl http://localhost:8001/api/users

# 7. List Staff Only
curl "http://localhost:8001/api/users?role=staff"
```

---

## 📱 Mobile App Testing

### iOS/Android (via Expo Go)

1. **Install Expo Go**
   - iOS: App Store
   - Android: Play Store

2. **Scan QR Code**
   - Visible on screen preview
   - Or use Expo Go camera

3. **Test Login Flow**
   - Enter phone number
   - Enter OTP: 123456
   - Verify role-based routing

---

### Web Testing

1. **Open Browser Preview**
   - Available in Expo dashboard
   - Or navigate to localhost:3000

2. **Test Responsive Design**
   - Desktop view
   - Mobile view (Chrome DevTools)
   - Tablet view

---

## 🐛 Common Issues

### Issue: Login not working
**Solution:** Use Node backend. Admin seed: phone `9319329339`, password `admin123` (see backend_node server.js seed).

### Issue: No jobs showing
**Solution:** Ensure backend_node is running and MongoDB is connected. Create jobs from Admin → Jobs tab. Optional: run `node manual_seed.js` from backend_node if you have a seed script.

### Issue: Location not tracking
**Solution:** Grant location permissions when prompted

### Issue: Camera not working
**Solution:** Grant camera permissions when prompted

---

## 📸 Features to Test

### Must Test ✅
- [x] Phone + Password Login (Node backend)
- [x] Role-based routing (Admin vs Staff)
- [x] Dashboard statistics
- [x] Job list display
- [x] Job status badges
- [x] Pull-to-refresh
- [x] Logout functionality

### In Progress 🚧
- [ ] Staff CRUD operations
- [ ] Job creation form
- [ ] Live map with markers
- [ ] Camera integration
- [ ] Location tracking
- [ ] Photo upload
- [ ] AI verification

---

## 🎯 Test Coverage

| Feature | Admin | Staff | Status |
|---------|-------|-------|--------|
| Login | ✅ | ✅ | Working |
| Dashboard | ✅ | ❌ | Working |
| Job List | ✅ | ✅ | Working |
| Create Job | ✅ | ❌ | TODO |
| Start Job | ❌ | ✅ | TODO |
| Location Track | ✅ | ✅ | TODO |
| Photo Upload | ❌ | ✅ | TODO |
| AI Analysis | ✅ | ❌ | API Ready |

---

## 💡 Quick Tips

1. **Multiple Device Testing**: Login with different roles on different devices
2. **Network Testing**: Test with poor connectivity
3. **Permission Testing**: Deny and re-grant permissions
4. **Logout Testing**: Test session persistence
5. **Data Refresh**: Use pull-to-refresh frequently

---

## 🆘 Need Help?

- Check console logs for errors
- Verify backend is running on port 8001
- Ensure MongoDB is connected
- Check API responses in Network tab

---

**Happy Testing! 🎉**
