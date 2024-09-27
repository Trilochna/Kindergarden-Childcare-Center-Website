// const express = require('express');
// const mysql = require('mysql2');
// const bodyParser = require('body-parser');
// const cors = require('cors');
// const session = require('express-session');
// const bcrypt = require('bcrypt');
// const path = require('path');

// const app = express();
// const port = 3000;

// // Middleware setup
// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(bodyParser.json());
// app.use(cors());
// app.use(express.static(path.join(__dirname, 'public')));

// app.use(session({
//     secret: 'secretkey',
//     resave: false,
//     saveUninitialized: true
// }));

// // Create a MySQL connection pool
// const pool = mysql.createPool({
//     host: 'localhost',
//     user: 'root',
//     password: 'Tech_123',
//     database: 'techdb',
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0
// });

// // Root route
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'teacher_dashboard.html'));
// });

const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const MySQLStore = require('express-mysql-session')(session); // Use MySQL session store for production
require('dotenv').config(); // Load environment variables

const app = express();
const port = process.env.PORT || 3000;

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

// Serve static files (make sure the 'public' folder contains your frontend build files)
// app.use(express.static(path.join(__dirname, 'public')));

// Session setup using MySQL session store for production
const sessionStore = new MySQLStore({
    host: process.env.DB_HOST,
    port: 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

app.use(session({
    key: 'user_sid',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// Create MySQL connection pool using environment variables
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Root route (Optional, as frontend is on Netlify)
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'teacher_dashboard.html'));
// });

// API Endpoint to handle form submissions
app.post('/api/signup', (req, res) => {
    const {
        first_name,
        last_name,
        date_of_birth,
        age,
        batch,
        address,
        username,
        password,
        email,
        role
    } = req.body;

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.status(500).send('Error creating account');
        }

        const query = `
            INSERT INTO test (
                first_name, last_name, date_of_birth, age, batch, address, username, password, email, role
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;

        pool.query(query, [
            first_name,
            last_name,
            date_of_birth,
            age,
            batch,
            address,
            username,
            hashedPassword,
            email,
            role
        ], (err, results) => {
            if (err) {
                console.error('Error inserting data:', err);
                res.status(500).send('Error inserting data');
            } else {
                res.send('Data inserted successfully');
            }
        });
    });
});

// Login routes
const loginUser = (role) => {
    return (req, res) => {
        const { username, password } = req.body;
        const query = 'SELECT * FROM test WHERE username = ? AND role = ?';

        pool.query(query, [username, role], (err, results) => {
            if (err) {
                console.error(err);
                res.status(500).send('Server error');
                return;
            }

            if (results.length > 0) {
                const user = results[0];
                bcrypt.compare(password, user.password, (err, isMatch) => {
                    if (err) {
                        console.error(err);
                        res.status(500).send('Server error');
                        return;
                    }

                    if (isMatch) {
                        req.session.user = user;
                        res.redirect(`/${role}_dashboard.html`);
                    } else {
                        res.status(401).send('Invalid credentials');
                    }
                });
            } else {
                res.status(401).send('User not found');
            }
        });
    };
};

app.post('/login/admin', loginUser('admin'));
app.post('/login/teacher', loginUser('teacher'));
app.post('/login/parent', loginUser('parent'));

// Redirects for dashboard
app.get('/admin-dashboard', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        res.send('Welcome to Admin Dashboard');
    } else {
        res.redirect('/index.html');
    }
});

app.get('/teacher-dashboard', (req, res) => {
    if (req.session.user && req.session.user.role === 'teacher') {
        res.send('Welcome to Teacher Dashboard');
    } else {
        res.redirect('/index.html');
    }
});

app.get('/parent-dashboard', (req, res) => {
    if (req.session.user && req.session.user.role === 'parent') {
        res.send('Welcome to Parent Dashboard');
    } else {
        res.redirect('/index.html');
    }
});

// Update all attendance route
app.post('/updateAllAttendance', (req, res) => {
    const updates = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ success: false, error: 'No data to update' });
    }

    const sql = 'UPDATE attendance SET present = ?, absent = ? WHERE studentid = ? AND attendance_date = ?';

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Database connection error:', err);
            return res.status(500).json({ success: false, error: 'Database error' });
        }

        connection.beginTransaction(err => {
            if (err) {
                connection.release();
                console.error('Transaction error:', err);
                return res.status(500).json({ success: false, error: 'Transaction error' });
            }

            const promises = updates.map(update => {
                return new Promise((resolve, reject) => {
                    connection.query(sql, [update.present, update.absent, update.id, update.date], (err, results) => {
                        if (err) {
                            return reject(err);
                        }
                        resolve(results);
                    });
                });
            });

            Promise.all(promises)
                .then(() => {
                    connection.commit(err => {
                        if (err) {
                            connection.rollback(() => {
                                connection.release();
                                console.error('Commit error:', err);
                                return res.status(500).json({ success: false, error: 'Commit error' });
                            });
                        }
                        connection.release();
                        res.json({ success: true });
                    });
                })
                .catch(err => {
                    connection.rollback(() => {
                        connection.release();
                        console.error('Rollback error:', err);
                        res.status(500).json({ success: false, error: 'Rollback error' });
                    });
                });
        });
    });
});

// API endpoint to get temperature data
app.get('/api/temperature', (req, res) => {
    pool.query('SELECT * FROM 2024001_山田 ORDER BY recorded_at DESC LIMIT 10', (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database query error' });
        }
        res.json(results);
    });
});

// API Endpoint to handle student enrollment
app.post('/api/studentenroll', (req, res) => {
    const {
        first_name,
        last_name,
        date_of_birth,
        age,
        batch,
        address,
        parents_phone_number,
        father_name,
        mother_name
    } = req.body;

    const query = `
        INSERT INTO student (
            first_name, last_name, date_of_birth, age, batch, address, parents_phone_number, father_name, mother_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    pool.query(query, [
        first_name,
        last_name,
        date_of_birth,
        age,
        batch,
        address,
        parents_phone_number,
        father_name,
        mother_name    
    ], (err, results) => {
        if (err) {
            console.error('Error inserting data:', err);
            res.status(500).send('Error inserting data');
        } else {
            res.send('Data inserted successfully');
        }
    });
});

// API Endpoint to update temperature and recorded_at
app.post('/api/updateTemperature', (req, res) => {
    const { studentid, temperature, recorded_at } = req.body;

    // Determine the table name based on studentid
    let tableName;
    switch (studentid) {
        case '2024001':
            tableName = '2024001_山田';
            break;
        case '2024002':
            tableName = '2024002_鈴木';
            break;
        // Add more cases as needed for other student IDs
        default:
            return res.status(400).send('Invalid student ID');
    }

    // SQL query with dynamic table name
    const query = `
        INSERT INTO \`${tableName}\` (id, temperature, recorded_at)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE temperature = VALUES(temperature), recorded_at = VALUES(recorded_at);
    `;

    pool.query(query, [studentid, temperature, recorded_at], (err, results) => {
        if (err) {
            console.error('Error updating data:', err);
            return res.status(500).send('Error updating data');
        }
        res.send('Data updated successfully');
    });
});








// Add this route to server.js
app.get('/api/events/:date', (req, res) => {
    const selectedDate = req.params.date; // e.g., '2024-09-22'

    const query = 'SELECT * FROM events WHERE date = ?';
    pool.query(query, [selectedDate], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ error: 'Database query error' });
        }
        res.json(results);
    });
});

























// Start the server

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
