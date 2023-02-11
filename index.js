const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

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
        const teamsCollection = client.db("pluggedIn").collection("teams");
        const recordsCollection = client.db("pluggedIn").collection("records");
        const reviewsCollection = client.db("pluggedIn").collection("reviews");
        const tasksCollection = client.db("pluggedIn").collection("tasks");
        const roomsCollection = client.db("pluggedIn").collection("rooms");

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
        app.patch("/user/:email", async (req, res) => {
            const { email } = req.params;
            const query = { email: email };
            const result = await usersCollection.updateOne(query, { $set: req.body });
            if (result.matchedCount) {
                res.send({ message: "Successfully Updated" });
            }
        });

        // Get all user
        app.get("/users", async (req, res) => {
            const { role } = req.query;
            if (role) {
                const users = await usersCollection.find({ role: role }).toArray();
                res.send(users);
            } else {
                const users = await usersCollection.find({}).toArray();
                res.send(users);
            }
        });

        // Get The User By Email
        app.get("/user/:email", async (req, res) => {
            const { email } = req.params;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send(user);
        });

        // Insert a team
        app.post("/team", async (req, res) => {
            const team = req.body;
            const alreadyExist = await teamsCollection.find({ name: team.name }).toArray();
            const existTeams = alreadyExist.filter((existTeam) => existTeam.leader === team.leader);
            if (existTeams.length !== 0) {
                return res.send({
                    acknowledged: false,
                    message: "Your Team already Exist",
                });
            }
            const result = await teamsCollection.insertOne(team);
            res.send(result);
        });

        //  Update Team Data
        app.patch("/team/:email", async (req, res) => {
            const { email } = req.params;
            const query = { leader: email };
            const result = await teamsCollection.updateOne(query, { $set: req.body });
            res.send(result);
        });

        // Get Team
        app.get("/team/:email", async (req, res) => {
            const { email } = req.params;
            const team = await teamsCollection.findOne({ leader: email });
            res.send(team);
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

        app.put("/connect", async (req, res) => {
            const sender = req.body.sender;
            const receiver = req.body.receiver;
            const findSender = { email: sender.email };
            const findReceiver = { email: receiver.email };
            const option = { upsert: true };
            const updatePendingList = {
                $push: {
                    pendingList: receiver,
                },
            };
            const updateFriendRequestList = {
                $push: {
                    friendRequestList: sender,
                },
            };

            const sendingResult = await usersCollection.updateOne(findSender, updatePendingList, option);
            const receivingResult = await usersCollection.updateOne(findReceiver, updateFriendRequestList, option);

            res.send({ sendingResult, receivingResult });
        });
        app.put("/makeFriend", async (req, res) => {
            const sender = req.body.sender;
            const receiver = req.body.receiver;
            const findSender = { email: sender?.email };
            const findReceiver = { email: receiver?.email };
            const option = { upsert: true };
            const updatePendingRequestList = {
                $pull: {
                    pendingList: receiver,
                },
            };
            const updateFriendRequestList = {
                $pull: {
                    friendRequestList: sender,
                },
            };
            const updateSenderFriendList = {
                $push: {
                    friendList: {
                        email: receiver?.email,
                        room: `${receiver?.email}_${sender?.email}`,
                    },
                },
            };
            const updateReceiverFriendList = {
                $push: {
                    friendList: {
                        email: sender?.email,
                        room: `${receiver?.email}_${sender?.email}`,
                    },
                },
            };

            const sendingResult = await usersCollection.updateOne(findSender, updatePendingRequestList, option);
            const receivingResult = await usersCollection.updateOne(findReceiver, updateFriendRequestList, option);
            const senderFriendListResult = await usersCollection.updateOne(findSender, updateSenderFriendList, option);
            const receiverFriendListResult = await usersCollection.updateOne(findReceiver, updateReceiverFriendList, option);

            res.send({
                sendingResult,
                receivingResult,
                senderFriendListResult,
                receiverFriendListResult,
            });
        });

        app.put("/calcelConnect", async (req, res) => {
            const sender = req.body.sender;
            const receiver = req.body.receiver;
            const findSender = { email: sender.email };
            const findReceiver = { email: receiver.email };
            const option = { upsert: true };
            const updatePendingList = {
                $pull: {
                    pendingList: receiver,
                },
            };
            const updateFriendRequestList = {
                $pull: {
                    friendRequestList: sender,
                },
            };

            const sendingResult = await usersCollection.updateOne(findSender, updatePendingList, option);
            const receivingResult = await usersCollection.updateOne(findReceiver, updateFriendRequestList, option);

            res.send({ sendingResult, receivingResult });
        });

        app.put("/disconnect", async (req, res) => {
            const friend = req.body.friend;
            const user = req.body.user;
            const findUser = { email: user?.email };
            const findFriend = { email: friend?.email };
            const option = { upsert: true };
            const disconnectingFriendCoc = {
                $pull: {
                    friendList: friend,
                },
            };
            const disconnectingUserDoc = {
                $pull: {
                    friendList: user,
                },
            };
            const friendDisconnectingResult = await usersCollection.updateOne(findUser, disconnectingFriendCoc, option);
            const userDisconnectingResult = await usersCollection.updateOne(findFriend, disconnectingUserDoc, option);
            res.send({ friendDisconnectingResult, userDisconnectingResult });
        });

        app.get("/isPending", async (req, res) => {
            const userEmail = req.query.userEmail;
            const pendingUserEmail = req.query.pendingUserEmail;
            // const query = {pendingList: {$in[]}}
            const query = { email: userEmail };
            const user = await usersCollection.findOne(query);
            const isPending = user?.pendingList?.find((item) => item.email === pendingUserEmail);
            //   console.log(isPending);
            if (isPending) {
                res.send({ status: "pending" });
                console.log(isPending);
            } else {
                res.send({ status: "not_pending" });
            }
        });

        app.get("/isFriend", async (req, res) => {
            const userEmail = req.query.userEmail;
            const friendUserEmail = req.query.friendUserEmail;
            const query = { email: userEmail };
            const user = await usersCollection.findOne(query);
            const isFriend = user?.friendList?.find((item) => item.email === friendUserEmail);
            if (isFriend) {
                res.send({ status: "friend" });
            } else {
                res.send({ status: "not_friend" });
            }
        });

        app.get("/connectionrequests", async (req, res) => {
            const userEmail = req.query.email;
            const query = { email: userEmail };
            const user = await usersCollection.findOne(query);
            const connectionRequests = user?.friendRequestList;
            res.send(connectionRequests);
        });

        app.get("/friends", async (req, res) => {
            const email = req.query.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            const friens = user?.friendList;
            res.send(friens);
        });

        app.post("/makeRoom", async (req, res) => {
            const roomData = req.body;
            const result = await roomsCollection.insertOne(roomData);
            res.send(result);
        });

        app.delete("/deleteRoom", async (req, res) => {
            const roomName = req.query.roomName;
            const query = { roomName };
            const result = await roomsCollection.deleteOne(query);
            res.send(result);
        });

        app.put("/messageStore", async (req, res) => {
            const messageData = req.body;
            const findRoom = { roomName: messageData?.roomName };
            const option = { upsert: true };
            const roomDoc = {
                $push: {
                    messages: messageData,
                },
            };
            const result = await roomsCollection.updateOne(findRoom, roomDoc, option);
            res.send(result);
        });

        app.get("/getMessages", async (req, res) => {
            const roomName = req.query.roomName;
            const query = { roomName };
            const room = await roomsCollection.findOne(query);
            const messages = room?.messages;
            res.send(messages);
        });

        app.get("/getRooms", async (req, res) => {
            const query = {};
            const rooms = await roomsCollection.find(query).toArray();
            res.send(rooms);
        });
    } finally {
    }
}

run().catch((err) => {
    console.error(err);
});

io.on("connection", (socket) => {
    console.log("user connected with id:", socket.id);
    socket.on("join_room", (data) => {
        console.log(data);
        socket.join(data);
    });

    socket.on("typing", (data) => {
        console.log(data);
        socket.broadcast.emit("typing_res", data);
    });

    socket.on("send_message", (data) => {
        console.log(data);
        socket.to(data.roomName).emit("receive_message", data);
    });
});

server.listen(port, () => {
    console.log("PluggedIn server is running on port :", port);
});
