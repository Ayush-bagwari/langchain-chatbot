const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
const trainBot = require("./trainBot");
const getAnswerNew = require("./getAnswer");

app.use(bodyParser.json());
app.get("/train-bot", trainBot);
app.post("/get-answer", getAnswerNew);
console.log("checking1");

app.listen(port, () =>
  console.log(`Example app listening at ${port}`),
);