/**
 * Sync normalized player metadata from the Player Data API into PlayerStub.
 *
 * Manual:
 *   node server/scripts/sync-player-metadata.js
 *   npm run sync:players --prefix server
 *
 * Scheduled:
 *   PLAYER_METADATA_SYNC_INTERVAL_MINUTES=360 node server/scripts/sync-player-metadata.js --watch
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { syncPlayerMetadata } = require('../services/player-metadata-sync-service');

const DEFAULT_INTERVAL_MINUTES = 360;

function getIntervalMs() {
    const raw = process.env.PLAYER_METADATA_SYNC_INTERVAL_MINUTES;
    const minutes = raw == null ? DEFAULT_INTERVAL_MINUTES : Number(raw);
    if (!Number.isFinite(minutes) || minutes <= 0) {
        throw new Error('PLAYER_METADATA_SYNC_INTERVAL_MINUTES must be a positive number when --watch is used.');
    }
    return minutes * 60 * 1000;
}

async function connect() {
    if (!process.env.MONGODB_CONNECT) {
        throw new Error('Missing MONGODB_CONNECT in server/.env.');
    }

    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_CONNECT, { serverSelectionTimeoutMS: 5000 });
        console.log('Connected to MongoDB');
    }
}

async function runOnce() {
    await connect();
    await syncPlayerMetadata();
}

async function main() {
    const watch = process.argv.includes('--watch');
    await runOnce();

    if (!watch) {
        await mongoose.disconnect();
        return;
    }

    const intervalMs = getIntervalMs();
    console.log(`Player metadata sync scheduled every ${intervalMs / 60000} minutes`);
    setInterval(() => {
        runOnce().catch((err) => {
            console.error('Scheduled player metadata sync failed:', err.message);
        });
    }, intervalMs);
}

process.on('SIGINT', async () => {
    await mongoose.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await mongoose.disconnect();
    process.exit(0);
});

main().catch(async (err) => {
    console.error('Player metadata sync failed:', err.message);
    await mongoose.disconnect();
    process.exit(1);
});
