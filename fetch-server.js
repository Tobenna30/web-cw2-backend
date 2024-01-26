const express = require("express");
const cors = require("cors");
const path = require("path");
const propertiesReader = require("properties-reader");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb"); // Import MongoClient, ServerApiVersion, and ObjectId
const morgan = require('morgan');

const app = express();
app.set('json spaces', 3);

// Define the path to your properties file
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

// Define app.param() middleware to initialize the related collection
app.param('collectionName', (req, res, next, collectionName) => {
    req.collection = client.db(dbName).collection(collectionName);
    return next();
});

// GET and Read Collections
app.get('/', function (req, res, next) {
    res.send("Select a collection");
});

app.get('/collections/:collectionName', async (req, res, next) => {
    try {
        const results = await req.collection.find({}).toArray();
        res.json(results);
    } catch (error) {
        console.error("Error fetching collections:", error);
        res.status(500).send("Error fetching collections from the database");
    }
});

// app.get('/collections/:collectionName', async (req, res, next) => {
//     try {
//         const maxResults = 3;
//         const sortField = "price";
//         const sortOrder = -1; // -1 for descending, 1 for ascending

//         const results = await req.collection
//             .find({})
//             .limit(maxResults)
//             .sort({ [sortField]: sortOrder })
//             .toArray();

//         res.json(results);
//     } catch (error) {
//         console.error("Error fetching collections:", error);
//         res.status(500).send("Error fetching collections from the database");
//     }
// });


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

app.post('/collections/:collectionName', async (req, res, next) => {
    try {
        const result = await req.collection.insertOne(req.body);
        if (result && result.ops && result.ops.length > 0) {
            res.json(result.ops[0]);
        } else {
            res.status(500).send("Error creating document in the database: No document inserted");
        }
    } catch (error) {
        console.error("Error creating document:", error);
        res.status(500).send("Error creating document in the database: " + error.message);
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
 
// 404 Not Found
app.use(function (req, res) {
    res.status(404).send("Resource not found!");
});

const port = process.env.PORT || 3000;

app.listen(port, function () {
    console.log("App started on port " + port);
});