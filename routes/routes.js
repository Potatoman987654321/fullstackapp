const express = require("express");
const router = express.Router();
const User = require("../models/users");
const multer = require("multer");
const upload = multer();

router.get("/webrtc.js", (req, res) => {
    res.sendFile(__dirname + "/client/webrtc.js");
});

router.get("/style.css", (req, res) => {
    res.sendFile(__dirname + "/client/style.css");
});

router.get("/rtc", async (req, res) => {
    try {
        let username = "Guest";
        if (req.session.userId) {
            const user = await User.findById(req.session.userId);
            if (user) {
                username = user.name;
            }
        }
        const users = await User.find();
        res.render("webcall", { users, username: username });
    } catch (err) {
        console.error(err);
        res.status(500).send("An error occurred.");
    }
});

router.get("/", async (req, res) => {
    try {
        let username = "Guest";
        if (req.session.userId) {
            const user = await User.findById(req.session.userId);
            if (user) {
                username = user.name;
            }
        }
        const users = await User.find();
        res.render("index", { users, username: username });
    } catch (err) {
        console.error(err);
        res.status(500).send("An error occurred while retrieving users");
    }
});

router.get("/add", async (req, res) => {
    try {
        let username = "Guest";
        if (req.session.userId) {
            const user = await User.findById(req.session.userId);
            if (user) {
                username = user.name;
            }
        }
        res.render("add_users", { username: username });
    } catch (err) {
        console.error(err);
        res.status(500).send("An error occurred while retrieving users");
    }
});

router.get("/login", async (req, res) => {
    try {
        let username = "Guest";
        if (req.session.userId) {
            const user = await User.findById(req.session.userId);
            if (user) {
                username = user.name;
            }
        }
        res.render("login_", { title: "Login", username: username });
    } catch (err) {
        console.error(err);
        res.status(500).send("An error occurred while retrieving users");
    }
});

router.post("/add", upload.none(), (req, res) => {
    console.log(req.body);

    const user = new User({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
    });

    user.save()
        .then(() => {
            console.log("User saved successfully");
            req.session.message = {
                type: "success",
                message: "User added successfully",
            };
            res.redirect("/");
        })
        .catch((error) => {
            console.error("Error saving user:", error);
            res.status(500).json({ message: err.message, type: "danger" });
        });
});

router.post("/login", upload.none(), async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (user && req.body.password === user.password) {
        req.session.userId = user._id;
        res.redirect("/");
        console.log("User logged in successfully");
    } else {
        res.redirect("/login");
        console.log("user found but password incorrect");
    }
});

router.get("/edit/:id", async (req, res) => {
    try {
        let username = "Guest";
        if (req.session.userId) {
            const user = await User.findById(req.session.userId);
            if (user) {
                username = user.name;
            }
        }
        const user = await User.findById(req.params.id);
        res.render("edit_users", { user, username: username });
    } catch (err) {
        console.error(err);
        res.status(500).send("An error occurred while retrieving users");
    }
});

router.get("/delete/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        await User.deleteOne({ _id: req.params.id });
        res.redirect("/");
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post("/update/:id", upload.none(), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        user.name = req.body.name;
        user.email = req.body.email;
        user.password = req.body.password;
        await user.save();
        res.redirect("/");
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
