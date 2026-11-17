const express = require('express');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const app = express();
app.use(express.json());
app.set('json spaces', 2);

const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'book.db');

let db = null;

/**
 * Initializes the SQLite database connection and starts the Express server.
 * The server is started ONLY after the database connection succeeds.
 */
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

// Root endpoint: API Overview & Student Information
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to Lab 2: SQLite database and CRUD routes API',
    student: {
      name: 'Varshith Gone',
      registrationNumber: '252U1R9167',
      section: 'S 26 Gen Ai 2C',
      course: 'Backend Development Fundamentals · Year II Term II · Aurora'
    },
    endpoints: [
      { method: 'GET', path: '/books/', description: 'Retrieve all books' },
      { method: 'GET', path: '/books/:bookId/', description: 'Retrieve a single book by ID' },
      { method: 'POST', path: '/books/', description: 'Add a new book to the database' },
      { method: 'PUT', path: '/books/:bookId/', description: 'Update an existing book by ID' },
      { method: 'DELETE', path: '/books/:bookId/', description: 'Delete a book by ID' }
    ]
  });
});

/**
 * Route 1: GET /books/
 * Retrieves all books from the database.
 */
app.get('/books/', async (req, res) => {
  try {
    const getBooksQuery = `
      SELECT
        id,
        title,
        author,
        price,
        pages
      FROM
        book
      ORDER BY
        id ASC;
    `;
    const booksArray = await db.all(getBooksQuery);
    res.status(200).json(booksArray);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Route 2: GET /books/:bookId/
 * Retrieves a single book by its ID using parameterized query with ? placeholder.
 */
app.get('/books/:bookId/', async (req, res) => {
  try {
    const { bookId } = req.params;
    const getBookQuery = `
      SELECT
        id,
        title,
        author,
        price,
        pages
      FROM
        book
      WHERE
        id = ?;
    `;
    const book = await db.get(getBookQuery, [bookId]);

    if (!book) {
      return res.status(404).json({ error: `Book with id ${bookId} not found` });
    }

    res.status(200).json(book);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Route 3: POST /books/
 * Inserts a new book into the database using parameterized queries with ? placeholders.
 */
app.post('/books/', async (req, res) => {
  try {
    const { title, author, price, pages } = req.body;

    if (!title || !author || price === undefined || pages === undefined) {
      return res.status(400).json({
        error: 'title, author, price, and pages are required fields'
      });
    }

    const addBookQuery = `
      INSERT INTO
        book (title, author, price, pages)
      VALUES
        (?, ?, ?, ?);
    `;

    const dbResponse = await db.run(addBookQuery, [title, author, Number(price), Number(pages)]);
    const bookId = dbResponse.lastID;

    res.status(201).json({
      message: 'Book Added Successfully',
      bookId: bookId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Route 4: PUT /books/:bookId/
 * Updates an existing book by its ID using parameterized query with ? placeholders.
 */
app.put('/books/:bookId/', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { title, author, price, pages } = req.body;

    if (!title || !author || price === undefined || pages === undefined) {
      return res.status(400).json({
        error: 'title, author, price, and pages are required fields'
      });
    }

    const checkBookQuery = `SELECT * FROM book WHERE id = ?;`;
    const existingBook = await db.get(checkBookQuery, [bookId]);

    if (!existingBook) {
      return res.status(404).json({ error: `Book with id ${bookId} not found` });
    }

    const updateBookQuery = `
      UPDATE
        book
      SET
        title = ?,
        author = ?,
        price = ?,
        pages = ?
      WHERE
        id = ?;
    `;

    await db.run(updateBookQuery, [title, author, Number(price), Number(pages), bookId]);

    res.status(200).json({
      message: 'Book Updated Successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Route 5: DELETE /books/:bookId/
 * Removes a book by its ID using parameterized query with ? placeholder.
 */
app.delete('/books/:bookId/', async (req, res) => {
  try {
    const { bookId } = req.params;

    const checkBookQuery = `SELECT * FROM book WHERE id = ?;`;
    const existingBook = await db.get(checkBookQuery, [bookId]);

    if (!existingBook) {
      return res.status(404).json({ error: `Book with id ${bookId} not found` });
    }

    const deleteBookQuery = `
      DELETE FROM
        book
      WHERE
        id = ?;
    `;

    await db.run(deleteBookQuery, [bookId]);

    res.status(200).json({
      message: 'Book Deleted Successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Browser Verification Helpers
app.get('/test/post-add-book', async (req, res) => {
  try {
    const addBookQuery = `
      INSERT INTO book (title, author, price, pages)
      VALUES (?, ?, ?, ?);
    `;
    const dbResponse = await db.run(addBookQuery, ['Refactoring', 'Martin Fowler', 750, 448]);
    res.status(201).json({
      message: 'Book Added Successfully',
      bookId: dbResponse.lastID
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/test/put-update-book', async (req, res) => {
  try {
    const updateBookQuery = `
      UPDATE book
      SET title = ?, author = ?, price = ?, pages = ?
      WHERE id = 11;
    `;
    await db.run(updateBookQuery, ['Refactoring (2nd Edition)', 'Martin Fowler', 799, 450]);
    res.status(200).json({
      message: 'Book Updated Successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/test/delete-book', async (req, res) => {
  try {
    const deleteBookQuery = `DELETE FROM book WHERE id = 11;`;
    await db.run(deleteBookQuery);
    res.status(200).json({
      message: 'Book Deleted Successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 404 Handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start DB & server
initializeDBAndServer();

module.exports = app;

