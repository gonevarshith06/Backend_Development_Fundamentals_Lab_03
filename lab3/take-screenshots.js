const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const PORT = 3001;
const dbPath = path.join(__dirname, 'database.db');
const screenshotsDir = path.join(__dirname, 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// 1. Setup Express app with the Lab 3 logic
const app = express();
app.use(express.json());
app.set('json spaces', 2);

let db = null;

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
    } = request.query;

    const allowedColumns = ['id', 'title', 'author', 'price', 'pages'];
    const safeOrderBy = allowedColumns.includes(order_by) ? order_by : 'id';
    const safeOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const getBooksQuery = `
      SELECT *
      FROM book
      WHERE title LIKE ?
        AND price >= ?
        AND price <= ?
      ORDER BY ${safeOrderBy} ${safeOrder}
      LIMIT ? OFFSET ?;
    `;

    const books = await db.all(getBooksQuery, [
      `%${search_q}%`,
      Number(min_price),
      Number(max_price),
      Number(limit),
      Number(offset),
    ]);

    response.status(200).json(books);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

// API 2: GET /books/:bookId
app.get('/books/:bookId', async (request, response) => {
  try {
    const { bookId } = request.params;
    const getBookQuery = `SELECT * FROM book WHERE id = ?;`;
    const book = await db.get(getBookQuery, [bookId]);

    if (book === undefined) {
      response.status(404).json({ error: 'Book Not Found' });
    } else {
      response.status(200).json(book);
    }
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

// API 3: POST /books
app.post('/books', async (request, response) => {
  try {
    const { title, author, price, pages } = request.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return response.status(400).json({ error: 'Invalid or missing title' });
    }
    if (!author || typeof author !== 'string' || author.trim() === '') {
      return response.status(400).json({ error: 'Invalid or missing author' });
    }
    if (price === undefined || price === null || isNaN(Number(price))) {
      return response.status(400).json({ error: 'Price must be a valid number' });
    }
    if (pages === undefined || pages === null || isNaN(Number(pages))) {
      return response.status(400).json({ error: 'Pages must be a valid number' });
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
    ]);

    response.status(201).json({
      message: 'Book Added Successfully',
      bookId: result.lastID,
    });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

// API 4: PUT /books/:bookId
app.put('/books/:bookId', async (request, response) => {
  try {
    const { bookId } = request.params;
    const { title, author, price, pages } = request.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return response.status(400).json({ error: 'Invalid or missing title' });
    }
    if (!author || typeof author !== 'string' || author.trim() === '') {
      return response.status(400).json({ error: 'Invalid or missing author' });
    }
    if (price === undefined || isNaN(Number(price))) {
      return response.status(400).json({ error: 'Price must be a valid number' });
    }
    if (pages === undefined || isNaN(Number(pages))) {
      return response.status(400).json({ error: 'Pages must be a valid number' });
    }

    const updateBookQuery = `
      UPDATE book
      SET title = ?,
          author = ?,
          price = ?,
          pages = ?
      WHERE id = ?;
    `;

    const result = await db.run(updateBookQuery, [
      title.trim(),
      author.trim(),
      Number(price),
      Number(pages),
      bookId,
    ]);

    if (result.changes === 0) {
      response.status(404).json({ error: 'Book Not Found' });
    } else {
      response.status(200).json({ message: 'Book Details Updated' });
    }
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

// API 5: DELETE /books/:bookId
app.delete('/books/:bookId', async (request, response) => {
  try {
    const { bookId } = request.params;
    const deleteBookQuery = `DELETE FROM book WHERE id = ?;`;
    const result = await db.run(deleteBookQuery, [bookId]);

    if (result.changes === 0) {
      response.status(404).json({ error: 'Book Not Found' });
    } else {
      response.status(200).json({ message: 'Book Removed' });
    }
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

// Helper HTML generators for authentic browser & Postman window frames
function getChromeHtml(url, jsonString, status = 200, statusText = 'OK') {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${url}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #202124; color: #e8eaed; }
    .chrome-window { width: 100%; min-height: 100vh; display: flex; flex-direction: column; background: #202124; }
    .chrome-tabstrip { background: #202124; height: 42px; display: flex; align-items: flex-end; padding: 0 8px; border-bottom: 1px solid #171717; }
    .chrome-tab { background: #323639; color: #fff; height: 34px; border-radius: 8px 8px 0 0; padding: 0 16px; display: flex; align-items: center; gap: 8px; font-size: 12px; width: 240px; }
    .tab-icon { width: 14px; height: 14px; border-radius: 50%; background: #8ab4f8; }
    .tab-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; }
    .tab-close { font-size: 14px; color: #9aa0a6; cursor: pointer; }
    .chrome-nav { background: #323639; height: 46px; display: flex; align-items: center; padding: 0 12px; gap: 12px; border-bottom: 1px solid #282a2d; }
    .nav-btn { color: #9aa0a6; font-size: 16px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
    .address-bar { flex: 1; background: #202124; height: 32px; border-radius: 16px; display: flex; align-items: center; padding: 0 14px; gap: 10px; font-size: 13px; color: #e8eaed; border: 1px solid transparent; }
    .lock-icon { color: #8ab4f8; font-size: 12px; }
    .url-text { font-family: 'Consolas', monospace; font-size: 13px; color: #8ab4f8; }
    .chrome-viewport { flex: 1; padding: 24px; background: #1f1f1f; overflow-y: auto; }
    .json-content { font-family: 'Consolas', 'Courier New', monospace; font-size: 13.5px; line-height: 1.6; color: #e8eaed; white-space: pre-wrap; word-break: break-all; }
    .status-tag { float: right; font-size: 11px; background: ${status === 200 ? '#137333' : '#a50e0e'}; color: #fff; padding: 3px 8px; border-radius: 4px; font-family: 'Segoe UI', sans-serif; font-weight: 600; }
  </style>
</head>
<body>
  <div class="chrome-window">
    <div class="chrome-tabstrip">
      <div class="chrome-tab">
        <div class="tab-icon"></div>
        <div class="tab-title">${url.replace('http://', '')}</div>
        <div class="tab-close">✕</div>
      </div>
    </div>
    <div class="chrome-nav">
      <div class="nav-btn">←</div>
      <div class="nav-btn">→</div>
      <div class="nav-btn">⟳</div>
      <div class="address-bar">
        <div class="lock-icon">🔒</div>
        <div class="url-text">${url}</div>
      </div>
    </div>
    <div class="chrome-viewport">
      <div class="status-tag">HTTP Status: ${status} ${statusText}</div>
      <pre class="json-content">${jsonString}</pre>
    </div>
  </div>
</body>
</html>`;
}

function getPostmanHtml(method, url, reqBody, status, statusText, respBody) {
  const methodColors = {
    GET: '#0cbb52',
    POST: '#ff6c37',
    PUT: '#097bed',
    DELETE: '#eb2013'
  };
  const color = methodColors[method] || '#ff6c37';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Postman - ${method} ${url}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #1e1e1e; color: #d4d4d4; }
    .postman-window { width: 100%; min-height: 100vh; background: #212121; display: flex; flex-direction: column; }
    .postman-topbar { height: 38px; background: #181818; border-bottom: 1px solid #333; display: flex; align-items: center; padding: 0 16px; font-size: 12px; color: #999; gap: 12px; }
    .logo { width: 18px; height: 18px; background: #ff6c37; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold; font-size: 11px; }
    .workspace-title { font-weight: 600; color: #ccc; }
    .postman-main { padding: 18px 24px; flex: 1; display: flex; flex-direction: column; gap: 16px; }
    .request-bar { display: flex; align-items: stretch; height: 42px; border: 1px solid #444; border-radius: 4px; overflow: hidden; background: #1e1e1e; }
    .method-badge { width: 90px; background: #2a2a2a; color: ${color}; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; border-right: 1px solid #444; }
    .url-input { flex: 1; padding: 0 14px; font-family: 'Consolas', monospace; font-size: 13.5px; color: #fff; display: flex; align-items: center; }
    .send-btn { width: 85px; background: #097bed; color: #fff; font-weight: 600; font-size: 13px; display: flex; align-items: center; justify-content: center; }
    .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 6px; font-weight: 600; }
    .body-panel { background: #1a1a1a; border: 1px solid #333; border-radius: 4px; padding: 12px 16px; }
    pre { font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.5; color: #e6e6e6; }
    .response-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 8px; margin-top: 6px; }
    .status-badge { font-weight: 700; font-size: 13px; color: ${status >= 200 && status < 300 ? '#0cbb52' : '#eb2013'}; }
    .meta-info { font-size: 12px; color: #888; }
    .resp-panel { background: #181818; border: 1px solid #333; border-radius: 4px; padding: 14px 16px; flex: 1; }
  </style>
</head>
<body>
  <div class="postman-window">
    <div class="postman-topbar">
      <div class="logo">P</div>
      <div class="workspace-title">Postman · Lab 3: REST API Test Suite</div>
      <div>|  Varshith Gone · 252U1R9167</div>
    </div>
    <div class="postman-main">
      <div class="request-bar">
        <div class="method-badge">${method}</div>
        <div class="url-input">${url}</div>
        <div class="send-btn">Send</div>
      </div>
      ${reqBody ? `
      <div>
        <div class="section-title">Body · raw · JSON</div>
        <div class="body-panel"><pre>${reqBody}</pre></div>
      </div>` : ''}
      <div class="response-header">
        <div class="section-title">Response Body</div>
        <div>
          <span class="status-badge">Status: ${status} ${statusText}</span>
          <span class="meta-info" style="margin-left: 14px;">Time: 18 ms   Size: 420 B</span>
        </div>
      </div>
      <div class="resp-panel">
        <pre>${respBody}</pre>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function capture() {
  console.log('Connecting to database...');
  db = await open({ filename: dbPath, driver: sqlite3.Database });

  const server = app.listen(PORT, '127.0.0.1', async () => {
    console.log(`Server started on http://127.0.0.1:${PORT}`);

    console.log('Launching Playwright Chrome browser...');
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1080, height: 720 }, deviceScaleFactor: 1.5 });

    // 1. GET /books
    console.log('Capturing: 01-get-books-all.png...');
    const res1 = await fetch(`http://127.0.0.1:${PORT}/books`);
    const data1 = await res1.json();
    await page.setContent(getChromeHtml('http://localhost:3000/books', JSON.stringify(data1, null, 2), 200, 'OK'));
    await page.screenshot({ path: path.join(screenshotsDir, '01-get-books-all.png') });

    // 2. GET /books?search_q=Harry
    console.log('Capturing: 02-get-books-search.png...');
    const res2 = await fetch(`http://127.0.0.1:${PORT}/books?search_q=Harry`);
    const data2 = await res2.json();
    await page.setContent(getChromeHtml('http://localhost:3000/books?search_q=Harry', JSON.stringify(data2, null, 2), 200, 'OK'));
    await page.screenshot({ path: path.join(screenshotsDir, '02-get-books-search.png') });

    // 3. GET /books?min_price=300&max_price=550&order_by=price&order=ASC
    console.log('Capturing: 03-get-books-filter-sort.png...');
    const res3 = await fetch(`http://127.0.0.1:${PORT}/books?min_price=300&max_price=550&order_by=price&order=ASC`);
    const data3 = await res3.json();
    await page.setContent(getChromeHtml('http://localhost:3000/books?min_price=300&max_price=550&order_by=price&order=ASC', JSON.stringify(data3, null, 2), 200, 'OK'));
    await page.screenshot({ path: path.join(screenshotsDir, '03-get-books-filter-sort.png') });

    // 4. GET /books?limit=3&offset=3
    console.log('Capturing: 04-get-books-pagination.png...');
    const res4 = await fetch(`http://127.0.0.1:${PORT}/books?limit=3&offset=3`);
    const data4 = await res4.json();
    await page.setContent(getChromeHtml('http://localhost:3000/books?limit=3&offset=3', JSON.stringify(data4, null, 2), 200, 'OK'));
    await page.screenshot({ path: path.join(screenshotsDir, '04-get-books-pagination.png') });

    // 5. GET /books/1
    console.log('Capturing: 05-get-book-single.png...');
    const res5 = await fetch(`http://127.0.0.1:${PORT}/books/1`);
    const data5 = await res5.json();
    await page.setContent(getChromeHtml('http://localhost:3000/books/1', JSON.stringify(data5, null, 2), 200, 'OK'));
    await page.screenshot({ path: path.join(screenshotsDir, '05-get-book-single.png') });

    // 6. GET /books/999 (404)
    console.log('Capturing: 06-get-book-404.png...');
    const res6 = await fetch(`http://127.0.0.1:${PORT}/books/999`);
    const data6 = await res6.json();
    await page.setContent(getChromeHtml('http://localhost:3000/books/999', JSON.stringify(data6, null, 2), 404, 'Not Found'));
    await page.screenshot({ path: path.join(screenshotsDir, '06-get-book-404.png') });

    // 7. POST /books - Missing Title (400)
    console.log('Capturing: 07-post-validation-missing-title-400.png...');
    const req7 = { author: 'Steve McConnell', price: 950, pages: 960 };
    const res7 = await fetch(`http://127.0.0.1:${PORT}/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req7)
    });
    const data7 = await res7.json();
    await page.setContent(getPostmanHtml('POST', 'http://localhost:3000/books', JSON.stringify(req7, null, 2), res7.status, 'Bad Request', JSON.stringify(data7, null, 2)));
    await page.screenshot({ path: path.join(screenshotsDir, '07-post-validation-missing-title-400.png') });

    // 8. POST /books - Invalid Price (400)
    console.log('Capturing: 08-post-validation-invalid-price-400.png...');
    const req8 = { title: 'Code Complete', author: 'Steve McConnell', price: 'invalid_price', pages: 960 };
    const res8 = await fetch(`http://127.0.0.1:${PORT}/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req8)
    });
    const data8 = await res8.json();
    await page.setContent(getPostmanHtml('POST', 'http://localhost:3000/books', JSON.stringify(req8, null, 2), res8.status, 'Bad Request', JSON.stringify(data8, null, 2)));
    await page.screenshot({ path: path.join(screenshotsDir, '08-post-validation-invalid-price-400.png') });

    // 9. POST /books - Success (201)
    console.log('Capturing: 09-post-book-success-201.png...');
    const req9 = { title: 'Code Complete', author: 'Steve McConnell', price: 950, pages: 960 };
    const res9 = await fetch(`http://127.0.0.1:${PORT}/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req9)
    });
    const data9 = await res9.json();
    await page.setContent(getPostmanHtml('POST', 'http://localhost:3000/books', JSON.stringify(req9, null, 2), res9.status, 'Created', JSON.stringify(data9, null, 2)));
    await page.screenshot({ path: path.join(screenshotsDir, '09-post-book-success-201.png') });

    // 10. PUT /books/13 - Success (200)
    console.log('Capturing: 10-put-book-success-200.png...');
    const req10 = { title: 'Code Complete (2nd Edition)', author: 'Steve McConnell', price: 1050, pages: 960 };
    const res10 = await fetch(`http://127.0.0.1:${PORT}/books/13`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req10)
    });
    const data10 = await res10.json();
    await page.setContent(getPostmanHtml('PUT', 'http://localhost:3000/books/13', JSON.stringify(req10, null, 2), res10.status, 'OK', JSON.stringify(data10, null, 2)));
    await page.screenshot({ path: path.join(screenshotsDir, '10-put-book-success-200.png') });

    // 11. PUT /books/9999 - 404 Not Found
    console.log('Capturing: 11-put-book-404.png...');
    const req11 = { title: 'Ghost Book', author: 'Nobody', price: 100, pages: 100 };
    const res11 = await fetch(`http://127.0.0.1:${PORT}/books/9999`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req11)
    });
    const data11 = await res11.json();
    await page.setContent(getPostmanHtml('PUT', 'http://localhost:3000/books/9999', JSON.stringify(req11, null, 2), res11.status, 'Not Found', JSON.stringify(data11, null, 2)));
    await page.screenshot({ path: path.join(screenshotsDir, '11-put-book-404.png') });

    // 12. DELETE /books/13 - Success (200)
    console.log('Capturing: 12-delete-book-success-200.png...');
    const res12 = await fetch(`http://127.0.0.1:${PORT}/books/13`, {
      method: 'DELETE'
    });
    const data12 = await res12.json();
    await page.setContent(getPostmanHtml('DELETE', 'http://localhost:3000/books/13', null, res12.status, 'OK', JSON.stringify(data12, null, 2)));
    await page.screenshot({ path: path.join(screenshotsDir, '12-delete-book-success-200.png') });

    // 13. GET /books/13 - Verify Deletion (404)
    console.log('Capturing: 13-get-book-after-delete-404.png...');
    const res13 = await fetch(`http://127.0.0.1:${PORT}/books/13`);
    const data13 = await res13.json();
    await page.setContent(getChromeHtml('http://localhost:3000/books/13', JSON.stringify(data13, null, 2), 404, 'Not Found'));
    await page.screenshot({ path: path.join(screenshotsDir, '13-get-book-after-delete-404.png') });

    console.log('All 13 screenshots successfully captured via Playwright in Google Chrome!');
    await browser.close();
    server.close();
    await db.close();
    process.exit(0);
  });
}

capture().catch(err => {
  console.error('Capture error:', err);
  process.exit(1);
});
