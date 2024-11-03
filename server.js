const express = require('express');
const app = express();
const PORT = 3030;
const mysql = require('mysql2');
const cors = require('cors');

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

app.get('/routes', (req, res) => {
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
    FROM routes
    JOIN
        stops ON routes.id = stops.route_id
    WHERE user_id = ${ownerId};`;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).send(`Ошибка при получении данных ${err}`);
    }

    const routesWithStops = results.reduce((acc, row) => {
      const routeId = row.route_id;
      if (!acc[routeId]) {
        acc[routeId] = {
          id: routeId,
          name: row.route_name,
          description: row.route_description,
          price: row.route_price,
          currency: row.route_currency,
          stops: []
        };
      }
      acc[routeId].stops.push({
        id: row.stop_id,
        title: row.stop_title,
        description: row.stop_description,
        image: row.stop_image,
        position: row.stop_position,
      });
      return acc;
    }, {});

    res.json(Object.values(routesWithStops));
  });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});