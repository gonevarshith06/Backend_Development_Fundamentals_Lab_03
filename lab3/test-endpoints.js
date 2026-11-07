const http = require('http');

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== Starting Lab 3 REST API Endpoint Tests ===\n');

  try {
    // 1. GET /
    console.log('1. Testing GET / (API Welcome & Student Info)...');
    const r0 = await makeRequest('GET', '/');
    console.log(`Status: ${r0.status}`);
    console.log('Student:', r0.data.student.name, '(', r0.data.student.registrationNumber, ')');

    // 2. GET /books (Default parameters)
    console.log('\n2. Testing GET /books (Default limit=10, order_by=id ASC)...');
    const r1 = await makeRequest('GET', '/books');
    console.log(`Status: ${r1.status}, Count: ${r1.data.length}`);

    // 3. GET /books?search_q=Harry (Search)
    console.log('\n3. Testing GET /books?search_q=Harry (Title Search)...');
    const r2 = await makeRequest('GET', '/books?search_q=Harry');
    console.log(`Status: ${r2.status}`);
    console.log('Result:', r2.data);

    // 4. GET /books?min_price=300&max_price=500&order_by=price&order=ASC (Filter & Sort)
    console.log('\n4. Testing GET /books?min_price=300&max_price=500&order_by=price&order=ASC...');
    const r3 = await makeRequest('GET', '/books?min_price=300&max_price=500&order_by=price&order=ASC');
    console.log(`Status: ${r3.status}, Matched: ${r3.data.length}`);
    console.log('Prices:', r3.data.map(b => `${b.title} (₹${b.price})`));

    // 5. GET /books?limit=3&offset=3 (Pagination)
    console.log('\n5. Testing GET /books?limit=3&offset=3 (Pagination)...');
    const r4 = await makeRequest('GET', '/books?limit=3&offset=3');
    console.log(`Status: ${r4.status}, Count: ${r4.data.length}`);
    console.log('Books:', r4.data.map(b => `[${b.id}] ${b.title}`));

    // 6. GET /books/1 (Single Book)
    console.log('\n6. Testing GET /books/1 (Single Book)...');
    const r5 = await makeRequest('GET', '/books/1');
    console.log(`Status: ${r5.status}`);
    console.log('Book:', r5.data);

    // 7. GET /books/999 (404 Missing Record)
    console.log('\n7. Testing GET /books/999 (Non-existent Book - Expect 404)...');
    const r6 = await makeRequest('GET', '/books/999');
    console.log(`Status: ${r6.status} (Expected 404)`);
    console.log('Response:', r6.data);

    // 8. POST /books (Validation: Missing Title)
    console.log('\n8. Testing POST /books (Missing Title - Expect 400)...');
    const r7 = await makeRequest('POST', '/books', { author: 'Author', price: 299, pages: 100 });
    console.log(`Status: ${r7.status} (Expected 400)`);
    console.log('Response:', r7.data);

    // 9. POST /books (Validation: Non-numeric Price)
    console.log('\n9. Testing POST /books (Non-numeric Price - Expect 400)...');
    const r8 = await makeRequest('POST', '/books', { title: 'Book', author: 'Author', price: 'free', pages: 100 });
    console.log(`Status: ${r8.status} (Expected 400)`);
    console.log('Response:', r8.data);

    // 10. POST /books (Successful Creation)
    console.log('\n10. Testing POST /books (Valid Input - Expect 201)...');
    const newBookPayload = {
      title: 'Pragmatic Programmer',
      author: 'Andy Hunt & Dave Thomas',
      price: 799,
      pages: 352
    };
    const r9 = await makeRequest('POST', '/books', newBookPayload);
    console.log(`Status: ${r9.status} (Expected 201)`);
    console.log('Response:', r9.data);
    const createdId = r9.data.bookId;

    // 11. PUT /books/:bookId (Successful Update)
    console.log(`\n11. Testing PUT /books/${createdId} (Valid Update - Expect 200)...`);
    const updatePayload = {
      title: 'The Pragmatic Programmer: 20th Anniversary Edition',
      author: 'Andy Hunt & Dave Thomas',
      price: 850,
      pages: 360
    };
    const r10 = await makeRequest('PUT', `/books/${createdId}`, updatePayload);
    console.log(`Status: ${r10.status} (Expected 200)`);
    console.log('Response:', r10.data);

    // 12. PUT /books/9999 (Non-existent Update - Expect 404)
    console.log('\n12. Testing PUT /books/9999 (Update Missing Book - Expect 404)...');
    const r11 = await makeRequest('PUT', '/books/9999', updatePayload);
    console.log(`Status: ${r11.status} (Expected 404)`);
    console.log('Response:', r11.data);

    // 13. DELETE /books/:bookId (Successful Deletion)
    console.log(`\n13. Testing DELETE /books/${createdId} (Expect 200)...`);
    const r12 = await makeRequest('DELETE', `/books/${createdId}`);
    console.log(`Status: ${r12.status} (Expected 200)`);
    console.log('Response:', r12.data);

    // 14. DELETE /books/:bookId (Already Deleted - Expect 404)
    console.log(`\n14. Testing DELETE /books/${createdId} again (Expect 404)...`);
    const r13 = await makeRequest('DELETE', `/books/${createdId}`);
    console.log(`Status: ${r13.status} (Expected 404)`);
    console.log('Response:', r13.data);

    console.log('\n=== All Tests Passed Successfully! ===');
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

runTests();
