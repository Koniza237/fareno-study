const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Pool PostgreSQL (utilise les variables d'environnement Render ou locales)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

app.use(cors());
app.use(bodyParser.json());

// Servir les fichiers statiques HTML à la racine
app.use(express.static(path.join(__dirname)));

// ----------- API UTILISATEURS -----------
app.get('/api/users/teachers', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email FROM teachers ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/students', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM students ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/admins', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email FROM admins ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const { name, email, password } = req.body;
  let query = '';
  let values = [];
  try {
    if (type === 'teachers') {
      query = password
        ? 'UPDATE teachers SET email=$1, password=$2 WHERE id=$3'
        : 'UPDATE teachers SET email=$1 WHERE id=$2';
      values = password ? [email, password, id] : [email, id];
    } else if (type === 'students') {
      query = password
        ? 'UPDATE students SET name=$1, password=$2 WHERE id=$3'
        : 'UPDATE students SET name=$1 WHERE id=$2';
      values = password ? [name, password, id] : [name, id];
    } else if (type === 'admins') {
      query = password
        ? 'UPDATE admins SET email=$1, password=$2 WHERE id=$3'
        : 'UPDATE admins SET email=$1 WHERE id=$2';
      values = password ? [email, password, id] : [email, id];
    } else {
      return res.status(400).json({ error: 'Type inconnu' });
    }
    await pool.query(query, values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  let query = '';
  try {
    if (type === 'teachers') {
      query = 'DELETE FROM teachers WHERE id=$1';
    } else if (type === 'students') {
      query = 'DELETE FROM students WHERE id=$1';
    } else if (type === 'admins') {
      query = 'DELETE FROM admins WHERE id=$1';
    } else {
      return res.status(400).json({ error: 'Type inconnu' });
    }
    await pool.query(query, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------- API RESSOURCES -----------
app.get('/api/resources/teachers', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM teachers ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/resources/groups', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, studentCount, subjects FROM groups ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/resources/rooms', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, capacity, equipment FROM rooms ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/resources/teachers/:id', async (req, res) => {
  const { id } = req.params;
  const { name, subjects, availability } = req.body;
  try {
    await pool.query(
      'UPDATE teachers SET name=$1, subjects=$2, availability=$3 WHERE id=$4',
      [name, subjects, availability, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/resources/groups/:id', async (req, res) => {
  const { id } = req.params;
  const { name, studentCount, subjects } = req.body;
  try {
    await pool.query(
      'UPDATE groups SET name=$1, studentCount=$2, subjects=$3 WHERE id=$4',
      [name, studentCount, subjects, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/resources/rooms/:id', async (req, res) => {
  const { id } = req.params;
  const { name, capacity, equipment } = req.body;
  try {
    await pool.query(
      'UPDATE rooms SET name=$1, capacity=$2, equipment=$3 WHERE id=$4',
      [name, capacity, equipment, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/resources/teachers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM teachers WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/resources/groups/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM groups WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/resources/rooms/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM rooms WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------- API CONTRAINTES -----------
app.get('/api/constraints', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM constraints ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/constraints/:id', async (req, res) => {
  const { id } = req.params;
  const { resourceType, resource, day, time, type } = req.body;
  try {
    await pool.query(
      'UPDATE constraints SET resourceType=$1, resource=$2, day=$3, time=$4, type=$5 WHERE id=$6',
      [resourceType, resource, day, time, type, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/constraints/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM constraints WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------- ROUTE PAR DEFAUT -----------
app.get('*', (req, res) => {
  // Sert index.html ou une page d'accueil si besoin
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.listen(port, () => {
  console.log(`Serveur lancé sur http://localhost:${port}`);
});
