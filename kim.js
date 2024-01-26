const express = require("express");
const cors = require("cors");
const morgan = require('morgan');
const path = require("path");

let propertiesReader = require("properties-reader");
let propertiesPath = path.resolve(__dirname, "conf/db.properties");
let properties = propertiesReader(propertiesPath);


let dbPprefix = properties.get("db.prefix");
//URL-Encoding of User and PWD
//for potential special characters
let dbUsername = encodeURIComponent(properties.get("db.user"));
let dbPwd = encodeURIComponent(properties.get("db.pwd"));
let dbName = properties.get("db.dbName");
let dbUrl = properties.get("db.dbUrl");
let dbParams = properties.get("db.params");
const uri = dbPprefix + dbUsername + ":" + dbPwd + dbUrl + dbParams;


const { MongoClient, ServerApiVersion , ObjectId } = require('mongodb');
// const uri = "mongodb+srv://kimnoronha2001:<password>@cluster0.x1uat2z.mongodb.net/?retryWrites=true&w=majority";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: ServerApiVersion.v1
});


client.connect()
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch(err => {
        console.error('Error connecting to MongoDB:', err);
    });



// let db;

// const { MongoClient, ServerApiVersion } = require('mongodb');
// // const uri = "mongodb+srv://kimnoronha2001:<password>@cluster0.x1uat2z.mongodb.net/?retryWrites=true&w=majority";

// const client = new MongoClient(uri, {
//     serverApi: {
//       version: ServerApiVersion.v1,
//       strict: true,
//       deprecationErrors: true,
//     }
//   });

// async function run() {
//   try {
//     // Connect the client to the server  (optional starting in v4.7)
//     await client.connect();
//     // Send a ping to confirm a successful connection
//     await client.db(dbName).command({ ping: 1 });
//     console.log("Pinged your deployment. You successfully connected to MongoDB!");
//   }
//   finally {
//     // Ensures that the client will close when you finish/error
//     await client.close();
//   }
// }
// run().catch(console.dir);






let db = client.db(dbName);

let app = express();
app.set('json spaces', 3);

app.use(cors());

app.use(morgan("short"));

app.use(express.json());


app.param('collectionName', function (req, res, next, collectionName) {
    req.collection = db.collection(collectionName);
    return next();
});



app.get("/", function (req, res, next) {
    res.send("Select a collection");
});

app.get("/collections/:collectionName", function(req,res, next){
    req.collection.find({}).toArray(function(err, results){
        if(err){
            return next(err);
        }
        res.send(results);

    });
    // res.send("The service has been called");
    // res.json({result: "Ok"});

});


// app.get('/collections/:collectionName'
// , function(req, res, next) {
//  req.collection.find({}, {limit: 3, sort: [["price", -1]]}).toArray(function(err, results) {
//  if (err) {
//  return next(err);
//  }
//  res.send(results);
//  });
// });


app.get('/collections/:collectionName/:max/:sortAspect/:sortAscDesc'
    , function (req, res, next) {
        // TODO: Validate params
        var max = parseInt(req.params.max, 10); // base 10
        let sortDirection = 1;
        if (req.params.sortAscDesc === "desc") {
            sortDirection = -1;
        }
        req.collection.find({}, {
            limit: max, sort: [[req.params.sortAspect,
                sortDirection]]
        }).toArray(function (err, results) {
            if (err) {
                return next(err);
            }
            res.send(results);
        });
    });

app.get('/collections/:collectionName/:id', function (req, res, next) {
        req.collection.findOne({ _id: new ObjectId(req.params.id) }, function (err, results) {
            if (err) {
                return next(err);
            }
            res.send(results);
        });
    });

app.post('/collections/:collectionName'
    , function (req, res, next) {
        // TODO: Validate req.body
        req.collection.insertOne(req.body, function (err, results) {
            if (err) {
                return next(err);
            }
            res.send(results);
        });
    });


app.delete('/collections/:collectionName/:id'
    , function (req, res, next) {
        req.collection.deleteOne(
            { _id: new ObjectId(req.params.id) }, function (err, result) {
                if (err) {
                    return next(err);
                } else {
                    res.send((result.deletedCount === 1) ? { msg: "success" } : { msg: "error" });
                }
            }
        );
    });

app.put('/collections/:collectionName/:id'
    , function (req, res, next) {
        // TODO: Validate req.body
        req.collection.updateOne({ _id: new ObjectId(req.params.id) },
            { $set: req.body },
            { safe: true, multi: false }, function (err, result) {
                if (err) {
                    return next(err);
                } else {
                    res.send((result.matchedCount === 1) ? { msg: "success" } : { msg: "error" });
                }
            }
        );
    });

app.use(function (req, res) {
    res.status(404).send("Resource not found");
})

// app.listen(5502, function () {
//     console.log("App started on port 5502");
// });

const port = process.env.PORT || 5502;
app.listen(port, function(){
    console.log("App started on port " + port);
})
