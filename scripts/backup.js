/**
 * Automated Full System Backup Script
 * Backs up all database JSON files (wedding, guests, wishes, users)
 * and uploaded assets into timestamped archives in /backups/
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(ROOT_DIR, 'public', 'uploads');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const h = pad(now.getHours());
  const min = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  return `${y}${m}${d}_${h}${min}${s}`;
}

function runBackup() {
  const ts = getTimestamp();
  const targetDir = path.join(BACKUPS_DIR, `snapshot_${ts}`);
  const targetDataDir = path.join(targetDir, 'data');
  const targetUploadsDir = path.join(targetDir, 'uploads');

  fs.mkdirSync(targetDataDir, { recursive: true });
  fs.mkdirSync(targetUploadsDir, { recursive: true });

  console.log(`========================================`);
  console.log(`📦 STARTING PRE-DEPLOY SYSTEM BACKUP: ${ts}`);
  console.log(`========================================`);

  // 1. Backup JSON databases
  const bundle = {
    backedUpAt: new Date().toISOString(),
    timestamp: ts,
    wedding: null,
    guests: [],
    wishes: [],
    users: []
  };

  const jsonFiles = ['wedding-data.json', 'guests.json', 'wishes.json', 'users.json'];
  jsonFiles.forEach(file => {
    const src = path.join(DATA_DIR, file);
    if (fs.existsSync(src)) {
      const dest = path.join(targetDataDir, file);
      fs.copyFileSync(src, dest);
      try {
        const parsed = JSON.parse(fs.readFileSync(src, 'utf8'));
        if (file === 'wedding-data.json') bundle.wedding = parsed;
        if (file === 'guests.json') bundle.guests = parsed;
        if (file === 'wishes.json') bundle.wishes = parsed;
        if (file === 'users.json') bundle.users = parsed;
      } catch (e) {}
      console.log(`  ✓ Backed up database: data/${file}`);
    }
  });

  // 2. Backup uploaded images
  let uploadCount = 0;
  if (fs.existsSync(UPLOADS_DIR)) {
    const uploads = fs.readdirSync(UPLOADS_DIR);
    uploads.forEach(file => {
      const src = path.join(UPLOADS_DIR, file);
      if (fs.statSync(src).isFile()) {
        const dest = path.join(targetUploadsDir, file);
        fs.copyFileSync(src, dest);
        uploadCount++;
      }
    });
  }
  console.log(`  ✓ Backed up ${uploadCount} uploaded photos to snapshot_${ts}/uploads/`);

  // 3. Write unified JSON bundle
  const bundlePath = path.join(targetDir, 'full-system-backup.json');
  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), 'utf8');

  // Also update latest-full-backup.json in /backups/
  const latestPath = path.join(BACKUPS_DIR, 'latest-full-backup.json');
  fs.writeFileSync(latestPath, JSON.stringify(bundle, null, 2), 'utf8');

  console.log(`  ✓ Generated unified bundle: backups/latest-full-backup.json`);
  console.log(`========================================`);
  console.log(`🎉 BACKUP COMPLETED SUCCESSFULLY!`);
  console.log(`   Location: ${targetDir}`);
  console.log(`========================================\n`);

  return { targetDir, bundle };
}

if (require.main === module) {
  runBackup();
}

module.exports = { runBackup };
