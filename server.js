if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
  }

const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const multer = require('multer');
const path = require('path');
const { PrismaClient } = require("@prisma/client");
const { render } = require("ejs");

const prisma = new PrismaClient();
const app = express();
const port = 3000;

const storage = multer.diskStorage({
    destination: 'public/uploads/', // Change the destination path
    filename: (req, file, cb) => {
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    },
  });
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Added to parse form data
app.use(express.static('public'));

app.use(
    session({
      secret: process.env.SECRET_KEY,
      resave: false,
      saveUninitialized: false,
    })
  );

const requireAuth = (req, res, next) => {
    if (req.session.userId) {
      next(); // User is authenticated, let him in
    } else {
      res.redirect("/login"); // User is not authenticated, redirect to login page
    }
  };
  
  app.get("/", requireAuth, async (req, res) => {
      const posts = await prisma.post.findMany();
  
      const user = await prisma.user.findUnique({
          where: {
              id: req.session.userId,
          }, select: {
              role: true
          }
      });
      res.render("index", { posts,user});
  
  });
  app.get("/signup", (req, res) => {
      errors = [];
      res.render("signup", { errors });
  });
  

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', './views');

// Render register page
app.get('/register', (req, res) => {
    res.render('register');
});

// Render login page
app.get('/login', (req, res) => {
    res.render('login');
});

// Handle registration form submission
app.post('/register', async (req, res) => {
    const { username, password, role } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    try {
        await prisma.user.create({
            data: { username, password:hash, role },
        });

        res.status(201).send('Registration successful!');
    } catch (error) {
        console.error(error);
        res.status(500).send('Registration failed.');
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { username },
        });

        if (user && user.password === bcrypt.hashSync(password, user.password)) {
            req.session.userId = user.id;
            res.redirect("/");
        }

    } catch (error) {
        console.error(error);
        res.status(500).send('Login failed.');
    }
}
);

app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
        console.error("Error destroying session:", err);
        res.redirect("/");
        } else {
        res.redirect("/login"); // Redirect to login or any desired page after logout
        }
    });
});

app.get('/', requireAuth, (req, res) => {
    res.render('index');
});

app.get('/index', requireAuth, (req, res) => {
    res.render('index');
});


app.get('/create', requireAuth, (req, res) => {
    res.render('create');
});

app.post('/create', requireAuth, upload.single('image'), async (req, res) => {
    const { title, description } = req.body;
    const image = req.file ? req.file.filename : null; // Assuming you're using multer for file uploads
  
    try {
      const post = await prisma.post.create({
        data: {
          title,
          description,
          image,
          userId: req.session.userId,
        },
      });
  
      res.redirect("/");
    } catch (error) {
      console.error(error);
      res.status(500).send('Post creation failed.');
    }
  });

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
