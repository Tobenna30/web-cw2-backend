const express = require("express");
const cors = require("cors");
const path = require("path");
const propertiesReader = require("properties-reader");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb"); // Import MongoClient, ServerApiVersion, and ObjectId
const morgan = require('morgan');

const app = express();
app.set('json spaces', 3);

//  path to my properties file
const propertiesPath = path.resolve(__dirname, "conf/db.properties");
const properties = propertiesReader(propertiesPath);

// Retrieve properties from the file
const dbPprefix = properties.get("db.prefix");
const dbUsername = properties.get("db.user");
const dbPwd = properties.get("db.pwd");
const dbName = properties.get("db.dbName");
const dbUrl = properties.get("db.dbUrl");
const dbParams = properties.get("db.params");

// Construct the MongoDB connection string
const uri = dbPprefix + dbUsername + ":" + dbPwd + dbUrl + dbParams;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use(function (req, res, next) {
    console.log("Incoming request: " + req.url);
    next();
});

let client;

async function connectToMongo() {
    try {
        client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
        await client.connect();
        console.log("Connected to Database");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1); // Exit the application on connection error
    }
}

connectToMongo();

//  middleware to initialize the related collection
app.param('collectionName', (req, res, next, collectionName) => {
    req.collection = client.db(dbName).collection(collectionName);
    return next();
});

// GET and Read Collections
app.get('/', function (req, res, next) {
    res.send("Select a collection");
});

// GET route /lessons that returns all the lessons
app.get('/collections/:collectionName', async (req, res, next) => {
    try {
        const results = await req.collection.find({}).toArray();
        res.json(results);
    } catch (error) {
        console.error("Error fetching collections:", error);
        res.status(500).send("Error fetching collections from the database");
    }
});



app.get('/collections/:collectionName/:max/:sortAspect/:sortAscDesc', async (req, res, next) => {
    try {
        const max = parseInt(req.params.max, 10); // base 10
        let sortDirection = 1;
        if (req.params.sortAscDesc === "desc") {
            sortDirection = -1;
        }

        const results = await req.collection
            .find({})
            .limit(max)
            .sort({ [req.params.sortAspect]: sortDirection })
            .toArray();

        res.json(results);
    } catch (error) {
        console.error("Error fetching collections:", error);
        res.status(500).send("Error fetching collections from the database");
    }
});


// GET by ID
app.get('/collections/:collectionName/:id', async (req, res, next) => {
    try {
        const result = await req.collection.findOne({ _id: new ObjectId(req.params.id) });
        if (!result) {
            res.status(404).send("Document not found");
        } else {
            res.json(result);
        }
    } catch (error) {
        console.error("Error fetching document:", error);
        res.status(500).send("Error fetching document from the database");
    }
});

// GET route for search
app.get('/search', async (req, res) => {
    try {
        const searchTerm = req.query.term;
        const lessonsCollection = client.db(dbName).collection('lessons');

        // MongoDB text search
        const searchResult = await lessonsCollection.find({ 
            $text: { $search: searchTerm } 
        }).toArray();

        res.json(searchResult);
    } catch (error) {
        console.error("Error during search:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.post('/collections/:collectionName', async (req, res, next) => {
    try {
        // TODO: Validate req.body

        const result = await req.collection.insertOne(req.body);

        // Send the result as JSON response
        res.json(result);
    } catch (error) {
        // Pass any errors to the error-handling middleware
        next(error);
    }
});

// POST route that saves a new order to the “order” collection
app.post('/collections/:collectionName', async (req, res, next) => {
    try {
        // Check if the collectionName is 'orders'
        if (req.params.collectionName !== 'orders') {
            // If not 'orders', respond with an error 
            return res.status(400).send('Invalid collection name for this route');
        }

        // TODO: Validate req.body for orders
       
        if (!req.body.name || !req.body.phoneNumber || !Array.isArray(req.body.lessonIDs)) {
            return res.status(400).send('Missing or invalid order details');
        }

        const result = await req.collection.insertOne(req.body);

        // Send the result as JSON response
        res.json(result);
    } catch (error) {
        // Pass any errors to the error-handling middleware
        next(error);
    }
});


// PUT route to update lesson space
app.put('/collections/:collectionName/:id', async (req, res) => {
    try {
        const lessonsCollection = client.db(dbName).collection('lessons');
        const lessonId = new ObjectId(req.params.id);
        const updateResult = await lessonsCollection.updateOne(
            { _id: lessonId },
            { $inc: { spaces: -1 } }
        );

        if (updateResult.modifiedCount === 0) {
            res.status(404).send("Lesson not found or no space available");
        } else {
            res.status(200).json({ message: "Updated successfully" });
        }
    } catch (error) {
        console.error("Error updating lesson space:", error);
        res.status(500).send("Internal Server Error");
    }
});


// PUT and Update Documents
app.put('/collections/:collectionName/:id', async (req, res, next) => {
    try {
        const result = await req.collection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: req.body });
        if (result.modifiedCount === 0) {
            res.status(404).send("Document not found");
        } else {
            res.json({ message: "Document updated successfully" });
        }
    } catch (error) {
        console.error("Error updating document:", error);
        res.status(500).send("Error updating document in the database");
    }
});

// DELETE and Delete Documents
app.delete('/collections/:collectionName/:id', async (req, res, next) => {
    try {
        const result = await req.collection.deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) {
            res.status(404).send("Document not found");
        } else {
            res.json({ message: "Document deleted successfully" });
        }
    } catch (error) {
        console.error("Error deleting document:", error);
        res.status(500).send("Error deleting document from the database");
    }
});

// Define a route to serve lesson images using express.static middleware

app.use('/lesson-images', express.static(path.join(__dirname, 'lesson-images')));



// Define a route to handle image requests and return an error if the image does not exist
app.get('/lesson-images/:imageName', (req, res) => {
    const { imageName } = req.params;
    const imagePath = path.join(__dirname, 'lesson-images', imageName);
  
    // Check if the image file exists
    if (fs.existsSync(imagePath)) {
        // Serve the image if it exists
        res.sendFile(imagePath);
    } else {
        // Return an error message if the image does not exist
        res.status(404).send('Image not found');
    }
});

 
// 404 Not Found
app.use(function (req, res) {
    res.status(404).send("Resource not found!");
});






const port = process.env.PORT || 3000;
app.listen(port, function() {
   console.log("App started on port: " + port);
});

