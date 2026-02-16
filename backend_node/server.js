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
const Expense = require('./models/Expense');
const Service = require('./models/Service');

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

// --- Vercel Blob for persistent image storage (serverless) ---
let blobPut = null;
if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
        const blob = require('@vercel/blob');
        blobPut = blob.put;
        console.log('✅ Vercel Blob configured for image uploads');
    } catch (e) {
        console.warn('⚠️ @vercel/blob not available, falling back to disk storage');
    }
}

async function uploadToStorage(fileBuffer, filename, contentType) {
    if (blobPut && process.env.BLOB_READ_WRITE_TOKEN) {
        const { url } = await blobPut(filename, fileBuffer, {
            access: 'public',
            token: process.env.BLOB_READ_WRITE_TOKEN,
            contentType: contentType || 'image/jpeg',
        });
        return url; // full https URL
    }
    // Local fallback: write to disk
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, fileBuffer);
    return filename; // just filename, frontend prepends base URL
}

// Uploads Config (local dev: uploads/)
const uploadDir = process.env.VERCEL ? '/tmp' : 'uploads';
if (!process.env.VERCEL && !fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// Multer stores to memory buffer so we can send to Blob or disk
const storage = process.env.BLOB_READ_WRITE_TOKEN
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
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
            seedServices();
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

const DEFAULT_SERVICES = [
    { name: 'Water Tank', startingPrice: 299, order: 1 },
    { name: 'Kitchen Cleaning', startingPrice: 849, order: 2 },
    { name: 'Sofa Cleaning', startingPrice: 499, order: 3 },
    { name: 'Pest Control', startingPrice: 999, order: 4 },
    { name: 'House Cleaning', startingPrice: 2499, order: 5 },
    { name: 'Bathroom Cleaning', startingPrice: 499, order: 6 },
    { name: 'Aquarium Tank', startingPrice: null, order: 7 },
    { name: 'Septic Tank', startingPrice: null, order: 8 },
    { name: 'Sewage Tank', startingPrice: null, order: 9 },
    { name: 'Sump Cleaning', startingPrice: null, order: 10 },
    { name: 'Overhead Tank', startingPrice: null, order: 11 },
    { name: 'Swimming Pool', startingPrice: null, order: 12 },
    { name: 'Housekeeping', startingPrice: null, order: 13 },
    { name: 'Move In / Move Out', startingPrice: null, order: 14 },
    { name: 'Office Cleaning', startingPrice: null, order: 15 },
    { name: 'Car Wash', startingPrice: null, order: 16 },
    { name: 'Carpet Cleaning', startingPrice: null, order: 17 },
    { name: 'Floor Cleaning', startingPrice: null, order: 18 },
    { name: 'Other', startingPrice: null, order: 99 },
];

function seedServices() {
    return (async () => {
        try {
            const count = await Service.countDocuments();
            if (count === 0) {
                await Service.insertMany(DEFAULT_SERVICES);
                console.log('✅ Default services with prices seeded');
            }
        } catch (error) {
            console.error('Seed services error:', error);
        }
    })();
}

// Wait for DB (serverless cold start); if still not connected, return 503
const requireDb = (req, res, next) => {
    const maxWaitMs = 22000;
    const stepMs = 500;
    let waited = 0;
    const check = () => {
        if (mongoose.connection.readyState === 1) return next();
        if (waited >= maxWaitMs) {
            return res.status(503).json({
                message: 'Database not connected. Check MongoDB Atlas: Network Access allow 0.0.0.0/0 and correct MONGO_URI on Vercel.',
                code: 'DB_DISCONNECTED'
            });
        }
        waited += stepMs;
        setTimeout(check, stepMs);
    };
    check();
};

// Middleware
const auth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Access denied' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Invalid or expired token' });
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
        const {
            phone,
            password,
            name,
            businessName,
            location,
            staffCode,
            staffType,
            fixedSalary,
            perTankIncentive,
            defaultPerJobIncentive,
            defaultFuelExpense,
            defaultChemicalExpense,
            hasBike,
            fuelAllowance,
            joiningDate,
            employmentStatus,
            remarks,
        } = req.body;
        const existing = await User.findOne({ phone: String(phone).replace(/\D/g, '').slice(0, 10) });
        if (existing) return res.status(400).json({ message: 'Phone already exists' });

        const staffData = {
            phone: String(phone).replace(/\D/g, '').slice(0, 10),
            password,
            name,
            role: 'staff',
            businessName: businessName || '',
            location: location || '',
            plainPasswordForAdmin: password || ''
        };

        if (staffCode) staffData.staffCode = String(staffCode).trim();
        if (staffType && ['Full Time', 'Part Time'].includes(staffType)) {
            staffData.staffType = staffType;
        }
        if (fixedSalary != null) staffData.fixedSalary = Number(fixedSalary) || 0;
        if (perTankIncentive != null) staffData.perTankIncentive = Number(perTankIncentive) || 0;
        if (defaultPerJobIncentive != null) staffData.defaultPerJobIncentive = Number(defaultPerJobIncentive) || 0;
        if (defaultFuelExpense != null) staffData.defaultFuelExpense = Number(defaultFuelExpense) || 0;
        if (defaultChemicalExpense != null) staffData.defaultChemicalExpense = Number(defaultChemicalExpense) || 0;
        if (typeof hasBike === 'boolean') staffData.hasBike = hasBike;
        if (fuelAllowance != null) staffData.fuelAllowance = Number(fuelAllowance) || 0;
        if (employmentStatus && ['Active', 'Inactive', 'Terminated'].includes(employmentStatus)) {
            staffData.employmentStatus = employmentStatus;
            staffData.isActive = employmentStatus === 'Active';
        }
        if (remarks) staffData.remarks = String(remarks).trim();
        if (joiningDate) {
            const d = new Date(joiningDate);
            if (!isNaN(d.getTime())) staffData.joiningDate = d;
        }

        const staff = new User(staffData);
        await staff.save();
        res.status(201).json({ message: 'Staff created successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to create staff' });
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
            area,
            whatsappNumber,
            plusCode,
            mapLink,
            serviceType,
            tankSizeLtr,
            numberOfTanks,
            quotedPrice,
            finalPrice,
            bookingDate,
            timeSlot,
            assignedStaff,
            jobStatus,
            paymentStatus,
            paymentMode,
            notes,
        } = req.body;

        if (!customerName || !mobileNumber) {
            return res.status(400).json({ message: 'Customer name and mobile are required' });
        }

        const mobileDigits = String(mobileNumber).replace(/\D/g, '').slice(0, 10);
        if (mobileDigits.length !== 10) {
            return res.status(400).json({ message: 'Enter valid 10 digit mobile number' });
        }

        const leadData = {
            customerName: customerName.trim(),
            mobileNumber: mobileDigits,
            address: (address || '').trim(),
            latitude,
            longitude,
            source: source || 'Direct Call',
            status: status || 'New',
            tags: Array.isArray(tags) ? tags : [],
            createdBy: req.user.id,
        };

        if (area) leadData.area = String(area).trim();
        if (whatsappNumber) {
            const wa = String(whatsappNumber).replace(/\D/g, '').slice(0, 10);
            if (wa.length === 10) leadData.whatsappNumber = wa;
        }
        if (plusCode) leadData.plusCode = String(plusCode).trim();
        if (mapLink) leadData.mapLink = String(mapLink).trim();
        if (serviceType) leadData.serviceType = String(serviceType).trim();
        if (tankSizeLtr != null) leadData.tankSizeLtr = Number(tankSizeLtr) || 0;
        if (numberOfTanks != null) leadData.numberOfTanks = Number(numberOfTanks) || 0;
        if (quotedPrice != null) leadData.quotedPrice = Number(quotedPrice) || 0;
        if (finalPrice != null) leadData.finalPrice = Number(finalPrice) || 0;
        if (bookingDate) leadData.bookingDate = new Date(bookingDate);
        if (timeSlot) leadData.timeSlot = String(timeSlot).trim();
        if (Array.isArray(assignedStaff)) leadData.assignedStaff = assignedStaff;
        if (jobStatus) leadData.jobStatus = String(jobStatus).trim();
        if (paymentStatus) leadData.paymentStatus = String(paymentStatus).trim();
        if (paymentMode) leadData.paymentMode = String(paymentMode).trim();
        if (notes) leadData.notes = String(notes).trim();

        const lead = new Lead(leadData);

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
            'area',
            'whatsappNumber',
            'plusCode',
            'mapLink',
            'serviceType',
            'tankSizeLtr',
            'numberOfTanks',
            'quotedPrice',
            'finalPrice',
            'bookingDate',
            'timeSlot',
            'assignedStaff',
            'jobStatus',
            'paymentStatus',
            'paymentMode',
            'notes',
            'firstJobId',
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

        if (updates.whatsappNumber) {
            const wa = String(updates.whatsappNumber).replace(/\D/g, '').slice(0, 10);
            updates.whatsappNumber = wa;
        }

        if (updates.bookingDate) {
            updates.bookingDate = new Date(updates.bookingDate);
        }

        if (updates.tankSizeLtr != null) {
            updates.tankSizeLtr = Number(updates.tankSizeLtr) || 0;
        }
        if (updates.numberOfTanks != null) {
            updates.numberOfTanks = Number(updates.numberOfTanks) || 0;
        }
        if (updates.quotedPrice != null) {
            updates.quotedPrice = Number(updates.quotedPrice) || 0;
        }
        if (updates.finalPrice != null) {
            updates.finalPrice = Number(updates.finalPrice) || 0;
        }

        const lead = await Lead.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!lead) return res.status(404).json({ message: 'Lead not found' });
        res.json(lead);
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to update lead' });
    }
});

