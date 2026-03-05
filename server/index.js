// Node APIs
const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const cookieParser = require('cookie-parser')

// setup server
dotenv.config()
const PORT = process.env.PORT || 4000;
const app = express()

// setup middleware
// there shouldnt be uploads >10mb
app.use(express.urlencoded({ extended: true, limit: '10mb' })) 
app.use(cors({
    origin: ["http://localhost:3000"],
    credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

// setup routes as middleware
const authRouter = require('./routes/auth-router')
app.use('/auth', authRouter)

// init database
const db = require('./db');

(async () => {
    try {
        await db.init();  
        console.log("db initialized");

        app.listen(PORT, () => 
            console.log(`DraftIQ Server running on port ${PORT}`)
        );
    } catch (err) {
        console.error("Failed to initialize database:", err);
    }
})();

