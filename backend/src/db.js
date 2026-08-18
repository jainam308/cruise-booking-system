require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cruise_booking';

const connect = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected:', MONGO_URI);
};

module.exports = { connect };
