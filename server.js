const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// PostgreSQL pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://fareno:VBEeEFG1WhIkLIYaTMg06mfDJPoFerme@dpg-d10l5ei4d50c73ato2bg-a.oregon-postgres.render.com/fareno_db",
    ssl: { rejectUnauthorized: false }
});

// Création du dossier uploads pour les documents
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Création des tables si elles n'existent pas et admin par défaut
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS teachers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                subjects TEXT,
                availability TEXT
            );
            CREATE TABLE IF NOT EXISTS groups (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                studentCount INTEGER,
                subjects TEXT
            );
            CREATE TABLE IF NOT EXISTS rooms (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                capacity INTEGER,
                equipment TEXT
            );
            CREATE TABLE IF NOT EXISTS students (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255),
                password VARCHAR(255)
            );
            CREATE TABLE IF NOT EXISTS documents (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255),
                category VARCHAR(255),
                fileName VARCHAR(255),
                uploadedBy VARCHAR(255),
                uploadDate VARCHAR(32)
            );
            CREATE TABLE IF NOT EXISTS constraints (
                id SERIAL PRIMARY KEY,
                resource VARCHAR(255),
                day VARCHAR(32),
                time VARCHAR(32),
                type VARCHAR(32)
            );
        `);
        // Création admin par défaut
        const { rows } = await pool.query('SELECT * FROM admins WHERE email = $1', ['farenogif@gmail.com']);
        if (rows.length === 0) {
            await pool.query('INSERT INTO admins (email, password) VALUES ($1, $2)', ['farenogif@gmail.com', 'fareno12']);
            console.log('Administrateur par défaut créé.');
        } else {
            console.log('Administrateur par défaut déjà existant.');
        }
    } catch (err) {
        console.error('Erreur lors de l\'initialisation de la base:', err.message);
    }
})();

// Utilitaires SQL
async function fetchAll(table) {
    const { rows } = await pool.query(`SELECT * FROM ${table}`);
    return rows;
}
async function fetchById(table, id) {
    const { rows } = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return rows[0];
}
async function insert(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const params = keys.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await pool.query(
        `INSERT INTO ${table} (${keys.join(',')}) VALUES (${params}) RETURNING *`, values
    );
    return rows[0];
}
async function update(table, id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(id);
    const { rows } = await pool.query(
        `UPDATE ${table} SET ${set} WHERE id = $${values.length} RETURNING *`, values
    );
    return rows[0];
}
async function remove(table, id) {
    const { rows } = await pool.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [id]);
    return rows[0];
}

// Mappage des types de ressources
const tableMap = {
    teachers: 'teachers',
    groups: 'groups',
    rooms: 'rooms',
    admins: 'admins',
    students: 'students',
    documents: 'documents',
    constraints: 'constraints'
};

// Connexion admin
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
    try {
        const { rows } = await pool.query('SELECT * FROM admins WHERE email = $1 AND password = $2', [email, password]);
        if (!rows.length) return res.status(401).json({ error: 'Identifiants incorrects' });
        res.json({ message: 'Connexion réussie', admin: { id: rows[0].id, email: rows[0].email, role: 'Administrateur' } });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
    }
});

// Déconnexion (stateless)
app.post('/api/logout', (req, res) => {
    res.json({ message: 'Déconnexion réussie' });
});

// CRUD ressources génériques
app.get('/api/resources/:type', async (req, res) => {
    const type = req.params.type;
    const table = tableMap[type];
    if (!table) return res.status(400).json({ error: 'Type invalide' });
    try {
        const data = await fetchAll(table);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
app.post('/api/resources/:type', async (req, res) => {
    const type = req.params.type;
    const table = tableMap[type];
    if (!table) return res.status(400).json({ error: 'Type invalide' });
    try {
        const newResource = await insert(table, req.body);
        res.json(newResource);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
app.put('/api/resources/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    const table = tableMap[type];
    if (!table) return res.status(400).json({ error: 'Type invalide' });
    try {
        const updated = await update(table, id, req.body);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
app.delete('/api/resources/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    const table = tableMap[type];
    if (!table) return res.status(400).json({ error: 'Type invalide' });
    try {
        await remove(table, id);
        res.json({ message: 'Ressource supprimée' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// CRUD utilisateurs (admins, teachers, students)
app.get('/api/users/:type', async (req, res) => {
    const type = req.params.type;
    const table = tableMap[type];
    if (!table) return res.status(400).json({ error: 'Type invalide' });
    try {
        const data = await fetchAll(table);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
app.post('/api/users/:type', async (req, res) => {
    const type = req.params.type;
    const table = tableMap[type];
    if (!table) return res.status(400).json({ error: 'Type invalide' });
    try {
        const newUser = await insert(table, req.body);
        res.json(newUser);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
app.put('/api/users/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    const table = tableMap[type];
    if (!table) return res.status(400).json({ error: 'Type invalide' });
    try {
        const updated = await update(table, id, req.body);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
app.delete('/api/users/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    const table = tableMap[type];
    if (!table) return res.status(400).json({ error: 'Type invalide' });
    try {
        await remove(table, id);
        res.json({ message: 'Utilisateur supprimé' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Contraintes (table constraints)
app.get('/api/constraints', async (req, res) => {
    try {
        const data = await fetchAll('constraints');
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
app.post('/api/constraints', async (req, res) => {
    try {
        const newConstraint = await insert('constraints', req.body);
        res.json(newConstraint);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
app.put('/api/constraints/:id', async (req, res) => {
    try {
        const updated = await update('constraints', req.params.id, req.body);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
app.delete('/api/constraints/:id', async (req, res) => {
    try {
        await remove('constraints', req.params.id);
        res.json({ message: 'Contrainte supprimée' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Documents (upload + CRUD)
app.get('/api/documents', async (req, res) => {
    try {
        const data = await fetchAll('documents');
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
app.post('/api/documents', upload.single('file'), async (req, res) => {
    try {
        const { title, category, uploadedBy } = req.body;
        if (!title || !category || !req.file) {
            return res.status(400).json({ error: 'Titre, catégorie et fichier requis' });
        }
        const newDocument = await insert('documents', {
            title,
            category,
            fileName: req.file.filename,
            uploadedBy: uploadedBy || 'Admin',
            uploadDate: new Date().toISOString().slice(0, 16).replace('T', ' ')
        });
        res.json(newDocument);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
app.get('/api/documents/:id/download', async (req, res) => {
    try {
        const doc = await fetchById('documents', req.params.id);
        if (!doc) return res.status(404).json({ error: 'Document non trouvé' });
        const filePath = path.join(uploadsDir, doc.filename || doc.fileName);
        res.download(filePath, doc.filename || doc.fileName, err => {
            if (err) res.status(500).json({ error: 'Erreur serveur lors du téléchargement' });
        });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
app.delete('/api/documents/:id', async (req, res) => {
    try {
        const doc = await fetchById('documents', req.params.id);
        if (!doc) return res.status(404).json({ error: 'Document non trouvé' });
        const filePath = path.join(uploadsDir, doc.filename || doc.fileName);
        fs.unlink(filePath, () => {});
        await remove('documents', req.params.id);
        res.json({ message: 'Document supprimé' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Génération automatique d'emploi du temps (exemple simple)
app.post('/api/generate-timetable', async (req, res) => {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'Date requise' });
    try {
        const teachers = await fetchAll('teachers');
        const groups = await fetchAll('groups');
        const rooms = await fetchAll('rooms');
        const constraints = await fetchAll('constraints');
        const timetable = [];
        const timeSlots = ['08:00-10:00', '10:00-12:00', '13:00-15:00', '15:00-17:00'];
        const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];

        for (const slot of timeSlots) {
            const entry = { time: slot };
            for (const day of days) {
                const availableTeachers = teachers.filter(t =>
                    !constraints.some(c =>
                        c.resource === t.name &&
                        c.day.toLowerCase() === day &&
                        c.time === slot &&
                        c.type === 'Indisponible'
                    )
                );
                const availableGroups = groups.filter(g =>
                    !constraints.some(c =>
                        c.resource === g.name &&
                        c.day.toLowerCase() === day &&
                        c.time === slot &&
                        c.type === 'Indisponible'
                    )
                );
                const availableRooms = rooms.filter(r =>
                    !constraints.some(c =>
                        c.resource === r.name &&
                        c.day.toLowerCase() === day &&
                        c.time === slot &&
                        c.type === 'Indisponible'
                    )
                );
                if (availableTeachers.length && availableGroups.length && availableRooms.length) {
                    const teacher = availableTeachers[Math.floor(Math.random() * availableTeachers.length)];
                    const group = availableGroups[Math.floor(Math.random() * availableGroups.length)];
                    const room = availableRooms[Math.floor(Math.random() * availableRooms.length)];
                    const subject = teacher.subjects ? teacher.subjects.split(', ')[0] : 'Matière';
                    entry[day] = `${subject} (${teacher.name}, ${group.name}, ${room.name})`;
                } else {
                    entry[day] = '-';
                }
            }
            timetable.push(entry);
        }
        res.json({ date, timetable });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));