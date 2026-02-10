require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const Job = require('./models/Job');
const Location = require('./models/Location');
const Lead = require('./models/Lead');

const app = express();
// On Vercel (serverless) we don't create HTTP server or Socket.io - they cause crash
let server, io;
if (!process.env.VERCEL) {
    server = http.createServer(app);
    io = socketIo(server, {
        cors: { origin: "*", methods: ["GET", "POST"] }
    });
}

const fs = require('fs');
const path = require('path');
const multer = require('multer');

app.use(cors());
app.use(express.json());

// Uploads Config (Vercel: /tmp only; local: uploads/)
const uploadDir = process.env.VERCEL ? '/tmp' : 'uploads';
if (!process.env.VERCEL && !fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Database Connection (skip on Vercel if MONGO_URI missing to avoid crash)
// Longer timeouts for serverless cold start (Vercel → Atlas can be slow)
const mongooseOptions = {
    bufferTimeoutMS: 30000,
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 20000
};
if (process.env.MONGO_URI) {
    mongoose.connect(process.env.MONGO_URI, mongooseOptions)
        .then(() => {
            console.log('✅ MongoDB connected');
            seedAdmin();
        })
        .catch(err => console.error('❌ MongoDB connection error:', err));
} else if (!process.env.VERCEL) {
    console.warn('⚠️ MONGO_URI not set');
}

// Admin Seeder
function seedAdmin() {
    return (async () => {
        try {
            const adminExists = await User.findOne({ role: 'admin' });
            if (!adminExists) {
                const admin = new User({
                    phone: '9319329339',
                    password: 'admin123',
                    name: 'Super Admin',
                    role: 'admin'
                });
                await admin.save();
                console.log('✅ Admin user created: 9319329339 / admin123');
            }
        } catch (error) {
            console.error('Seeder error:', error);
        }
    })();
}

// Middleware
const auth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Access denied' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ message: 'Invalid token' });
    }
};

// --- AUTH ROUTES ---

app.post('/api/auth/login', async (req, res) => {
    try {
        if (!process.env.JWT_SECRET) {
            return res.status(503).json({ message: 'Server misconfigured (JWT_SECRET missing). Check Vercel env vars.' });
        }
        // Wait for MongoDB on cold start (Vercel serverless – connection can take 15–20s)
        const maxWaitMs = 22000;
        const stepMs = 500;
        let waited = 0;
        while (mongoose.connection.readyState !== 1 && waited < maxWaitMs) {
            await new Promise(r => setTimeout(r, stepMs));
            waited += stepMs;
        }
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: 'Database connecting. Please try again in 10–15 seconds.' });
        }
        const phoneStr = String(req.body.phone || '').replace(/\D/g, '').slice(0, 10);
        const password = req.body.password;
        if (!phoneStr || phoneStr.length !== 10) {
            return res.status(400).json({ message: 'Enter valid 10 digit phone number' });
        }
        if (!password) {
            return res.status(400).json({ message: 'Password required' });
        }
        const user = await User.findOne({ phone: phoneStr });
        if (!user) return res.status(400).json({ message: 'User not found' });

        const validPass = await user.comparePassword(password);
        if (!validPass) return res.status(400).json({ message: 'Invalid password' });

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
        res.json({
            token,
            user: { id: user._id, name: user.name, phone: user.phone, role: user.role }
        });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Login failed' });
    }
});

app.post('/api/users/staff', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    try {
        const { phone, password, name, businessName, location } = req.body;
        const existing = await User.findOne({ phone: String(phone).replace(/\D/g, '').slice(0, 10) });
        if (existing) return res.status(400).json({ message: 'Phone already exists' });

        const staff = new User({
            phone: String(phone).replace(/\D/g, '').slice(0, 10),
            password,
            name,
            role: 'staff',
            businessName: businessName || '',
            location: location || '',
            plainPasswordForAdmin: password || ''
        });
        await staff.save();
        res.status(201).json({ message: 'Staff created successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- LEADS (basic CRM) ---

// Create new lead
app.post('/api/leads', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    try {
        const {
            customerName,
            mobileNumber,
            address,
            latitude,
            longitude,
            source,
            status,
            tags,
        } = req.body;

        if (!customerName || !mobileNumber) {
            return res.status(400).json({ message: 'Customer name and mobile are required' });
        }

        const mobileDigits = String(mobileNumber).replace(/\D/g, '').slice(0, 10);
        if (mobileDigits.length !== 10) {
            return res.status(400).json({ message: 'Enter valid 10 digit mobile number' });
        }

        const lead = new Lead({
            customerName: customerName.trim(),
            mobileNumber: mobileDigits,
            address: (address || '').trim(),
            latitude,
            longitude,
            source: source || 'Direct Call',
            status: status || 'New',
            tags: Array.isArray(tags) ? tags : [],
            createdBy: req.user.id,
        });

        await lead.save();
        res.status(201).json(lead);
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to create lead' });
    }
});

// List leads (optional status filter)
app.get('/api/leads', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    try {
        const { status } = req.query;
        const filter = {};
        if (status) filter.status = status;
        const leads = await Lead.find(filter).sort({ createdAt: -1 });
        res.json(leads);
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to load leads' });
    }
});

// Get single lead with logs
app.get('/api/leads/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: 'Lead not found' });
        res.json(lead);
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to load lead' });
    }
});

