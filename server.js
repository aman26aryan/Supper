// server.js — minimal backend for Supper app
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // serve supper.html + assets

// ---- MySQL connection pool ----
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'supper_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// --- Utility helper ---
function ok(res, data) { res.json(data); }
function fail(res, msg, code = 500) { res.status(code).json({ error: msg }); }

// --- RESTAURANTS ---
app.get('/api/restaurants', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, cuisine, rating, avg_time, description, address, image FROM restaurants'
    );
    ok(res, rows);
  } catch (e) {
    console.error(e);
    fail(res, 'Failed to fetch restaurants');
  }
});

app.get('/api/restaurants/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rRes] = await pool.query(
      'SELECT id, name, cuisine, rating, avg_time, description, address, image FROM restaurants WHERE id=?',
      [id]
    );
    if (!rRes.length) return fail(res, 'Restaurant not found', 404);

    const restaurant = rRes[0];
    const [menu] = await pool.query(
      'SELECT id, restaurant_id, category, name, description, price, image, available FROM menu_items WHERE restaurant_id=? AND available=1',
      [id]
    );

    // group menu by category
    const categories = {};
    for (const item of menu) {
      const cat = item.category || 'Menu';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image
      });
    }

    restaurant.categories = categories;
    ok(res, restaurant);
  } catch (e) {
    console.error(e);
    fail(res, 'Failed to load restaurant menu');
  }
});

// --- CUSTOMERS ---
app.post('/api/customers', async (req, res) => {
  const { name, email, phone, address } = req.body;
  if (!name) return fail(res, 'Name required', 400);
  try {
    const [r] = await pool.query(
      'INSERT INTO customers (name, email, phone, address) VALUES (?,?,?,?)',
      [name, email || null, phone || null, address || null]
    );
    ok(res, { id: r.insertId, name });
  } catch (e) {
    console.error(e);
    fail(res, 'Failed to create customer');
  }
});

// --- ORDERS ---
app.post('/api/orders', async (req, res) => {
  const { customer, customer_id, restaurant_id, delivery_address, items } = req.body;
  if (!restaurant_id || !items?.length) return fail(res, 'Missing restaurant or items', 400);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Create or use existing customer
    let cid = customer_id || null;
    if (!cid && customer?.name) {
      const [cRes] = await conn.query(
        'INSERT INTO customers (name, email, phone, address) VALUES (?,?,?,?)',
        [customer.name, customer.email || null, customer.phone || null, customer.address || delivery_address || null]
      );
      cid = cRes.insertId;
    }

    // Compute subtotal safely
    let subtotal = 0;
    for (const item of items) {
      const [r] = await conn.query('SELECT price FROM menu_items WHERE id=?', [item.menu_item_id]);
      if (!r.length) throw new Error('Invalid menu_item_id ' + item.menu_item_id);
      subtotal += r[0].price * item.qty;
    }

    const order_uid = 'O' + Date.now();
    const [oRes] = await conn.query(
      'INSERT INTO orders (order_uid, customer_id, restaurant_id, delivery_address, subtotal, status) VALUES (?,?,?,?,?,?)',
      [order_uid, cid, restaurant_id, delivery_address, subtotal, 'new']
    );

    const orderId = oRes.insertId;
    for (const item of items) {
      const [r] = await conn.query('SELECT name, price FROM menu_items WHERE id=?', [item.menu_item_id]);
      const name = r[0].name;
      const price = r[0].price;
      await conn.query(
        'INSERT INTO order_items (order_id, menu_item_id, name, qty, price) VALUES (?,?,?,?,?)',
        [orderId, item.menu_item_id, name, item.qty, price]
      );
    }

    await conn.commit();
    ok(res, { id: orderId, order_uid });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    fail(res, 'Failed to create order');
  } finally {
    conn.release();
  }
});

app.get('/api/orders', async (req, res) => {
  const { restaurant_id } = req.query;
  try {
    const q = restaurant_id
      ? 'SELECT * FROM orders WHERE restaurant_id=? ORDER BY created_at DESC'
      : 'SELECT * FROM orders ORDER BY created_at DESC';
    const [orders] = restaurant_id ? await pool.query(q, [restaurant_id]) : await pool.query(q);

    for (const o of orders) {
      const [items] = await pool.query('SELECT id, menu_item_id, name, qty, price FROM order_items WHERE order_id=?', [o.id]);
      o.items = items;
    }

    ok(res, orders);
  } catch (e) {
    console.error(e);
    fail(res, 'Failed to fetch orders');
  }
});

app.get('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [oRes] = await pool.query('SELECT * FROM orders WHERE id=?', [id]);
    if (!oRes.length) return fail(res, 'Order not found', 404);
    const order = oRes[0];
    const [items] = await pool.query('SELECT id, menu_item_id, name, qty, price FROM order_items WHERE order_id=?', [id]);
    order.items = items;
    ok(res, order);
  } catch (e) {
    console.error(e);
    fail(res, 'Failed to fetch order');
  }
});

app.put('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return fail(res, 'Status required', 400);
  try {
    await pool.query('UPDATE orders SET status=?, updated_at=NOW() WHERE id=?', [status, id]);
    ok(res, { ok: true });
  } catch (e) {
    console.error(e);
    fail(res, 'Failed to update order status');
  }
});

app.put('/api/orders/:id/assign', async (req, res) => {
  const { id } = req.params;
  const { driver_id } = req.body;
  if (!driver_id) return fail(res, 'driver_id required', 400);
  try {
    await pool.query(
      'UPDATE orders SET delivery_agent_id=?, status="assigned", updated_at=NOW() WHERE id=?',
      [driver_id, id]
    );
    ok(res, { ok: true });
  } catch (e) {
    console.error(e);
    fail(res, 'Failed to assign driver');
  }
});

// --- DRIVERS ---
app.get('/api/drivers', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, phone, vehicle, status FROM delivery_agents ORDER BY id ASC'
    );
    ok(res, rows);
  } catch (e) {
    console.error(e);
    fail(res, 'Failed to fetch drivers');
  }
});

app.post('/api/drivers', async (req, res) => {
  const { name, phone, vehicle } = req.body;
  if (!name) return fail(res, 'name required', 400);
  try {
    const [r] = await pool.query(
      'INSERT INTO delivery_agents (name, phone, vehicle) VALUES (?,?,?)',
      [name, phone || null, vehicle || null]
    );
    ok(res, { id: r.insertId, name });
  } catch (e) {
    console.error(e);
    fail(res, 'Failed to add driver');
  }
});

// --- SERVER START ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Supper backend running on http://localhost:${PORT}`));
