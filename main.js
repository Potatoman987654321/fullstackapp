require("dotenv").config();
const { error } = require("console");
const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3001;

mongoose.connect(process.env.DB_URI);

const db = mongoose.connection;
db.on("error", (error) => console.error(error));
db.once("open", () => console.log("Connected to DB"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: "my secret key",
    resave: false,
    saveUninitialized: false,
  })
);

app.use((req, res, next) => {
  res.locals.message = req.session.message;
  delete req.session.message;
  next();
});

app.set("view engine", "ejs");

app.use("", require("./routes/routes"));

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
