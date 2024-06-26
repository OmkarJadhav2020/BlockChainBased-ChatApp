import express from "express";
import mongoose from "mongoose";
import bodyParser, { urlencoded } from "body-parser";

const aleph = require("aleph-js");

const expressSession = require("express-session")({
  secret: "insert secret here", 
  resave: false,
  saveUninitialized: false,
});

import passport from "passport";
import passportLocalMongoose from "passport-local-mongoose";
import connectEnsureLogin from "connect-ensure-login";

const app = express();
const port = 4000;

app.use(express.static(__dirname));
app.use(bodyParser.json());
app.use(urlencoded({ extended: true }));
app.use(expressSession);
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine','ejs');
mongoose.connect("mongodb://localhost/AlephChat", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  private_key: String,
  public_key: String,
  mnemonics: String,
  address: String,
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userSchema);
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());



app.get("/", connectEnsureLogin.ensureLoggedIn(), (req, res) => {
  var room = 'hall30';
  var api_server = 'https://api2.aleph.im';
  var network_id = 261;
  var user_name = req['user']['username']
  var channel = 'TEST';
  aleph.posts.get_posts('chat',{'refs' : [room],'api_server' : api_server}).then((result)=>{
    res.render('index',{posts : result.posts.reverse(),user : req.user,room : room,userName : user_name});
  })
});

app.get("/rooms/:room", connectEnsureLogin.ensureLoggedIn(), (req, res) => {
  var room = req.params.room;
  var api_server = 'https://api2.aleph.im';
  var network_id = 261;
  var channel = 'TEST';
  var user_name = req['user']['username']
  aleph.posts.get_posts('chat',{'refs' : [room],'api_server' : api_server}).then((result)=>{
    res.render('index',{posts : result.posts.reverse(),user : req.user,room : room,userName : user_name});
  })
});

app.get("/login", (req, res) => {
  res.sendFile("views/login.html", { root: __dirname });
});

app.post("/login", passport.authenticate("local"), (req, res) => {
  res.redirect("/");
});

app.get("/register", (req, res) => {
  res.sendFile("views/register.html", { root: __dirname });
});
app.get("/services", (req, res) => {
  res.sendFile("views/services.html", { root: __dirname });
});
app.get("/about", (req, res) => {
  res.sendFile("views/about.html", { root: __dirname });
});

app.post("/register", (req, res) => {
  User.register(
    { username: req.body.username, active: false },
    req.body.password,
    (err, user) => {
      aleph.ethereum.new_account().then((eth_acc) => {
        user.private_key = eth_acc.private_key;
        user.public_key = eth_acc.public_key;
        user.mnemonics = eth_acc.mnemonics;
        user.address = eth_acc.address;
        user.save();
        passport.authenticate("local")(req, res, () => {
          res.redirect("/");
        });
      });
    }
  );
});

app.get(
  "/users/:username",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    try {
      const user = await User.findOne({ username: req.params.username });
      if (user) {
        res.send({user : user});
      } else {
        res.send(`Username ${req.params.username} does not exist.`);
      }
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }
  }
);

app.post('/messages/:room', connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  try {
      const msg = req.body.message;
      const room = req.params.room;

      // Import account asynchronously
      const account = await aleph.ethereum.import_account({ mnemonics: req.user.mnemonics });

      const api_server = 'https://api2.aleph.im';
      const network_id = 261;
      const channel = 'TEST';

      // Submit message asynchronously
      await aleph.posts.submit(account.address, 'chat', { 'body': msg }, {
          ref: room,
          api_server: api_server,
          account: account,
          channel: channel,
      });

      // Send response indicating success
      res.status(200).json({ success: true, message: 'Message submitted successfully.' });
  } catch (error) {
      // Handle errors
      console.error('Error submitting message:', error);
      res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
