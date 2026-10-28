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
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const dbPath = process.env.EMBEDDED_DB_PATH || path.resolve('.data/db');
    if (dbPath !== ':memory:') mkdirSync(dbPath, { recursive: true });
    embedded = await MongoMemoryServer.create({
      instance: dbPath === ':memory:' ? {} : { dbPath, storageEngine: 'wiredTiger' },
    });
    uri = embedded.getUri('spillway');
    console.log(`[db] embedded MongoDB at ${uri}${dbPath === ':memory:' ? ' (in memory)' : ` (files in ${dbPath})`}`);
  }
  await mongoose.connect(uri);
  return mongoose.connection;
}

export async function disconnect() {
  await mongoose.disconnect();
  if (embedded) await embedded.stop();
  embedded = null;
}
