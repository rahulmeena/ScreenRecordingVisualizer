const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const zipPath = path.join(__dirname, 'uploads', '460de0c3-2458-4101-b274-b99d45c9976c', 'upload.zip');

try {
  console.log(`Testing zip file: ${zipPath}`);
  console.log(`File size: ${fs.statSync(zipPath).size} bytes`);
  
  // Try to validate the zip file
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  
  console.log(`Zip file is valid with ${entries.length} entries:`);
  entries.forEach(entry => {
    console.log(` - ${entry.entryName} (${entry.header.size} bytes)`);
  });
} catch (error) {
  console.error(`Error with zip file: ${error.message}`);
  
  // Try to diagnose further
  try {
    const buffer = fs.readFileSync(zipPath);
    console.log(`First 16 bytes: ${buffer.slice(0, 16).toString('hex')}`);
    console.log(`ZIP file signature should start with: 504b0304`);
    
    // Check if file starts with ZIP signature (PK..)
    if (buffer.slice(0, 4).toString('hex') !== '504b0304') {
      console.log('File does not start with ZIP signature - likely corrupt or not a ZIP file');
    }
  } catch (readError) {
    console.error(`Error reading file: ${readError.message}`);
  }
} 