// Update lead basic fields / status
app.put('/api/leads/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    try {
        const updates = {};
        const allowedFields = [
            'customerName',
            'mobileNumber',
            'address',
            'latitude',
            'longitude',
            'source',
            'status',
            'nextFollowUpAt',
            'tags',
        ];

        for (const key of allowedFields) {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        }

        if (updates.mobileNumber) {
            const mobileDigits = String(updates.mobileNumber).replace(/\D/g, '').slice(0, 10);
            if (mobileDigits.length !== 10) {
                return res.status(400).json({ message: 'Enter valid 10 digit mobile number' });
            }
            updates.mobileNumber = mobileDigits;
        }

        const lead = await Lead.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!lead) return res.status(404).json({ message: 'Lead not found' });
        res.json(lead);
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to update lead' });
    }
});

// Add discussion log to a lead
app.post('/api/leads/:id/logs', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    try {
        const { notes, nextFollowUpAt } = req.body;
        if (!notes || !String(notes).trim()) {
            return res.status(400).json({ message: 'Notes are required' });
        }

        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: 'Lead not found' });

        const log = {
            notes: String(notes).trim(),
            by: 'Admin',
        };
        if (nextFollowUpAt) {
            log.nextFollowUpAt = new Date(nextFollowUpAt);
            lead.nextFollowUpAt = log.nextFollowUpAt;
        }

        lead.discussionLogs.push(log);
        await lead.save();

        res.status(201).json(lead);
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to add log' });
    }
});

