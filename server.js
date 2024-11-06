const express = require('express');
const app = express();
const PORT = 3030;
const mysql = require('mysql2');
const mysqlPromise = require('mysql2/promise');
const cors = require('cors');
const {formattedRouteWithStops} = require('./routes');
const urlencodedParser = express.urlencoded({extended: false});

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

app.get('/users', (req, res) => {
  const query = 'SELECT * FROM users';

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).send('Ошибка при получении данных');
    }
    res.json(results);
  });
});

app.get('/routes', (req, response) => {
  const ownerId = req.query.id;

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

app.post("/add-route", urlencodedParser, async function (request, response) {
  if(!request.body) {
    return response.sendStatus(400);
  }

  const {userId, route} = request.body;

  if (Object.keys(request.body).length === 0) {
    return response.status(400).json({ error: 'Маршрут и остановки обязательны' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [routeResult] = await connection.query(
      'INSERT INTO routes (name, description, user_id) VALUES (?, ?, ?)',
      [route.name, route.description, userId]
    );

    const routeId = routeResult.insertId;

    const stopPromises = route.stops.map(stop => {
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