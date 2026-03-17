const express = require('express');
const admin = require('firebase-admin');

// --- Firebase Initialization ---
const serviceAccount = require('./service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
// -----------------------------

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname)); 
app.use(express.json());

// API to get staff list (remains the same)
app.get('/api/staff', async (req, res) => {
    const staffCollection = await db.collection('staff').get();
    const staffList = staffCollection.docs.map(doc => doc.data());
    res.json(staffList);
});

// --- UPDATED AND COMBINED: This single endpoint now handles checking and submitting ---
app.post('/api/attend', async (req, res) => {
    try {
        // EXTRACT THE NEW BRANCH VARIABLE
        const { staff_id, staff_name, branch } = req.body;

        // Get the start and end of the current day based on the server's time
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        // 1. First, CHECK if a record already exists for this staff_id today
        const snapshot = await db.collection('attendance')
            .where('staff_id', '==', staff_id)
            .where('timestamp', '>=', startOfDay)
            .where('timestamp', '<=', endOfDay)
            .limit(1)
            .get();

        // 2. If the snapshot is NOT empty, a record exists. Refuse the submission.
        if (!snapshot.empty) {
            // Send a "409 Conflict" error, which is the correct code for a duplicate.
            return res.status(409).json({ message: `${staff_name} has already submitted attendance today.` });
        }

        // 3. If the snapshot IS empty, proceed to create the new record.
        const newRecord = {
            staff_id: staff_id,
            staff_name: staff_name,
            branch: branch || 'N/A', // SAVE THE BRANCH TO THE DATABASE
            timestamp: new Date()
        };
        await db.collection('attendance').add(newRecord);
        
        // Send a success message.
        res.status(200).json({ message: 'Attendance recorded successfully!' });

    } catch (error) {
        console.error("Error in /api/attend:", error);
        res.status(500).json({ message: 'This portal is not yet open to accept attendance.' });
    }
});

// We no longer need the separate /api/check-attendance endpoint. It has been removed.

// API to export records (UPDATED TO SORT BY BRANCH)
app.get('/api/export', async (req, res) => {
    const snapshot = await db.collection('attendance').orderBy('timestamp', 'desc').get();
    
    // Extract records into an array so we can sort them by branch
    const records = [];
    snapshot.forEach(doc => records.push(doc.data()));

    // Sort alphabetically by branch
    records.sort((a, b) => {
        const branchA = a.branch || '';
        const branchB = b.branch || '';
        return branchA.localeCompare(branchB); 
    });

    // Update CSV Header
    let csvContent = 'branch,staff_id,staff_name,timestamp\n';
    
    // Build CSV Rows
    records.forEach(record => {
        const date = record.timestamp.toDate().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
        csvContent += `"${record.branch || 'N/A'}",${record.staff_id},"${record.staff_name}","${date}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance_records.csv"');
    res.status(200).send(csvContent);
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
