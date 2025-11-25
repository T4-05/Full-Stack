const express = require('express');
const { MongoClient, ObjectId } = require('mongodb'); // Import ObjectId
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// --- 1. Middleware ---


app.use(cors());

// Middleware to parse JSON request bodies
app.use(express.json());

// [Middleware A] Logger Middleware
// This logs every request to the console
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] Received ${req.method} request for ${req.url}`);
    next(); // Pass control to the next middleware/route handler
});

// [Middleware B] Static File Middleware for Images
// This middleware will check if the request is for an image in the 'images' folder
const imagesDirPath = path.join(__dirname, 'images');
// [Middleware B] Static File Middleware for Images
app.use('/images', (req, res, next) => {
    // Use 'path.basename' to strip any leading slashes or tricky paths
    // e.g. "/maths.jpg" becomes just "maths.jpg"
    const filename = path.basename(req.url);
    
    // Create the absolute path to the image file
    const filePath = path.join(__dirname, 'images', filename);

    // Debugging: Log the path to the terminal so we can see what's wrong
    console.log(`Looking for file at: ${filePath}`);

    // Check if the file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (!err) {
            // File exists, send it
            res.sendFile(filePath);
        } else {
            // File does not exist, send a 404 error
            console.log("File not found!");
            res.status(404).json({ message: 'Error: Image not found' });
        }
    });
});


// --- 2. MongoDB Connection ---

// !! IMPORTANT: Replace this with your actual MongoDB Atlas Connection String
const mongoUri ="mongodb+srv://teefourghost_db_user:VY4FrbPFk4t1Ay17@fullstack.yd6yne6.mongodb.net/?retryWrites=true&w=majority&appName=FullStack";
const client = new MongoClient(mongoUri);
let db; // Variable to hold the database connection

async function connectToDB() {
    try {
        await client.connect();
        db = client.db('Backend'); // Or whatever you named your database
        console.log('Successfully connected to MongoDB Atlas');
    } catch (err) {
        console.error('Failed to connect to MongoDB Atlas', err);
        process.exit(1); // Exit the process if connection fails
    }
}


// --- 3. REST API Routes ---

// [Route A] GET /lessons
// Returns all documents from the 'lessons' collection
app.get('/lessons', async (req, res) => {
    try {
        const lessons = await db.collection('lessons').find({}).toArray();
        res.json(lessons);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching lessons', error: err });
    }
});

// [Route B] POST /orders
// Saves a new order to the 'orders' collection
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
// Updates a lesson in the 'lessons' collection (e.g., updating spaces)
app.put('/lessons/:id', async (req, res) => {
    try {
        const lessonId = req.params.id;
        const updateData = req.body; // e.g., { "spaces": 2 }

        const result = await db.collection('lessons').updateOne(
            { _id: new ObjectId(lessonId) }, // Filter by _id
            { $set: updateData }           // Use $set to update specific fields
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Lesson not found' });
        }
        
        res.json({ message: 'Lesson updated successfully' });
    } catch (err) {
        // Handle potential invalid ObjectId format
        if (err.name === 'BSONError') {
            return res.status(400).json({ message: 'Invalid Lesson ID format' });
        }
        res.status(500).json({ message: 'Error updating lesson', error: err });
    }
});

// [Search Functionality] GET /search
// Implements the back-end search
app.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ message: 'Search query (q) is required' });
        }

        // Create a regex for case-insensitive search
        const regex = new RegExp(query, 'i');

        // Search across multiple fields using $or
        const searchResults = await db.collection('lessons').find({
            $or: [
                { subject: { $regex: regex } },
                { location: { $regex: regex } }
                // Note: Searching on numeric fields like price/spaces with a text regex is tricky
                // and often not desired. We'll stick to text fields.
            ]
        }).toArray();

        res.json(searchResults);

    } catch (err) {
        res.status(500).json({ message: 'Error during search', error: err });
    }
});


// --- 4. Start Server ---

// Connect to the database and then start the server
connectToDB().then(() => {
    app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
});