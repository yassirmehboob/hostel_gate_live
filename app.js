import 'dotenv/config';
import createError from 'http-errors';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import http from 'http';
import authMiddleware from "./middleware/authMiddleware.js";
import cors from "cors";

// Import routes
import loadStudentRouter from './routes/loadStudents.js';
import markAccessLogRouter from './routes/markAccess.js';
import getStudentRouter from './routes/getStudents.js';
import authRouter from './routes/auth.js';
import syncRouter from './routes/sync.js';
import idCardRouter from './routes/IDCard.js';
import reportRouter from './routes/reports.js'

import "./utils/sync.js"; 


// Enable __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();


// const corsOptions = {
//   origin: ["http://localhost:5173", "http://172.16.40.53:5173", "http://172.16.40.159:5173"],
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
//   credentials: true,
// };


// app.use(cors(corsOptions));
// app.options("*", cors(corsOptions));  // ✅ use SAME options

app.use(cors({ origin: true, credentials: true }));
app.options("*", cors({ origin: true, credentials: true }));


// ✅ Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json({limit:"300mb"}));
app.use(express.urlencoded({limit:"300mb", extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


const projectFolder = "hostel_access_system";

// Routes
app.use('/'+projectFolder+'/loadStudents',authMiddleware, loadStudentRouter);
app.use('/'+projectFolder+'/markLog',authMiddleware, markAccessLogRouter);
app.use('/'+projectFolder+'/student',authMiddleware, getStudentRouter);
app.use('/'+projectFolder+'/report',authMiddleware, reportRouter);
app.use('/'+projectFolder+'/auth', authRouter);
app.use('/'+projectFolder+'/sync',syncRouter);
app.use('/'+projectFolder+'/',authMiddleware,idCardRouter);

// Catch 404
app.use(function (req, res, next) {
  next(createError(404));
});

// Error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

export default app;
