const express = require('express');
const { MongoClient, ObjectId } = require('mongodb'); 
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE SETUP
// ============================================================

// Enable CORS so the front-end (GitHub Pages) can talk to this back-end
app.use(cors());

// Automatically parse incoming JSON data in requests
app.use(express.json());

// [Middleware A] Logger Middleware
// This is a custom middleware I added to track traffic. 
// It logs the Method (GET/POST) and URL for every request hitting the server.
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] Received ${req.method} request for ${req.url}`);
    next(); // Crucial: passes control to the next function so the request doesn't hang
});

// [Middleware B] Static File Middleware for Images
// This handles serving the lesson images directly from the backend folder
const imagesDirPath = path.join(__dirname, 'images');

app.use('/images', (req, res, next) => {
    // Clean the filename to prevent directory traversal issues
    const filename = path.basename(req.url);
    
    // Construct the full server path to the image
    const filePath = path.join(__dirname, 'images', filename);

    // Console log for debugging image paths
    console.log(`Looking for file at: ${filePath}`);

    // Check if the file actually exists before trying to send it
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (!err) {
            // Found it! Send the image file to the browser
            res.sendFile(filePath);
        } else {
            // Not found: Send a 404 error properly
            console.log("File not found!");
            res.status(404).json({ message: 'Error: Image not found' });
        }
    });
});


// ============================================================
// MONGODB CONNECTION
// ============================================================

const mongoUri ="mongodb+srv://teefourghost_db_user:VY4FrbPFk4t1Ay17@fullstack.yd6yne6.mongodb.net/?retryWrites=true&w=majority&appName=FullStack";
const client = new MongoClient(mongoUri);
let db; // This global variable will hold our active database connection

async function connectToDB() {
    try {
        await client.connect();
        db = client.db('Backend'); // Connects to the specific database named 'Backend'
        console.log('Successfully connected to MongoDB Atlas');
    } catch (err) {
        console.error('Failed to connect to MongoDB Atlas', err);
        process.exit(1); // Stop the server if we can't connect to the database
    }
}


// ============================================================
// REST API ROUTES
// ============================================================

// [Route A] GET /lessons
// This retrieves the full list of lessons to display on the frontend
app.get('/lessons', async (req, res) => {
    try {
        const lessons = await db.collection('lessons').find({}).toArray();
        res.json(lessons);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching lessons', error: err });
    }
});

// [Route B] POST /orders
// This receives the cart data and saves a new order document to MongoDB
app.post('/orders', async (req, res) => {
    try {
        const newOrder = req.body;
        const result = await db.collection('orders').insertOne(newOrder);
        res.status(201).json({ message: 'Order created successfully', insertedId: result.insertedId });
    } catch (err) {
        res.status(500).json({ message: 'Error saving order', error: err });
    }
});

// [Route C] PUT /lessons/:id
// This updates a specific lesson. I use this to decrease the 'spaces' count after a purchase.
app.put('/lessons/:id', async (req, res) => {
    try {
        const lessonId = req.params.id;
        const updateData = req.body; // e.g., { "spaces": 2 }

        const result = await db.collection('lessons').updateOne(
            { _id: new ObjectId(lessonId) }, // Find the lesson by its MongoDB ID
            { $set: updateData }           // Update only the fields sent in the body
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Lesson not found' });
        }
        
        res.json({ message: 'Lesson updated successfully' });
    } catch (err) {
        // Basic error handling for invalid IDs
        if (err.name === 'BSONError') {
            return res.status(400).json({ message: 'Invalid Lesson ID format' });
        }
        res.status(500).json({ message: 'Error updating lesson', error: err });
    }
});

// [Search Functionality] GET /search
// This implements the "Search as you type" feature on the backend.
// It uses MongoDB Regex to find partial matches in Subject or Location.
app.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ message: 'Search query (q) is required' });
        }

        // 'i' flag makes it case-insensitive (e.g., 'math' finds 'Mathematics')
        const regex = new RegExp(query, 'i');

        // Search across multiple fields using the $or operator
        const searchResults = await db.collection('lessons').find({
            $or: [
                { subject: { $regex: regex } },
                { location: { $regex: regex } }
            ]
        }).toArray();

        res.json(searchResults);

    } catch (err) {
        res.status(500).json({ message: 'Error during search', error: err });
    }
});


// ============================================================
// SERVER STARTUP
// ============================================================

// We wait for the DB connection before opening the server to traffic
connectToDB().then(() => {
    app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
});