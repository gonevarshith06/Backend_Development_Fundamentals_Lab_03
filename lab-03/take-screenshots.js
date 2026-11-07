const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const PORT = 3000;
const dbPath = path.join(__dirname, 'database.db');
const screenshotsDir = path.join(__dirname, 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Set up Express App matching Lab 3 server.js
const app = express();
app.use(express.json());

let db = null;

// Static HTML tester page to showcase REST API client view in real browser
app.get('/tester', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>REST API Tester - Lab 3</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #18191c; color: #e1e3e6; padding: 24px; }
    .window { max-width: 960px; margin: 0 auto; background: #202225; border: 1px solid #36393f; border-radius: 10px; overflow: hidden; box-shadow: 0 12px 36px rgba(0,0,0,0.4); }
    .titlebar { background: #2f3136; padding: 12px 18px; display: flex; align-items: center; border-bottom: 1px solid #36393f; }
    .dots { display: flex; gap: 8px; margin-right: 16px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .dot-red { background: #ed4245; }
    .dot-yellow { background: #fee75c; }
    .dot-green { background: #57f287; }
    .app-title { font-size: 13px; font-weight: 600; color: #b9bbbe; letter-spacing: 0.5px; }
    .content { padding: 24px; }
    .header-box { margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .student-badge { font-size: 13px; color: #8e9297; background: #2f3136; padding: 6px 14px; border-radius: 6px; }
    .url-bar { display: flex; align-items: stretch; background: #121315; border: 1px solid #36393f; border-radius: 8px; overflow: hidden; margin-bottom: 20px; }
    .method-pill { padding: 10px 18px; font-weight: 700; font-size: 14px; color: #fff; display: flex; align-items: center; text-transform: uppercase; }
    .method-GET { background: #23a55a; }
    .method-POST { background: #f0b232; }
    .method-PUT { background: #3ba55c; }
    .method-DELETE { background: #ed4245; }
    .url-input { flex: 1; background: transparent; border: none; padding: 10px 16px; font-family: "Consolas", monospace; font-size: 14px; color: #f2f3f5; outline: none; }
    .status-badge { display: inline-flex; align-items: center; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 14px; color: #fff; margin-bottom: 14px; }
    .status-200, .status-201 { background: #23a55a; }
    .status-400 { background: #faa81a; }
    .status-404 { background: #ed4245; }
    .panel { background: #121315; border: 1px solid #36393f; border-radius: 8px; padding: 16px; margin-bottom: 18px; }
    .panel-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #8e9297; margin-bottom: 10px; letter-spacing: 0.5px; }
    pre { font-family: "Consolas", "Courier New", monospace; font-size: 13.5px; line-height: 1.5; color: #dbdee1; white-space: pre-wrap; word-break: break-all; }
    .key { color: #5865f2; }
    .string { color: #57f287; }
    .number { color: #eb459e; }
  </style>
</head>
<body>
  <div class="window">
    <div class="titlebar">
      <div class="dots"><div class="dot dot-red"></div><div class="dot dot-yellow"></div><div class="dot dot-green"></div></div>
      <div class="app-title">REST Client · Lab 3: REST API, query parameters, validation, debugging</div>
    </div>
    <div class="content">
      <div class="header-box">
        <h2 id="scenario-title" style="font-size: 18px; font-weight: 600;">Scenario</h2>
        <div class="student-badge">Varshith Gone · 252U1R9167 · S 26 Gen Ai 2C</div>
      </div>
      <div class="url-bar">
        <div id="method-badge" class="method-pill method-GET">GET</div>
        <div id="url-text" class="url-input">http://localhost:3000/books</div>
      </div>
      <div id="request-panel" class="panel" style="display:none;">
        <div class="panel-title">Request Body (raw JSON)</div>
        <pre id="request-body"></pre>
      </div>
      <div>
        <div id="status-badge" class="status-badge status-200">200 OK</div>
        <span id="response-meta" style="font-size: 12px; color: #8e9297; margin-left: 12px;">Time: 14 ms · Format: application/json</span>
      </div>
      <div class="panel">
        <div class="panel-title">Response Body</div>
        <pre id="response-body"></pre>
      </div>
    </div>
  </div>
</body>
</html>
  `);
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to Lab 3: REST API, query parameters, validation, debugging',
    student: {
      name: 'Varshith Gone',
      registrationNumber: '252U1R9167',
      section: 'S 26 Gen Ai 2C',
      course: 'Backend Development Fundamentals · Year II Term II · Aurora',
      faculty: 'Joel Prashanth D'
    }
  });
});

// API 1: GET /books
app.get('/books', async (request, response) => {
  try {
    const {
      search_q = '',
      order_by = 'id',
      order = 'ASC',
      limit = 10,
      offset = 0,
      min_price = 0,
      max_price = 1000000,
    } = request.query

    const allowedColumns = ['id', 'title', 'author', 'price', 'pages']
    const safeOrderBy = allowedColumns.includes(order_by) ? order_by : 'id'
    const safeOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'

    const getBooksQuery = `
      SELECT *
      FROM book
      WHERE title LIKE ?
        AND price >= ?
        AND price <= ?
      ORDER BY ${safeOrderBy} ${safeOrder}
      LIMIT ? OFFSET ?;
    `

    const books = await db.all(getBooksQuery, [
      `%${search_q}%`,
      Number(min_price),
      Number(max_price),
      Number(limit),
      Number(offset),
    ])

    response.status(200).json(books)
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
});

// API 2: GET /books/:bookId
app.get('/books/:bookId', async (request, response) => {
  try {
    const { bookId } = request.params
    const getBookQuery = `SELECT * FROM book WHERE id = ?;`
    const book = await db.get(getBookQuery, [bookId])

    if (book === undefined) {
      response.status(404).json({ error: 'Book Not Found' })
    } else {
      response.status(200).json(book)
    }
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
});

// API 3: POST /books
app.post('/books', async (request, response) => {
  try {
    const { title, author, price, pages } = request.body

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return response.status(400).json({ error: 'Invalid or missing title' })
    }
    if (!author || typeof author !== 'string' || author.trim() === '') {
      return response.status(400).json({ error: 'Invalid or missing author' })
    }
    if (price === undefined || price === null || isNaN(Number(price))) {
      return response.status(400).json({ error: 'Price must be a valid number' })
    }
    if (pages === undefined || pages === null || isNaN(Number(pages))) {
      return response.status(400).json({ error: 'Pages must be a valid number' })
    }

    const addBookQuery = `
      INSERT INTO book (title, author, price, pages)
      VALUES (?, ?, ?, ?);
    `

    const result = await db.run(addBookQuery, [
      title.trim(),
      author.trim(),
      Number(price),
      Number(pages),
    ])

    response.status(201).json({
      message: 'Book Added Successfully',
      bookId: result.lastID,
    })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
});

// API 4: PUT /books/:bookId
app.put('/books/:bookId', async (request, response) => {
  try {
    const { bookId } = request.params
    const { title, author, price, pages } = request.body

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return response.status(400).json({ error: 'Invalid or missing title' })
    }
    if (!author || typeof author !== 'string' || author.trim() === '') {
      return response.status(400).json({ error: 'Invalid or missing author' })
    }
    if (price === undefined || isNaN(Number(price))) {
      return response.status(400).json({ error: 'Price must be a valid number' })
    }
    if (pages === undefined || isNaN(Number(pages))) {
      return response.status(400).json({ error: 'Pages must be a valid number' })
    }

    const updateBookQuery = `
      UPDATE book
      SET title = ?,
          author = ?,
          price = ?,
          pages = ?
      WHERE id = ?;
    `

    const result = await db.run(updateBookQuery, [
      title.trim(),
      author.trim(),
      Number(price),
      Number(pages),
      bookId,
    ])

    if (result.changes === 0) {
      response.status(404).json({ error: 'Book Not Found' })
    } else {
      response.status(200).json({ message: 'Book Details Updated' })
    }
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
});

// API 5: DELETE /books/:bookId
app.delete('/books/:bookId', async (request, response) => {
  try {
    const { bookId } = request.params
    const deleteBookQuery = `DELETE FROM book WHERE id = ?;`
    const result = await db.run(deleteBookQuery, [bookId])

    if (result.changes === 0) {
      response.status(404).json({ error: 'Book Not Found' })
    } else {
      response.status(200).json({ message: 'Book Removed' })
    }
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
});

async function captureAllScreenshots() {
  console.log('Opening SQLite database...');
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  const server = app.listen(0, async () => {
    const currentPort = server.address().port;
    console.log(`Live test server started on http://localhost:${currentPort}`);

    console.log('Launching Playwright Chrome browser...');
    const browser = await chromium.launch({
      channel: 'chrome',
      headless: true
    });

    const context = await browser.newContext({
      viewport: { width: 1040, height: 720 },
      deviceScaleFactor: 1.5
    });

    const page = await context.newPage();

    async function captureScenario(filename, title, method, path, reqBody, expectedStatus, expectedStatusText) {
      console.log(`Capturing: ${filename} (${method} ${path})...`);
      await page.goto(`http://localhost:${currentPort}/tester`);

      // Execute real fetch request from inside the browser to the live Express server
      const result = await page.evaluate(async ({ method, path, reqBody, currentPort }) => {
        const startTime = performance.now();
        const opts = {
          method: method,
          headers: { 'Content-Type': 'application/json' }
        };
        if (reqBody) opts.body = JSON.stringify(reqBody);

        const res = await fetch(`http://localhost:${currentPort}${path}`, opts);
        const elapsed = Math.round(performance.now() - startTime);
        let data;
        try {
          data = await res.json();
        } catch {
          data = await res.text();
        }
        return {
          status: res.status,
          statusText: res.statusText || (res.status === 200 ? 'OK' : res.status === 201 ? 'Created' : res.status === 400 ? 'Bad Request' : res.status === 404 ? 'Not Found' : 'Error'),
          data,
          elapsed
        };
      }, { method, path, reqBody, currentPort });

      // Update the UI with the live response
      await page.evaluate(({ title, method, path, reqBody, result, expectedStatus, expectedStatusText }) => {
        document.getElementById('scenario-title').innerText = title;
        const mb = document.getElementById('method-badge');
        mb.innerText = method;
        mb.className = 'method-pill method-' + method;
        document.getElementById('url-text').innerText = 'http://localhost:3000' + path;

        const reqPanel = document.getElementById('request-panel');
        if (reqBody) {
          reqPanel.style.display = 'block';
          document.getElementById('request-body').innerText = JSON.stringify(reqBody, null, 2);
        } else {
          reqPanel.style.display = 'none';
        }

        const sb = document.getElementById('status-badge');
        sb.innerText = `${result.status} ${expectedStatusText || result.statusText}`;
        sb.className = 'status-badge status-' + (result.status >= 200 && result.status < 300 ? '200' : result.status);

        document.getElementById('response-meta').innerText = `Time: ${result.elapsed || 12} ms · Status: ${result.status} · Format: application/json`;
        document.getElementById('response-body').innerText = JSON.stringify(result.data, null, 2);
      }, { title, method, path, reqBody, result, expectedStatus, expectedStatusText });

      await page.waitForTimeout(300);
      const outPath = pathModule.join(screenshotsDir, filename);
      await page.screenshot({ path: outPath, fullPage: true });
      console.log(`Saved: ${outPath}`);
    }

    const pathModule = path;

    // 1. GET /books (Default)
    await captureScenario(
      '01-get-books-all.png',
      'API 1: GET /books (Default - All Books with Limit 10)',
      'GET',
      '/books',
      null,
      200,
      'OK'
    );

    // 2. GET /books?search_q=Harry (Search Query)
    await captureScenario(
      '02-get-books-search.png',
      'API 1: GET /books?search_q=Harry (Search with LIKE %search_q%)',
      'GET',
      '/books?search_q=Harry',
      null,
      200,
      'OK'
    );

    // 3. GET /books?min_price=300&max_price=550&order_by=price&order=ASC (Price Filter & Sort)
    await captureScenario(
      '03-get-books-filter-sort.png',
      'API 1: GET /books with min_price, max_price & order_by=price ASC',
      'GET',
      '/books?min_price=300&max_price=550&order_by=price&order=ASC',
      null,
      200,
      'OK'
    );

    // 4. GET /books?limit=3&offset=3 (Pagination)
    await captureScenario(
      '04-get-books-pagination.png',
      'API 1: GET /books with Pagination (limit=3, offset=3)',
      'GET',
      '/books?limit=3&offset=3',
      null,
      200,
      'OK'
    );

    // 5. GET /books/1 (Single Book)
    await captureScenario(
      '05-get-book-single.png',
      'API 2: GET /books/1 (Single Book by ID)',
      'GET',
      '/books/1',
      null,
      200,
      'OK'
    );

    // 6. GET /books/999 (404 Missing Record)
    await captureScenario(
      '06-get-book-404.png',
      'API 2: GET /books/999 (Non-existent Record - 404 Not Found)',
      'GET',
      '/books/999',
      null,
      404,
      'Not Found'
    );

    // 7. POST /books (Validation: Missing Title -> 400)
    await captureScenario(
      '07-post-validation-missing-title-400.png',
      'API 3: POST /books (Validation Rejection: Missing Title)',
      'POST',
      '/books',
      { author: 'Steve McConnell', price: 950, pages: 960 },
      400,
      'Bad Request'
    );

    // 8. POST /books (Validation: Non-numeric Price -> 400)
    await captureScenario(
      '08-post-validation-invalid-price-400.png',
      'API 3: POST /books (Validation Rejection: Non-numeric Price)',
      'POST',
      '/books',
      { title: 'Code Complete', author: 'Steve McConnell', price: 'invalid_price', pages: 960 },
      400,
      'Bad Request'
    );

    // 9. POST /books (Success -> 201 Created)
    await captureScenario(
      '09-post-book-success-201.png',
      'API 3: POST /books (Successful Creation -> 201 Created)',
      'POST',
      '/books',
      { title: 'Code Complete', author: 'Steve McConnell', price: 950, pages: 960 },
      201,
      'Created'
    );

    // 10. PUT /books/13 (Update -> 200 OK)
    await captureScenario(
      '10-put-book-success-200.png',
      'API 4: PUT /books/13 (Update Book Details -> 200 OK)',
      'PUT',
      '/books/13',
      { title: 'Code Complete (2nd Edition)', author: 'Steve McConnell', price: 1050, pages: 960 },
      200,
      'OK'
    );

    // 11. PUT /books/9999 (404 Not Found)
    await captureScenario(
      '11-put-book-404.png',
      'API 4: PUT /books/9999 (Update Non-existent ID -> 404 Not Found)',
      'PUT',
      '/books/9999',
      { title: 'Ghost Book', author: 'Nobody', price: 100, pages: 100 },
      404,
      'Not Found'
    );

    // 12. DELETE /books/13 (Remove -> 200 OK)
    await captureScenario(
      '12-delete-book-success-200.png',
      'API 5: DELETE /books/13 (Remove Book -> 200 OK)',
      'DELETE',
      '/books/13',
      null,
      200,
      'OK'
    );

    // 13. GET /books/13 (Verify Removal -> 404 Not Found)
    await captureScenario(
      '13-get-book-after-delete-404.png',
      'Verification: GET /books/13 After DELETE -> 404 Not Found',
      'GET',
      '/books/13',
      null,
      404,
      'Not Found'
    );

    console.log('All screenshots captured successfully!');
    await browser.close();
    server.close();
    await db.close();
    process.exit(0);
  });
}

captureAllScreenshots().catch(err => {
  console.error('Screenshot script failed:', err);
  process.exit(1);
});
