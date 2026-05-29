const db = require('./src/db');
const { machineIdSync } = require('node-machine-id');

async function fix() {
    try {
        await db.connect();
        const hwid = machineIdSync();
        console.log("Your HWID:", hwid);
        
        console.log("Checking if user exists...");
        let user = await db.findUserByHWID(hwid);
        if (!user) {
            console.log("User not found. Creating user 'Igor'...");
            user = await db.registerOrUpdateUser(hwid, 'Igor', null, process.platform);
        }
        console.log("User:", user);
        
        console.log("Checking license...");
        const hasLicense = await db.hasValidLicense(hwid);
        if (!hasLicense) {
            console.log("No valid license. Generating one...");
            const key = 'IG-MASTER-KEY-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            
            // Insert license
            await db.client.from('licenses').insert([{ 
                key: key, 
                is_active: true,
                hwid_vinculado: hwid,
                activated_at: new Date().toISOString()
            }]);
            console.log("License generated and bound to your HWID:", key);
        } else {
            console.log("License is already active!");
        }
        
        console.log("Fix complete! You can now log in.");
    } catch(e) {
        console.error(e);
    }
}
fix();
