const express = require('express');
const app = express();
const PORT = 3030;
const mysql = require('mysql2');
const mysqlPromise = require('mysql2/promise');
const cors = require('cors');
const {formattedRouteWithStops} = require('./routes');
const urlencodedParser = express.urlencoded({extended: false});
const multer = require('multer');
const mime = require('mime-types');

app.use(express.urlencoded({ extended: true }))
app.use(express.json());

app.use(cors({
  origin: 'http://localhost:3000',
  optionsSuccessStatus: 200,
}));

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Zoria2608!',
  database: 'mydatabase'
});

const storage = multer.memoryStorage(); // Хранение файлов в памяти
const upload = multer({ storage: storage });

const pool = mysqlPromise.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Zoria2608!',
  database: 'mydatabase',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.connect((err) => {
  if (err) {
    console.error('Ошибка подключения к MySQL:', err);
  } else {
    console.log('Подключено к базе данных MySQL');
  }
});

app.get('/users', (request, response) => {
  const query = 'SELECT * FROM users';

  db.query(query, (err, results) => {
    if (err) {
      return response.status(500).send('Ошибка при получении данных');
    }

    response.json(results);
  });
});

app.get('/images/:id', (request, response) => {
  const query = `
    SELECT 
      images.image_blob AS imageBlob,
      images.title AS title
    FROM images
    WHERE images.id = ${request.params.id}`;

  db.query(query, (err, results) => {
    if (err) {
      return response.status(500).send(`Ошибка при получении данных ${err}`);
    }

    if (!results.length) {
      return response.status(404).send('Не найдено');
    }

    response.writeHead(200, { 'Content-Type': mime.lookup(results[0].title)} );
    response.end(results[0].imageBlob);
  })
});

app.get('/routes', (request, response) => {
  const ownerId = request.query.id;

  const query = `
    SELECT
      routes.id AS route_id,
      routes.name AS route_name,
      routes.description AS route_description,
      routes.price AS route_price,
      routes.currency AS route_currency,
      stops.id AS stop_id,
      stops.title AS stop_title,
      stops.description AS stop_description,
      stops.image AS stop_image,
      stops.position AS stop_position
    FROM 
      routes
    JOIN
      stops ON routes.id = stops.route_id
    WHERE 
      user_id = ${ownerId};`;

  db.query(query, (err, results) => {
    if (err) {
      return response.status(500).send(`Ошибка при получении данных ${err}`);
    }

    const routesWithStops = formattedRouteWithStops(results);

    response.json(Object.values(routesWithStops));
  });
});

app.post("/add-route", upload.array('images', 5), async function (request, response) {
  if(!request.body) {
    return response.sendStatus(400);
  }

  const {userId, routeData: routeDataRaw} = request.body;
  const routeData = JSON.parse(routeDataRaw);
  const imagesData = request.files ? request.files.map(file => [file.buffer, file.originalname]) : [];

  if (Object.keys(request.body).length === 0) {
    return response.status(400).json({ error: 'Маршрут и остановки обязательны' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [routeResult] = await connection.query(
      'INSERT INTO routes (name, description, user_id) VALUES (?, ?, ?)',
      [routeData.name, routeData.description, userId]
    );

    const routeId = routeResult.insertId;

    const imagesPromises = imagesData.map(([imageBuffer, imageName]) => {
      return connection.query(
        'INSERT INTO images (title, image_blob) VALUES (?, ?)',
        [imageName, imageBuffer]
      );
    });

    const imagesResult = await Promise.all(imagesPromises);

    const imagesRouteRelationsPromises = imagesResult.map((imageResult) => {
      const imageId = imageResult[0].insertId;
      return connection.query(
        'INSERT INTO route_images (route_id, image_id) VALUES (?, ?)',
        [routeId, imageId]
      );
    });

    await Promise.all(imagesRouteRelationsPromises);

    const stopPromises = routeData.stops.map(stop => {
      const { title, description, position } = stop;

      return connection.query(
        'INSERT INTO stops (title, description, position, route_id) VALUES (?, ?, ?, ?)',
        [title, description, JSON.stringify(position), routeId]
      );
    });

    await Promise.all(stopPromises);

    await connection.commit();

    const [stopsWithRoute] = await connection.query(`
      SELECT
        routes.id AS route_id,
        routes.name AS route_name,
        routes.price AS route_price,
        routes.currency AS route_currency,
        routes.description AS route_description,
        stops.id AS stop_id,
        stops.title AS stop_title,
        stops.description AS stop_description,
        stops.position AS stop_position
      FROM
        routes
      LEFT JOIN
        stops ON routes.id = stops.route_id
      WHERE
        routes.id = ?`,
      [routeId]
    );

    const [images] = await connection.query(`
      SELECT route_images.image_id AS id
      FROM route_images
      WHERE
        route_images.route_id = ?`,
      [routeId]
    );

    stopsWithRoute.forEach(data => {
      data.images = images;
    })

    const routesWithStopsFormatted = formattedRouteWithStops(stopsWithRoute);

    response.status(201).json({ message: 'Маршрут и остановки добавлены успешно', route: routesWithStopsFormatted });

  } catch (error) {
    await connection.rollback();

    console.error(error);

    response.status(500).json({ error: 'Ошибка сервера при добавлении маршрута и остановок' });
  } finally {
    connection.release();
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});