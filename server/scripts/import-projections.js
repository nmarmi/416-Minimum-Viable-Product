/**
 * Import projections-NL.csv into the Player collection (source: 'projection').
 * Usage:
 *   node server/scripts/import-projections.js [path-to-projections-NL.csv]
 *   PROJECTIONS_CSV=/path/to/projections-NL.csv node server/scripts/import-projections.js
 * If no path is given, uses server/data/projections-NL.csv (copy your CSV there first).
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Player = require('../models/player-model');

const CSV_PATH = process.env.PROJECTIONS_CSV || process.argv[2] || path.join(__dirname, '..', 'data', 'projections-NL.csv');

function parsePlayerCell(str) {
    const s = (str || '').trim();
    const pipeIdx = s.indexOf(' | ');
    if (pipeIdx === -1) {
        return { playerName: s, position: '', team: '' };
    }
    const team = s.slice(pipeIdx + 3).trim();
    const before = s.slice(0, pipeIdx).trim();
    const lastSpace = before.lastIndexOf(' ');
    const position = lastSpace === -1 ? before : before.slice(lastSpace + 1);
    const playerName = lastSpace === -1 ? '' : before.slice(0, lastSpace).trim();
    return { playerName, position, team };
}

function parseNum(val) {
    if (val === '' || val == null) return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
}

function parseLine(line) {
    let playerCell;
    let rest;
    if (line.startsWith('"')) {
        const endQuote = line.indexOf('"', 1);
        playerCell = line.slice(1, endQuote);
        rest = line.slice(endQuote + 2);
    } else {
        const firstComma = line.indexOf(',');
        playerCell = line.slice(0, firstComma);
        rest = line.slice(firstComma + 1);
    }
    const parts = rest.split(',');
    const nums = parts.map(parseNum);
    return { playerCell, nums };
}

async function run() {
    if (!process.env.MONGODB_CONNECT) {
        console.error('Missing MONGODB_CONNECT in .env');
        process.exit(1);
    }
    if (!fs.existsSync(CSV_PATH)) {
        console.error('CSV not found at:', CSV_PATH);
        console.error('Copy projections-NL.csv to server/data/ or pass path: node server/scripts/import-projections.js /path/to/projections-NL.csv');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_CONNECT, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');

    const raw = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0];
    if (!header || !header.includes('Player')) {
        console.error('Expected header with Player column');
        process.exit(1);
    }

    const toInsert = [];
    for (let i = 1; i < lines.length; i++) {
        const { playerCell, nums } = parseLine(lines[i]);
        const { playerName, position, team } = parsePlayerCell(playerCell);
        if (!playerName) continue;

        const [ab, r, h, single, double, triple, hr, rbi, bb, k, sb, cs, avg, obp, slg, fpts] = nums;
        toInsert.push({
            playerName,
            team,
            position,
            source: 'projection',
            ab,
            r,
            h,
            single,
            double,
            triple,
            hr,
            rbi,
            bb,
            k,
            sb,
            cs,
            avg,
            obp,
            slg,
            fpts
        });
    }

    await Player.deleteMany({ source: 'projection' });
    await Player.insertMany(toInsert);
    console.log('Imported', toInsert.length, 'players (source: projection)');
    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
