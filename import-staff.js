const fs = require('fs');
const csv = require('csv-parser');
const admin = require('firebase-admin');

// --- Firebase Initialization ---
try {
  const serviceAccount = require('./service-account-key.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  console.error("🔴 FATAL ERROR: Could not initialize Firebase. Is 'service-account-key.json' present and correct?");
  process.exit(1);
}
const db = admin.firestore();
// -----------------------------

const staffFilePath = './staff.csv';
if (!fs.existsSync(staffFilePath)) {
  console.error(`🔴 FATAL ERROR: Cannot find '${staffFilePath}'. Make sure it's in the same folder.`);
  process.exit(1);
}

const promises = [];

console.log('🚀 Starting to import staff from CSV...');

fs.createReadStream(staffFilePath)
  .pipe(csv())
  .on('data', (row) => {
    // Check if the essential headers exist in the row
    if (!row['ID Number'] || !row['Last Name'] || !row['First Name']) {
      console.warn("⚠️ Skipping a row because it's missing required data (ID Number, Last Name, or First Name). Check your CSV headers.");
      return;
    }

    const lastName = row['Last Name'] || '';
    const firstName = row['First Name'] || '';
    const middleName = row['Middle Name'] || '';
    
    const middleInitial = middleName ? `${middleName.charAt(0)}.` : '';
    const fullName = `${lastName}, ${firstName} ${middleInitial}`.trim();

    const newStaff = {
      staff_id: row['ID Number'],
      staff_name: fullName
    };

    promises.push(db.collection('staff').add(newStaff));
  })
  .on('end', async () => {
    console.log('...CSV file read completely. Saving all data to Firebase...');
    try {
      await Promise.all(promises);
      console.log(`✅ Success! ${promises.length} staff members have been imported to Firebase.`);
    } catch (error) {
      console.error("\n🔴 The import failed. An error occurred while saving to Firebase.");
      console.error("This is likely caused by an issue in your CSV file (like a blank 'ID Number' for a row). Please check the file and the error message below for clues.");
      console.error("\nFirestore Error Details:", error);
    }
  });