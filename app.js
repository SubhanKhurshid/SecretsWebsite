require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: "Subhan is my name hello.",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose
  .connect("mongodb://127.0.0.1:27017/userDB", { useNewUrlParser: true })
  .then(() => {
    console.log("Connected To DataBase");
  });

// mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      // userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

app.get("/", (req, res) => {
  res.render("home");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/secrets");
  }
);

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/submit", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.get("/secrets", async (req, res) => {
  try {
    const userHello = await User.find({ secret: { $ne: null } });
    if (userHello) {
      res.render("secrets", { usersWithSecrets: userHello });
    }
  } catch (e) {
    console.log(e);
  }
});

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
  });
  res.redirect("/");
});

app.post("/submit", async (req, res) => {
  const submit1 = req.body.secret;
  const userFound = await User.findOneAndUpdate(
    { _id: req.user.id },
    { secret: submit1 }
  );
  userFound.save();

  console.log(userFound);
  res.redirect("/secrets");
});

app.post("/register", async (req, res) => {
  // bcrypt.hash(req.body.password, saltRounds, async function (err, hash) {
  //   const user = await User.create({
  //     email: req.body.username,
  //     password: hash,
  //   });
  //   user
  //     .save()
  //     .then(() => {
  //       res.render("secrets");
  //     })
  //     .catch((e) => {
  //       console.log(e);
  //     });
  // });
  User.register(
    { username: req.body.username },
    req.body.password,
    (err, user) => {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, () => {
          res.redirect("/secrets");
        });
      }
    }
  );
});

app.post("/login", async (req, res) => {
  // try {
  //   const userName = req.body.username;
  //   const password = req.body.password;
  //   const newValue = await User.findOne({ email: userName });
  //   if (!newValue) {
  //     console.log("Error ! ");
  //   } else {
  //     bcrypt.compare(password, newValue.password, function (err, result) {
  //       if (result === true) {
  //         res.render("secrets");
  //       }
  //     });
  //   }
  // } catch (e) {
  //   console.log(e);
  // }

  try {
    const user = await User.create({
      username: req.body.username,
      password: req.body.password,
    });
    req.login(user, (err) => {
      if (err) {
        console.log(err);
      } else {
        passport.authenticate("local")(req, res, () => {
          res.redirect("/secrets");
        });
      }
    });
  } catch (e) {
    console.log(e);
  }
});

app.listen(3000, () => {
  console.log("Server started at port 3000.");
});