app.get('/api/users', auth, async (req, res) => {
    try {
        const users = await User.find({ role: 'staff' }).select('-password');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.put('/api/users/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    try {
        const { isActive, name } = req.body;
        const updates = {};
        if (typeof isActive === 'boolean') updates.isActive = isActive;
        if (name) updates.name = name;
        const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.delete('/api/users/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.role === 'admin') return res.status(400).json({ message: 'Cannot delete admin' });
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Staff deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- JOB ROUTES ---

app.post('/api/jobs', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    try {
        const job = new Job(req.body);
        await job.save();
        // Ek staff ek hi job par: in staff ko doosri sab pending/in_progress jobs se hatao
        const staffIds = (job.assignedStaff || []).map(id => id.toString ? id.toString() : id);
        if (staffIds.length > 0) {
            await Job.updateMany(
                { _id: { $ne: job._id }, status: { $in: ['pending', 'in_progress'] } },
                { $pullAll: { assignedStaff: staffIds } }
            );
        }
        res.status(201).json({ success: true, jobId: job._id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/jobs', auth, async (req, res) => {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.staffId) filter.assignedStaff = req.query.staffId;

        // If staff, only show assigned jobs
        if (req.user.role === 'staff') {
            filter.assignedStaff = req.user.id;
        }

        const jobs = await Job.find(filter).populate('assignedStaff', 'name phone lastLatitude lastLongitude lastLocationTime').sort({ 'timeline.createdAt': -1 });
        // Ensure each job has string "id" for client (delete etc.)
        const list = jobs.map(j => {
            const o = j.toObject ? j.toObject() : j;
            o.id = (o._id && o._id.toString) ? o._id.toString() : String(o._id || o.id || '');
            return o;
        });
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/jobs/:id', auth, async (req, res) => {
    try {
        const job = await Job.findById(req.params.id).populate('assignedStaff', 'name phone lastLatitude lastLongitude lastLocationTime');
        if (!job) return res.status(404).json({ message: 'Job not found' });
        res.json(job);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.put('/api/jobs/:id', auth, async (req, res) => {
    try {
        const { status, notes } = req.body;
        const updates = {};
        if (status) updates.status = status;
        if (notes) updates.notes = notes;

        if (status === 'in_progress') updates['timeline.startedAt'] = new Date();
        if (status === 'completed') updates['timeline.completedAt'] = new Date();

        const job = await Job.findByIdAndUpdate(req.params.id, updates, { new: true });

        if (io) io.to(`job_${req.params.id}`).emit('job_updated', job);

        res.json({ success: true, message: 'Job updated' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- DELETE JOB (Admin only) ---
app.delete('/api/jobs/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const id = (req.params.id || '').trim();
    if (!id) return res.status(400).json({ message: 'Job id required' });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid job id' });
    try {
        const job = await Job.findByIdAndDelete(id);
        if (!job) return res.status(404).json({ message: 'Job not found. It may have been deleted already.' });
        res.json({ success: true, message: 'Job deleted' });
    } catch (err) {
        if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid job id' });
        res.status(500).json({ message: err.message || 'Failed to delete job' });
    }
});

// --- JOB PHOTO UPLOAD (Staff completion photo + time, date, location) ---
app.post('/api/jobs/:id/upload', auth, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        const timestamp = req.body.timestamp ? new Date(req.body.timestamp) : new Date();
        const lat = req.body.latitude != null ? parseFloat(req.body.latitude) : null;
        const lng = req.body.longitude != null ? parseFloat(req.body.longitude) : null;
        const updates = {
            completionPhoto: req.file.filename,
            completionPhotoAt: timestamp,
            completionLatitude: lat,
            completionLongitude: lng,
            $push: { 'photos.after': '/uploads/' + req.file.filename }
        };
        const job = await Job.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!job) return res.status(404).json({ message: 'Job not found' });
        res.json({
            success: true,
            message: 'Photo uploaded',
            completionPhoto: job.completionPhoto,
            completionPhotoAt: job.completionPhotoAt,
            completionLatitude: job.completionLatitude,
            completionLongitude: job.completionLongitude
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- REST LOCATION UPDATE (For Background Tasks) ---
app.post('/api/location/update', async (req, res) => {
    try {
        const { staffId, latitude, longitude, jobId } = req.body;

        // Save to DB
        const locationData = {
            staffId,
            latitude,
            longitude
        };
        if (jobId) locationData.jobId = jobId;
        await Location.create(locationData);

        // Update User's last location
        const updatedUser = await User.findByIdAndUpdate(staffId, {
            lastLatitude: latitude,
            lastLongitude: longitude,
            lastLocationTime: new Date()
        }, { new: true });
        console.log(`💾 Saved last location for staff ${staffId}: ${latitude}, ${longitude}`, updatedUser ? 'SUCCESS' : 'USER NOT FOUND');

        const ioData = { staffId, latitude, longitude, jobId };
        if (io) {
            if (jobId) io.to(`job_${jobId}`).emit('location_update', ioData);
            io.emit('staff_location_update', ioData);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('REST Location error:', err);
        res.status(500).json({ message: err.message });
    }
});

// --- SOCKET.IO TRACKING (skip on Vercel - no persistent connections) ---
if (io) io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join_job', (jobId) => {
        socket.join(`job_${jobId}`);
    });

    socket.on('update_location', async (data) => {
        // ... (Keep existing socket logic for backward compatibility or foreground)
        try {
            const locationData = {
                staffId: data.staffId,
                latitude: data.latitude,
                longitude: data.longitude
            };
            if (data.jobId) locationData.jobId = data.jobId;

            await Location.create(locationData);

            // Update User's last location
            await User.findByIdAndUpdate(data.staffId, {
                lastLatitude: data.latitude,
                lastLongitude: data.longitude,
                lastLocationTime: new Date()
            });

            if (data.jobId) {
                io.to(`job_${data.jobId}`).emit('location_update', data);
            }
            io.emit('staff_location_update', data);
        } catch (err) {
            console.error('Tracking error:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// --- HEALTH (no auth - for connectivity check) ---
// On Vercel cold start, wait for DB so we report true status (connection can take 15–20s)
app.get('/api/health', async (req, res) => {
    const maxWaitMs = 22000;
    const stepMs = 500;
    let waited = 0;
    while (mongoose.connection.readyState !== 1 && waited < maxWaitMs) {
        await new Promise(r => setTimeout(r, stepMs));
        waited += stepMs;
    }
    const dbReady = mongoose.connection.readyState === 1;
    res.json({
        ok: true,
        message: 'Backend is running',
        uploadRoute: 'POST /api/jobs/:id/upload',
        dbConnected: dbReady,
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasMongoUri: !!process.env.MONGO_URI
    });
});

// --- STATS ROUTES ---

app.get('/api/stats/dashboard', auth, async (req, res) => {
    try {
        const totalJobs = await Job.countDocuments();
        const pendingJobs = await Job.countDocuments({ status: 'pending' });
        const inProgressJobs = await Job.countDocuments({ status: 'in_progress' });
        const completedJobs = await Job.countDocuments({ status: 'completed' });
        const activeStaff = await User.countDocuments({ role: 'staff', isActive: true });

        res.json({
            totalJobs,
            pendingJobs,
            inProgressJobs,
            completedJobs,
            activeStaff
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

const PORT = process.env.PORT || 8002;
const HOST = '0.0.0.0'; // allow connections from emulator/device on same network

// On Vercel we export the app only; no listen (serverless)
if (!process.env.VERCEL) {
    server.listen(PORT, HOST, () => {
        console.log(`🚀 Node.js Server running on http://${HOST}:${PORT}`);
        console.log('   Upload route: POST /api/jobs/:id/upload');
    });
}

module.exports = app;
