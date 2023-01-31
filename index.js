const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Hello from PluggedIn Server");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@pluggedin.lv6yqjw.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized Access" });
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.ACC_Token, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "Forbidden Access" });
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        const usersCollection = client.db("pluggedIn").collection("users");
        const recordsCollection = client.db("pluggedIn").collection("records");
        const reviewsCollection = client.db("pluggedIn").collection("reviews");
        const tasksCollection = client.db("pluggedIn").collection("tasks");

        // Verify Admin
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            if (user?.role !== "admin") {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            next();
        };

        app.post("/user", async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const token = jwt.sign(user, process.env.ACC_Token, {
                expiresIn: "2d",
            });
            const alreadyInserted = await usersCollection.findOne(filter);
            if (alreadyInserted) {
                return res.send({ result: { message: "User Already Exists" }, token });
            }
            const result = await usersCollection.insertOne(user);
            res.send({ result, token });
        });

        // Update User
        app.patch("/user/:email", verifyJWT, async (req, res) => {
            const { email } = req.params;
            const query = { email: email };
            const result = await usersCollection.updateOne(query, { $set: req.body });
            if (result.matchedCount) {
                res.send({ message: "Successfully Updated" });
            }
        });

        // Get The User By Email
        app.get("/user/:email", verifyJWT, async (req, res) => {
            const { email } = req.params;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send(user);
        });

        app.post("/userRecords", async (req, res) => {
            const media = req.body;
            const query = { mediaUrl: media.mediaUrl };
            const alreadyInserted = await recordsCollection.findOne(query);
            if (alreadyInserted) {
                return res.send({ message: "mediaExist" });
            }
            const result = await recordsCollection.insertOne(media);
            res.send(result);
        });

        app.get("/userMedia", async (req, res) => {
            const email = req.query.email;
            const query = { authorEmail: email };
            const medias = await recordsCollection.find(query).toArray();
            res.send(medias);
        });

        app.get("/media/:id", async (req, res) => {
            const { id } = req.params;
            const query = { _id: ObjectId(id) };
            const media = await recordsCollection.findOne(query);
            res.send(media);
        });

        app.delete("/record/:id", async (req, res) => {
            const recordId = req.params.id;
            const query = { _id: ObjectId(recordId) };
            const result = await recordsCollection.deleteOne(query);
            res.send(result);
        });

        app.put("/record", async (req, res) => {
            const editionsMedia = req.body;
            const option = { upsert: true };
            const filter = { _id: ObjectId(editionsMedia._id) };
            const updatedDoc = {
                $set: {
                    title: editionsMedia.title,
                },
            };
            const result = await recordsCollection.updateOne(filter, updatedDoc, option);

            res.send(result);
        });

        // Post & Get Reviews
        app.post("/reviews", async (req, res) => {
            const review = req.body;
            const result = await reviewsCollection.insertOne(review);
            res.send(result);
        });

        app.get("/reviews", async (req, res) => {
            const reviews = await reviewsCollection.find({}).toArray();
            res.send(reviews);
        });

        // Post, Put, Get, Delete Tasks
        app.put("/task/:id", async (req, res) => {
            const { id } = req.params;
            const task = req.body;
            const option = { upsert: true };
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    done: task.done,
                },
            };
            const result = await tasksCollection.updateOne(filter, updatedDoc, option);
            res.send(result);
        });

        app.post("/task", async (req, res) => {
            const task = req.body;
            const result = await tasksCollection.insertOne(task);
            res.send(result);
        });

        app.get("/tasks/:id", async (req, res) => {
            const { id } = req.params;
            const tasks = await tasksCollection.find({ media_id: id }).toArray();
            res.send(tasks);
        });

        app.delete("/task/:id", async (req, res) => {
            const { id } = req.params;
            const query = { _id: ObjectId(id) };
            const result = await tasksCollection.deleteOne(query);
            res.send(result);
        });
    } finally {
    }
}

run().catch((err) => {
    console.error(err);
});

app.listen(port, () => {
    console.log("PluggedIn server is running on port :", port);
});
