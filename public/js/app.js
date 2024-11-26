const express = require('express');
const session = require('express-session');
const path = require('path');
const authController = require('./authcontroller');
const multer = require('multer');

require('dotenv').config(); // Cargar las variables de entorno

const { Pool } = require('pg'); // Importar el módulo pg para PostgreSQL

// Configurar el pool de conexiones usando las variables de entorno
const pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});


const app = express();

app.use(express.json());
app.use(session({
    secret: 'tu_clave_secreta',
    resave: false,
    saveUninitialized: true
}));

function ensureRole(role) {
    return (req, res, next) => {
        if (req.session.user && req.session.user.role === role) {
            next();
        } else {
            res.status(403).send('Acceso denegado');
        }
    };
}

// Ruta de inicio de sesión
app.post('/auth/login', authController.login);

// Ruta protegida para admin.html
app.get('/dashboard/admin', ensureRole('admin'), (req, res) => {
    res.sendFile(path.join(__dirname, '../admin.html'));
});

// Ruta protegida para maestro.html
app.get('/dashboard/maestro', ensureRole('maestro'), (req, res) => {
    res.sendFile(path.join(__dirname, '../maestro.html')); 
});

// Configuración de multer para manejar la carga de archivos
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware para servir archivos estáticos
app.use(express.static('public'));


// Ruta para subir un archivo PDF
app.post('/upload', upload.single('pdf'), async (req, res) => {
    try {
        const { title } = req.body;
        const file = req.file.buffer; // Archivo PDF en formato buffer
        const result = await pool.query(
            'INSERT INTO pdf_files (title, file) VALUES ($1, $2) RETURNING *',
            [title, file]
        );
        res.json({ message: 'Archivo subido con éxito', pdf: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al subir el archivo' });
    }
});

// Ruta para obtener y mostrar un archivo PDF por su ID
app.get('/pdf/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM pdf_files WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }

        const pdfFile = result.rows[0];
        res.contentType('application/pdf');
        res.send(pdfFile.file);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener el archivo' });
    }
});

app.get('/pdfs', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, title FROM pdf_files');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener los archivos' });
    }
});

app.listen(3000, () => {
    console.log('Servidor escuchando en el puerto 3000');
});
