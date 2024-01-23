const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();
const cors = require('cors');

const app = express();
const port = 8000;
app.use(cors());
const trainBot = require("./trainBot");
const getAnswerNew = require("./getAnswer");

app.use(bodyParser.json());
app.get("/train-bot", trainBot);
app.post("/get-answer", getAnswerNew);

app.listen(port, () =>
  console.log(`Example app listening at http://localhost:${port}`),
);