const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const dbPath = path.join(__dirname, 'database.db');

const initialBooks = [
  { id: 1, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', price: 399, pages: 180 },
  { id: 2, title: 'To Kill a Mockingbird', author: 'Harper Lee', price: 450, pages: 281 },
  { id: 3, title: '1984', author: 'George Orwell', price: 299, pages: 328 },
  { id: 4, title: 'The Hobbit', author: 'J.R.R. Tolkien', price: 499, pages: 310 },
  { id: 5, title: 'Pride and Prejudice', author: 'Jane Austen', price: 250, pages: 279 },
  { id: 6, title: 'The Catcher in the Rye', author: 'J.D. Salinger', price: 350, pages: 214 },
  { id: 7, title: 'The Alchemist', author: 'Paulo Coelho', price: 299, pages: 208 },
  { id: 8, title: "Harry Potter and the Sorcerer's Stone", author: 'J.K. Rowling', price: 599, pages: 309 },
  { id: 9, title: 'Clean Code', author: 'Robert C. Martin', price: 899, pages: 464 },
  { id: 10, title: 'Atomic Habits', author: 'James Clear', price: 550, pages: 320 },
  { id: 11, title: 'Clean Architecture', author: 'Robert C. Martin', price: 950, pages: 432 },
  { id: 12, title: 'Deep Work', author: 'Cal Newport', price: 420, pages: 304 }
];

async function initializeDatabase() {
  try {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    console.log('Connected to SQLite database at:', dbPath);

    await db.exec(`
      DROP TABLE IF EXISTS book;
      CREATE TABLE book (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        price INTEGER NOT NULL,
        pages INTEGER NOT NULL
      );
    `);

    console.log('Created table "book".');

    const insertQuery = `
      INSERT INTO book (id, title, author, price, pages)
      VALUES (?, ?, ?, ?, ?);
    `;

    for (const b of initialBooks) {
      await db.run(insertQuery, [b.id, b.title, b.author, b.price, b.pages]);
    }

    console.log(`Successfully inserted ${initialBooks.length} initial books into "book" table.`);

    const rows = await db.all('SELECT * FROM book;');
    console.table(rows);

    await db.close();
    console.log('Database initialized successfully and closed.');
  } catch (error) {
    console.error('Error initializing database:', error.message);
    process.exit(1);
  }
}

initializeDatabase();