// Delete lead (admin only)
app.delete('/api/leads/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    try {
        const lead = await Lead.findByIdAndDelete(req.params.id);
        if (!lead) return res.status(404).json({ message: 'Lead not found or already deleted' });
        res.json({ success: true, message: 'Lead deleted' });
    } catch (err) {
        if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid lead id' });
        res.status(500).json({ message: err.message || 'Failed to delete lead' });
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

// --- GET current user profile (for staff profile screen) ---
app.get('/api/users/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
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
        const {
            isActive,
            name,
            businessName,
            location,
            staffCode,
            staffType,
            fixedSalary,
            perTankIncentive,
            defaultPerJobIncentive,
            defaultFuelExpense,
            defaultChemicalExpense,
            hasBike,
            fuelAllowance,
            joiningDate,
            employmentStatus,
            remarks,
        } = req.body;
        const updates = {};
        if (typeof isActive === 'boolean') updates.isActive = isActive;
        if (name) updates.name = name;
        if (businessName !== undefined) updates.businessName = businessName || '';
        if (location !== undefined) updates.location = location || '';
        if (staffCode !== undefined) updates.staffCode = staffCode || '';
        if (staffType && ['Full Time', 'Part Time'].includes(staffType)) updates.staffType = staffType;
        if (fixedSalary != null) updates.fixedSalary = Number(fixedSalary) || 0;
        if (perTankIncentive != null) updates.perTankIncentive = Number(perTankIncentive) || 0;
        if (defaultPerJobIncentive != null) updates.defaultPerJobIncentive = Number(defaultPerJobIncentive) || 0;
        if (defaultFuelExpense != null) updates.defaultFuelExpense = Number(defaultFuelExpense) || 0;
        if (defaultChemicalExpense != null) updates.defaultChemicalExpense = Number(defaultChemicalExpense) || 0;
        if (typeof hasBike === 'boolean') updates.hasBike = hasBike;
        if (fuelAllowance != null) updates.fuelAllowance = Number(fuelAllowance) || 0;
        if (joiningDate) updates.joiningDate = new Date(joiningDate);
        if (employmentStatus && ['Active', 'Inactive', 'Terminated'].includes(employmentStatus)) {
            updates.employmentStatus = employmentStatus;
            updates.isActive = employmentStatus === 'Active';
        }
        if (remarks !== undefined) updates.remarks = remarks || '';
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

// --- EXPENSES ---

// Create expense
app.post('/api/expenses', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    try {
        const {
            date,
            amount,
            category,
            purpose,
            staffName,
            staffId,
            paymentMode,
            notes,
        } = req.body;

        if (!date || amount == null || !category) {
            return res.status(400).json({ message: 'Date, amount and category are required' });
        }

        const expense = new Expense({
            date: new Date(date),
            amount: Number(amount) || 0,
            category,
            purpose: purpose || '',
            staffName: staffName || '',
            staffId: staffId || undefined,
            paymentMode: paymentMode || '',
            notes: notes || '',
            createdBy: req.user.id,
        });

        await expense.save();
        res.status(201).json(expense);
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to create expense' });
    }
});

// List expenses (optional filters: from, to, category)
app.get('/api/expenses', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    try {
        const { from, to, category } = req.query;
        const filter = {};

        if (from || to) {
            filter.date = {};
            if (from) filter.date.$gte = new Date(from);
            if (to) filter.date.$lte = new Date(to);
        }
        if (category) filter.category = category;

        const expenses = await Expense.find(filter).sort({ date: -1, createdAt: -1 });
        res.json(expenses);
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to load expenses' });
    }
});

