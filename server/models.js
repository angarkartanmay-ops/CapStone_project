import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { DEFAULT_WEIGHTS } from './game/bot.js';

const { Schema, model } = mongoose;

const userSchema = new Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  displayName: { type: String, required: true, trim: true },
  bio: { type: String, default: '', maxlength: 160 },
  favoriteSuit: { type: String, enum: ['ember', 'tide', 'moss', 'sol'], default: 'tide' },
  rating: { type: Number, default: 1200 },
  ratingHistory: { type: [Number], default: [1200] },
  stats: {
    played: { type: Number, default: 0 },
    won: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    longestSpill: { type: Number, default: 0 },
  },
}, { timestamps: true });

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    username: this.username,
    displayName: this.displayName,
    bio: this.bio,
    favoriteSuit: this.favoriteSuit,
    rating: this.rating,
    ratingHistory: this.ratingHistory.slice(-30),
    stats: this.stats,
    createdAt: this.createdAt,
  };
};

// Tables are the collection with full CRUD: players create, rename, re-rule and close them.
const tableSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 40 },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  seats: { type: Number, enum: [3, 4], default: 4 },
  turnSeconds: { type: Number, min: 10, max: 60, default: 25 },
  botFill: { type: Boolean, default: true },
  rules: {
    surgeStack: { type: Boolean, default: true },
    gift: { type: Boolean, default: true },
  },
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  code: { type: String, unique: true, default: () => randomBytes(3).toString('hex').toUpperCase() },
  status: { type: String, enum: ['open', 'playing'], default: 'open' },
  matchesPlayed: { type: Number, default: 0 },
}, { timestamps: true });

const matchSchema = new Schema({
  table: { type: Schema.Types.ObjectId, ref: 'Table' },
  tableName: String,
  players: [{
    _id: false,
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    name: String,
    isBot: Boolean,
    cardsLeft: Number,
    points: Number,
    ratingDelta: { type: Number, default: 0 },
  }],
  winnerName: String,
  winnerUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  turns: Number,
  longestSpill: Number,
  durationMs: Number,
}, { timestamps: true });
matchSchema.index({ 'players.user': 1, createdAt: -1 });

const brainSchema = new Schema({
  key: { type: String, default: 'main', unique: true },
  weights: { type: Schema.Types.Mixed, default: () => ({ ...DEFAULT_WEIGHTS }) },
  matchesTrained: { type: Number, default: 0 },
  botWins: { type: Number, default: 0 },
  history: { type: [Schema.Types.Mixed], default: [] }, // weight snapshots for the chart
}, { timestamps: true });

export const User = model('User', userSchema);
export const Table = model('Table', tableSchema);
export const Match = model('Match', matchSchema);
export const BotBrain = model('BotBrain', brainSchema);

export async function getBrain() {
  return BotBrain.findOneAndUpdate({ key: 'main' }, {}, { upsert: true, new: true, setDefaultsOnInsert: true });
}
