const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from PluggedIn Server");
});

const uri = `mongodb+srv://pluggedindbuser:TrczA0CRtNVqXbzL@pluggedin.lv6yqjw.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
console.log(uri);

async function run() {
  try {
    const usersCollection = client.db("pluggedIn").collection("users");
    const recordsCollection = client.db("pluggedIn").collection("records");

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const alreadyInserted = await usersCollection.findOne(query);
      if (alreadyInserted) {
        return res.send({ message: "userExists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
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
  } finally {
  }
}

run().catch((err) => {
  console.error(err);
});

app.listen(port, () => {
  console.log("PluggedIn server is running on port :", port);
});