// Delete expense (admin only)
app.delete('/api/expenses/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    try {
        const expense = await Expense.findByIdAndDelete(req.params.id);
        if (!expense) return res.status(404).json({ message: 'Expense not found' });
        res.json({ success: true, message: 'Expense deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to delete expense' });
    }
});

// --- SERVICES (custom starting prices for job/lead forms) ---

app.get('/api/services', auth, async (req, res) => {
    try {
        const list = await Service.find().sort({ order: 1, name: 1 });
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to load services' });
    }
});

app.put('/api/services', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    try {
        const items = Array.isArray(req.body) ? req.body : req.body.items || [];
        await Service.deleteMany({});
        if (items.length > 0) {
            const docs = items.map((item, i) => ({
                name: String(item.name || '').trim(),
                startingPrice: item.startingPrice != null && item.startingPrice !== '' ? Number(item.startingPrice) : null,
                order: typeof item.order === 'number' ? item.order : i,
            })).filter(d => d.name);
            await Service.insertMany(docs);
        }
        const list = await Service.find().sort({ order: 1, name: 1 });
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to update services' });
    }
});

// --- JOB ROUTES ---

// Helper: add months safely (repeat cleaning reminder = +6 months)
function addMonths(date, months) {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    // month roll-over handle
    if (d.getDate() < day) {
        d.setDate(0);
    }
    return d;
}

