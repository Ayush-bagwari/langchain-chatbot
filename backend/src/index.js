const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();
const cors = require('cors');
const { Redis } = require("ioredis");
const { RedisChatMessageHistory } = require("@langchain/community/stores/message/ioredis");
const moment = require('moment');

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
const trainBot = require("./trainBot");
const getAnswerNew = require("./getAnswer");

const client = new Redis("redis://localhost:6379");

  client.on('connect', function() {
  console.log('Connected to Redis');
});
client.on('error', function (err) {
  console.log('Error connecting to Redis: ' + err);
});

console.log("inside index file")
app.use(bodyParser.json());
app.get("/train-bot", trainBot);
app.post("/get-answer", getAnswerNew);

app.listen(port, () =>
  console.log(`Example app listening at ${port}`),
);