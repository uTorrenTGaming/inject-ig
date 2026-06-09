const db = require('./src/db');
async function test() {
    try {
        const hwid = 'test_hwid';
        const username = 'igor';
        const avatar_url = null;
        
        if (!db.client) await db.connect();
        
        console.log("Checking user...");
        const userCheck = await db.findUserByHWID(hwid);
        
        console.log("Checking license...");
        const hasLicense = await db.hasValidLicense(hwid);
        
        console.log("UserCheck:", userCheck);
        console.log("HasLicense:", hasLicense);
        
        if (!username) {
            console.log("Return:", { success: true, user: userCheck, requireLicense: !hasLicense });
            return;
        }

        if (!hasLicense) {
            console.log("Return:", { success: false, requireLicense: true });
            return;
        }

        const os_type = process.platform;
        console.log("Registering/Updating...");
        const user = await db.registerOrUpdateUser(hwid, username, avatar_url, os_type);
        console.log("Return:", { success: true, user });

    } catch(e) {
        console.error("Test failed:", e);
    }
}
test();
