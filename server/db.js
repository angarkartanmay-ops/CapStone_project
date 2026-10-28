import mongoose from 'mongoose';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

let embedded = null;

/**
 * Connects to MONGODB_URI when it is set. Without it, starts a local MongoDB
 * (mongodb-memory-server) that keeps its files in ./.data so the demo works on a
 * fresh laptop with no database installed, and data survives restarts.
 */
export async function connect(uri = process.env.MONGODB_URI) {
  let options = {};
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const dbPath = process.env.EMBEDDED_DB_PATH || path.resolve('.data/db');
    const persistent = dbPath !== ':memory:';
    if (persistent) mkdirSync(dbPath, { recursive: true });
    embedded = await MongoMemoryServer.create({
      instance: persistent ? { dbPath, storageEngine: 'wiredTiger' } : {},
    });
    uri = embedded.getUri('spillway');
    // The embedded mongod is hard-killed on Windows when it stops, so only count a
    // write as done once it is in the journal.
    if (persistent) options = { writeConcern: { w: 1, j: true } };
    console.log(`[db] embedded MongoDB at ${uri}${persistent ? ` (files in ${dbPath})` : ' (in memory)'}`);
  }
  await mongoose.connect(uri, options);
  return mongoose.connection;
}

export async function disconnect() {
  if (embedded && mongoose.connection.readyState === 1) {
    await mongoose.connection.db.admin().command({ fsync: 1 }).catch(() => {});
  }
  await mongoose.disconnect();
  if (embedded) await embedded.stop();
  embedded = null;
}