app.post('/api/jobs', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    try {
        const {
            customerName,
            address,
            latitude,
            longitude,
            tankSize,
            serviceType,
            leadSource,
            mobileNumber,
            scheduledAt,
            serviceCharge,
            paymentMode,
            paymentStatus,
            staffRemark,
            assignedStaff,
            notes,
            targetLatitude,
            targetLongitude,
            incentivePerJob,
            tankCount
        } = req.body;

        if (!customerName || !address) {
            return res.status(400).json({ message: 'Customer name and address are required' });
        }
        if (latitude == null || longitude == null) {
            return res.status(400).json({ message: 'Latitude and longitude are required' });
        }

        const jobData = {
            customerName: String(customerName).trim(),
            address: String(address).trim(),
            latitude,
            longitude,
            tankSize,
            tankCount: tankCount != null ? Number(tankCount) || 1 : 1,
            serviceType,
            leadSource,
            mobileNumber,
            notes,
            targetLatitude: targetLatitude ?? latitude,
            targetLongitude: targetLongitude ?? longitude,
        };

        if (scheduledAt) {
            jobData.scheduledAt = new Date(scheduledAt);
        }

        if (Array.isArray(assignedStaff) && assignedStaff.length > 0) {
            jobData.assignedStaff = [assignedStaff[0]];
        }

        if (serviceCharge != null) jobData.serviceCharge = Number(serviceCharge) || 0;
        if (paymentMode) jobData.paymentMode = paymentMode;
        if (paymentStatus) jobData.paymentStatus = paymentStatus;
        if (staffRemark) jobData.staffRemark = staffRemark;
        if (incentivePerJob != null) jobData.incentivePerJob = Number(incentivePerJob) || 0;

        const job = new Job(jobData);
        await job.save();

        // One staff per job: remove this staff from any other active job
        const staffIds = (job.assignedStaff || []).map(id => id.toString ? id.toString() : id);
        if (staffIds.length > 0) {
            await Job.updateMany(
                { _id: { $ne: job._id }, status: { $in: ['pending', 'on_the_way', 'in_progress'] } },
                { $pullAll: { assignedStaff: staffIds } }
            );
        }
        res.status(201).json({ success: true, jobId: job._id });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to create job' });
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

        const jobs = await Job.find(filter).populate('assignedStaff', 'name phone lastLatitude lastLongitude lastLocationTime perTankIncentive defaultPerJobIncentive defaultFuelExpense').sort({ 'timeline.createdAt': -1 });
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
        const job = await Job.findById(req.params.id).populate('assignedStaff', 'name phone lastLatitude lastLongitude lastLocationTime perTankIncentive defaultPerJobIncentive defaultFuelExpense defaultChemicalExpense');
        if (!job) return res.status(404).json({ message: 'Job not found' });
        const jobObj = job.toObject ? job.toObject() : job;
        // Send photo paths as-is (no server base URL). Client builds full URL with its own base so admin/staff on any device can load images.
        res.json(jobObj);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.put('/api/jobs/:id', auth, async (req, res) => {
    try {
        const {
            status,
            notes,
            paymentStatus,
            paymentMode,
            staffRemark,
            serviceCharge,
            incentivePerJob,
            scheduledAt
        } = req.body;

        const updates = {};
        if (status) updates.status = status;
        if (notes !== undefined) updates.notes = notes;
        if (paymentStatus) updates.paymentStatus = paymentStatus;
        if (paymentMode) updates.paymentMode = paymentMode;
        if (staffRemark !== undefined) updates.staffRemark = staffRemark;
        if (serviceCharge != null) updates.serviceCharge = Number(serviceCharge) || 0;
        if (incentivePerJob != null) updates.incentivePerJob = Number(incentivePerJob) || 0;
        if (scheduledAt) updates.scheduledAt = new Date(scheduledAt);

        // Job timeline for admin: staff start → on the way → arrived → completed
        if (status === 'on_the_way') updates['timeline.startedAt'] = new Date();
        if (status === 'in_progress') updates['timeline.arrivedAt'] = new Date();
        if (status === 'completed') {
            // Require at least 1 after photo before completing
            const existingJob = await Job.findById(req.params.id);
            if (existingJob) {
                const afterCount = (existingJob.photos?.after?.length || 0) + (existingJob.completionPhoto ? 1 : 0);
                if (afterCount === 0) {
                    return res.status(400).json({ message: 'Please upload at least 1 after photo before marking job as complete' });
                }
            }
            const now = new Date();
            updates['timeline.completedAt'] = now;
            // Auto: repeat cleaning reminder after 6 months
            updates.nextServiceAt = addMonths(now, 6);
        }

        let job = await Job.findByIdAndUpdate(req.params.id, updates, { new: true });

        if (status === 'completed' && job && job.assignedStaff && job.assignedStaff.length > 0) {
            const firstStaffId = job.assignedStaff[0];
            const staffDoc = await User.findById(firstStaffId).select('defaultFuelExpense defaultChemicalExpense name');
            const fuel = Number(staffDoc?.defaultFuelExpense) || 0;
            const chemical = Number(staffDoc?.defaultChemicalExpense) || 0;
            const totalExpense = fuel + chemical;
            job = await Job.findByIdAndUpdate(req.params.id, {
                'jobExpenses.fuelCost': fuel,
                'jobExpenses.chemicalCost': chemical,
                'jobExpenses.otherCost': 0,
                'jobExpenses.totalExpense': totalExpense,
            }, { new: true });

            const staffName = staffDoc?.name || 'Staff';
            const expenseDate = job.timeline?.completedAt || new Date();
            const expensesToCreate = [];
            if (fuel > 0) {
                expensesToCreate.push({
                    date: expenseDate,
                    amount: fuel,
                    category: 'Fuel',
                    purpose: `Fuel for job: ${job.customerName} (${job.address})`,
                    staffName,
                    staffId: firstStaffId,
                    paymentMode: 'Cash',
                    notes: `Auto from job ${job._id}`,
                });
            }
            if (chemical > 0) {
                expensesToCreate.push({
                    date: expenseDate,
                    amount: chemical,
                    category: 'Chemical',
                    purpose: `Chemical for job: ${job.customerName} (${job.address})`,
                    staffName,
                    staffId: firstStaffId,
                    paymentMode: 'Cash',
                    notes: `Auto from job ${job._id}`,
                });
            }
            if (expensesToCreate.length > 0) await Expense.insertMany(expensesToCreate);
        }

        // When job is completed, update linked lead's conversation log (follow-up)
        if (status === 'completed' && job) {
            const linkedLead = await Lead.findOne({ firstJobId: req.params.id });
            if (linkedLead) {
                const now = new Date();
                const nextFollow = addMonths(now, 6);
                linkedLead.discussionLogs.push({
                    at: now,
                    by: 'Admin',
                    notes: `Job completed on ${now.toLocaleDateString('en-IN')}. Next service follow-up in 6 months.`,
                    nextFollowUpAt: nextFollow,
                });
                linkedLead.nextFollowUpAt = nextFollow;
                await linkedLead.save();
            }
        }

        if (io) io.to(`job_${req.params.id}`).emit('job_updated', job);

        res.json({ success: true, message: 'Job updated' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- SAVE JOB EXPENSES (Admin override or staff submit - kept for backward compatibility) ---
app.post('/api/jobs/:id/expenses', auth, async (req, res) => {
    try {
        const { fuelCost, chemicalCost, otherCost, otherCostNote } = req.body;
        const fuel = Number(fuelCost) || 0;
        const chemical = Number(chemicalCost) || 0;
        const other = Number(otherCost) || 0;
        const totalExpense = fuel + chemical + other;

        const job = await Job.findByIdAndUpdate(req.params.id, {
            'jobExpenses.fuelCost': fuel,
            'jobExpenses.chemicalCost': chemical,
            'jobExpenses.otherCost': other,
            'jobExpenses.otherCostNote': (otherCostNote || '').trim(),
            'jobExpenses.totalExpense': totalExpense,
        }, { new: true });

        if (!job) return res.status(404).json({ message: 'Job not found' });

        // Auto-create expense entries in Expense collection for admin tracking
        const staffName = req.user.name || req.user.phone || 'Staff';
        const staffId = req.user._id || req.user.id;
        const expenseDate = job.timeline?.completedAt || new Date();

        const expensesToCreate = [];
        if (fuel > 0) {
            expensesToCreate.push({
                date: expenseDate,
                amount: fuel,
                category: 'Fuel',
                purpose: `Fuel for job: ${job.customerName} (${job.address})`,
                staffName,
                staffId,
                paymentMode: 'Cash',
                notes: `Auto from job ${job._id}`,
            });
        }
        if (chemical > 0) {
            expensesToCreate.push({
                date: expenseDate,
                amount: chemical,
                category: 'Chemical',
                purpose: `Chemical for job: ${job.customerName} (${job.address})`,
                staffName,
                staffId,
                paymentMode: 'Cash',
                notes: `Auto from job ${job._id}`,
            });
        }
        if (other > 0) {
            expensesToCreate.push({
                date: expenseDate,
                amount: other,
                category: 'Miscellaneous',
                purpose: `${otherCostNote || 'Other expense'} for job: ${job.customerName}`,
                staffName,
                staffId,
                paymentMode: 'Cash',
                notes: `Auto from job ${job._id}`,
            });
        }
        if (expensesToCreate.length > 0) {
            await Expense.insertMany(expensesToCreate);
        }

        res.json({ success: true, totalExpense, message: 'Expenses saved' });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to save expenses' });
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

// --- JOB PHOTO UPLOAD (after / completion photo) ---
app.post('/api/jobs/:id/upload', auth, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        // Enforce 10-photo limit for after photos
        const existingJob = await Job.findById(req.params.id);
        if (!existingJob) return res.status(404).json({ message: 'Job not found' });
        if (existingJob.photos && existingJob.photos.after && existingJob.photos.after.length >= 10) {
            return res.status(400).json({ message: 'Maximum 10 after photos allowed' });
        }

        const timestamp = req.body.timestamp ? new Date(req.body.timestamp) : new Date();
        const lat = req.body.latitude != null ? parseFloat(req.body.latitude) : null;
        const lng = req.body.longitude != null ? parseFloat(req.body.longitude) : null;

        let photoUrl;
        if (req.file.buffer) {
            const fname = 'after-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(req.file.originalname || '.jpg');
            photoUrl = await uploadToStorage(req.file.buffer, fname, req.file.mimetype);
        } else {
            photoUrl = req.file.filename;
        }

        const afterMeta = { at: timestamp, latitude: lat, longitude: lng };
        const updates = {
            completionPhoto: photoUrl,
            completionPhotoAt: timestamp,
            completionLatitude: lat,
            completionLongitude: lng,
            $push: {
                'photos.after': photoUrl,
                photosAfterMeta: afterMeta
            }
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

// --- JOB BEFORE PHOTO UPLOAD (before starting work) ---
app.post('/api/jobs/:id/upload-before', auth, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        // Enforce 10-photo limit for before photos
        const existingJob = await Job.findById(req.params.id);
        if (!existingJob) return res.status(404).json({ message: 'Job not found' });
        if (existingJob.photos && existingJob.photos.before && existingJob.photos.before.length >= 10) {
            return res.status(400).json({ message: 'Maximum 10 before photos allowed' });
        }

        const timestamp = req.body.timestamp ? new Date(req.body.timestamp) : new Date();
        const lat = req.body.latitude != null ? parseFloat(req.body.latitude) : null;
        const lng = req.body.longitude != null ? parseFloat(req.body.longitude) : null;

        let photoUrl;
        if (req.file.buffer) {
            const fname = 'before-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(req.file.originalname || '.jpg');
            photoUrl = await uploadToStorage(req.file.buffer, fname, req.file.mimetype);
        } else {
            photoUrl = req.file.filename;
        }

        const beforeMeta = { at: timestamp, latitude: lat, longitude: lng };
        const updates = {
            $push: {
                'photos.before': photoUrl,
                photosBeforeMeta: beforeMeta
            },
            status: 'in_progress',
            'timeline.arrivedAt': timestamp,  // admin: when staff arrived at location
            beforePhotoAt: timestamp,
            beforePhotoLatitude: lat,
            beforePhotoLongitude: lng,
        };
        if (existingJob.status === 'pending') {
            updates['timeline.startedAt'] = timestamp;  // if they uploaded before tapping Start, set startedAt too
        }
        const job = await Job.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!job) return res.status(404).json({ message: 'Job not found' });
        res.json({
            success: true,
            message: 'Before photo uploaded, job started',
            photos: job.photos,
            status: job.status
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
        hasMongoUri: !!process.env.MONGO_URI,
        ...(dbReady ? {} : { hint: 'Fix: Atlas Network Access → Add 0.0.0.0/0, and ensure MONGO_URI is correct in Vercel env.' })
    });
});

// --- STATS ROUTES ---

app.get('/api/stats/dashboard', auth, requireDb, async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const totalJobs = await Job.countDocuments();
        const pendingJobs = await Job.countDocuments({ status: 'pending' });
        const onTheWayJobs = await Job.countDocuments({ status: 'on_the_way' });
        const inProgressJobs = await Job.countDocuments({ status: 'in_progress' });
        const completedJobs = await Job.countDocuments({ status: 'completed' });
        const activeStaff = await User.countDocuments({ role: 'staff', isActive: true });

        // Revenue from paid jobs
        const paidJobs = await Job.find({ paymentStatus: 'paid' }).select('serviceCharge jobExpenses');
        const totalRevenue = paidJobs.reduce((s, j) => s + (j.serviceCharge || 0), 0);

        const monthlyPaidJobs = await Job.find({
            paymentStatus: 'paid',
            'timeline.completedAt': { $gte: startOfMonth }
        }).select('serviceCharge jobExpenses');
        const monthlyRevenue = monthlyPaidJobs.reduce((s, j) => s + (j.serviceCharge || 0), 0);

        // Expense collection total (fuel, chemical, manual, etc.)
        const allExpenses = await Expense.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);
        const totalExpenseGeneral = allExpenses.length > 0 ? allExpenses[0].total : 0;

        // Staff incentive = expense (what we pay to staff). Include in total expenses so admin profit is correct.
        const completedJobsForIncentive = await Job.find({ status: 'completed' })
            .select('tankCount incentivePerJob')
            .populate('assignedStaff', 'perTankIncentive defaultPerJobIncentive defaultFuelExpense');
        const totalStaffIncentive = completedJobsForIncentive.reduce((s, j) => {
            const firstStaff = (j.assignedStaff && j.assignedStaff[0]) ? j.assignedStaff[0] : null;
            const tankCount = Number(j.tankCount ?? 1);
            const perTank = Number(firstStaff?.perTankIncentive ?? 0);
            const perJob = Number(firstStaff?.defaultPerJobIncentive ?? 0);
            const fuel = Number(firstStaff?.defaultFuelExpense ?? 0);
            const incentive = firstStaff && (perTank > 0 || perJob > 0 || fuel > 0)
                ? tankCount * perTank + perJob + fuel
                : (Number(j.incentivePerJob) || 0);
            return s + incentive;
        }, 0);

        const completedJobsMonthly = await Job.find({
            status: 'completed',
            'timeline.completedAt': { $gte: startOfMonth }
        })
            .select('tankCount incentivePerJob')
            .populate('assignedStaff', 'perTankIncentive defaultPerJobIncentive defaultFuelExpense');
        const monthlyStaffIncentive = completedJobsMonthly.reduce((s, j) => {
            const firstStaff = (j.assignedStaff && j.assignedStaff[0]) ? j.assignedStaff[0] : null;
            const tankCount = Number(j.tankCount ?? 1);
            const perTank = Number(firstStaff?.perTankIncentive ?? 0);
            const perJob = Number(firstStaff?.defaultPerJobIncentive ?? 0);
            const fuel = Number(firstStaff?.defaultFuelExpense ?? 0);
            const incentive = firstStaff && (perTank > 0 || perJob > 0 || fuel > 0)
                ? tankCount * perTank + perJob + fuel
                : (Number(j.incentivePerJob) || 0);
            return s + incentive;
        }, 0);

        // Monthly expense = Expense collection (date in month) + staff incentive (jobs completed this month)
        const monthlyExpenseAgg = await Expense.aggregate([
            { $match: { date: { $gte: startOfMonth, $lte: now } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const monthlyExpenseGeneral = monthlyExpenseAgg.length > 0 ? monthlyExpenseAgg[0].total : 0;
        const monthlyExpense = monthlyExpenseGeneral + monthlyStaffIncentive;

        const totalExpenses = totalExpenseGeneral + totalStaffIncentive;
        const totalProfit = totalRevenue - totalExpenses;

        res.json({
            totalJobs,
            pendingJobs,
            onTheWayJobs,
            inProgressJobs,
            completedJobs,
            activeStaff,
            totalRevenue,
            totalExpenses,
            totalStaffIncentive,
            monthlyRevenue,
            monthlyExpense,
            monthlyStaffIncentive,
            totalProfit,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Staff performance summary (for Staff Dashboard / Admin detail)
app.get('/api/stats/staff/:id', auth, async (req, res) => {
    try {
        const staffId = req.params.id;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Jobs jahan yeh staff assigned hai
        const match = { assignedStaff: staffId };

        const [allJobs, monthlyJobs] = await Promise.all([
            Job.find(match),
            Job.find({ ...match, 'timeline.completedAt': { $gte: startOfMonth } })
        ]);

        const totalJobs = allJobs.length;
        const completedJobs = allJobs.filter(j => j.status === 'completed').length;
        const totalRevenue = allJobs.reduce((sum, j) => sum + (j.serviceCharge || 0), 0);

        // Incentive: per completed job uses incentivePerJob (no default fallback)
        const completedForIncentive = allJobs.filter(j => j.status === 'completed');
        const totalIncentive = completedForIncentive.reduce((sum, j) => {
            return sum + (Number(j.incentivePerJob) || 0);
        }, 0);
        const monthlyIncentive = monthlyJobs
            .filter(j => j.status === 'completed')
            .reduce((sum, j) => {
                return sum + (Number(j.incentivePerJob) || 0);
            }, 0);

        const monthlyRevenue = monthlyJobs.reduce((sum, j) => sum + (j.serviceCharge || 0), 0);

        res.json({
            staffId,
            totalJobs,
            completedJobs,
            totalRevenue,
            monthlyRevenue,
            totalIncentive,
            monthlyIncentive,
            completionRate: totalJobs ? Math.round((completedJobs / totalJobs) * 100) : 0
        });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to load staff stats' });
    }
});

// --- REPORTS & REMINDERS ---

// High level reports + reminder buckets for Admin Reports screen
app.get('/api/reports/summary', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Daily & Monthly Revenue (paid jobs) + Daily Jobs + Daily Expense
        const [dailyPaidJobs, monthlyPaidJobs, dailyJobsCount, dailyExpenses] = await Promise.all([
            Job.find({
                paymentStatus: 'paid',
                'timeline.completedAt': { $gte: startOfDay }
            }),
            Job.find({
                paymentStatus: 'paid',
                'timeline.completedAt': { $gte: startOfMonth }
            }),
            Job.countDocuments({
                'timeline.completedAt': { $gte: startOfDay }
            }),
            Expense.find({
                date: {
                    $gte: startOfDay,
                    $lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
                }
            })
        ]);

        const dailyRevenue = dailyPaidJobs.reduce((sum, j) => sum + (j.serviceCharge || 0), 0);
        const monthlyRevenue = monthlyPaidJobs.reduce((sum, j) => sum + (j.serviceCharge || 0), 0);
        const dailyExpense = dailyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const dailyNetProfit = dailyRevenue - dailyExpense;

        // Staff wise: revenue (from paid jobs), incentive (from completed jobs), job count; with staff name
        const staffWise = await Job.aggregate([
            { $match: { assignedStaff: { $exists: true, $ne: [] } } },
            { $unwind: '$assignedStaff' },
            {
                $group: {
                    _id: '$assignedStaff',
                    jobs: { $sum: 1 },
                    revenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, { $ifNull: ['$serviceCharge', 0] }, 0] } },
                    incentive: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, { $ifNull: ['$incentivePerJob', 0] }, 0] } }
                }
            },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'staffDoc' } },
            { $unwind: { path: '$staffDoc', preserveNullAndEmptyArrays: true } },
            { $project: { _id: 1, jobs: 1, revenue: 1, incentive: 1, staffName: { $ifNull: ['$staffDoc.name', ''] } } }
        ]);

        // Pending payments
        const pendingPayments = await Job.find({ paymentStatus: 'pending' })
            .select('customerName mobileNumber serviceCharge paymentMode status timeline.completedAt');

        // Repeat customers (same mobileNumber with >1 job)
        const repeatAgg = await Job.aggregate([
            { $match: { mobileNumber: { $exists: true, $ne: '' } } },
            {
                $group: {
                    _id: '$mobileNumber',
                    customerName: { $first: '$customerName' },
                    totalJobs: { $sum: 1 },
                    totalRevenue: { $sum: { $ifNull: ['$serviceCharge', 0] } },
                    lastServiceAt: { $max: '$timeline.completedAt' }
                }
            },
            { $match: { totalJobs: { $gt: 1 } } },
            { $sort: { totalJobs: -1 } }
        ]);

        // Follow-up reminders: leads jinka nextFollowUpAt aaj ya future me hai
        const followUpLeads = await Lead.find({
            nextFollowUpAt: { $gte: startOfDay },
            status: { $in: ['New', 'Follow-up', 'Confirmed'] }
        }).select('customerName mobileNumber nextFollowUpAt status');

        // Repeat cleaning reminders: jobs jinka nextServiceAt 15 din ke andar hai
        const fifteenDaysLater = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
        const repeatJobs = await Job.find({
            nextServiceAt: { $gte: startOfDay, $lte: fifteenDaysLater }
        }).select('customerName mobileNumber address nextServiceAt serviceType tankSize notes timeline.completedAt');

        // Upcoming jobs (job reminder) based on scheduledAt (next 6 hours)
        const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);
        const upcomingJobs = await Job.find({
            scheduledAt: { $gte: now, $lte: sixHoursLater },
            status: { $in: ['pending', 'in_progress'] }
        }).select('customerName mobileNumber scheduledAt status assignedStaff');

        res.json({
            today: startOfDay,
            dailyRevenue,
            monthlyRevenue,
            staffWise,
            pendingPayments,
            repeatCustomers: repeatAgg,
            reminders: {
                followUps: followUpLeads,
                repeatCleanings: repeatJobs,
                upcomingJobs
            },
            summary: {
                date: startOfDay,
                totalJobs: dailyJobsCount,
                totalRevenue: dailyRevenue,
                totalExpense: dailyExpense,
                netProfit: dailyNetProfit
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to load reports' });
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
