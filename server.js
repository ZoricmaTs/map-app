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
const {addImages, removeRouteImages, removeImages} = require('./images');

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

app.get('/route', async (request, response) => {
  const routeId = request.query.id;

  let connection;

  try {
    connection = await pool.getConnection();

    await connection.beginTransaction();

  const [stopsWithRoute] = await connection.query(`
    SELECT
      routes.id AS route_id,
      routes.name AS route_name,
      routes.description AS route_description,
      routes.price AS route_price,
      routes.currency AS route_currency,
      stops.id AS stop_id,
      stops.title AS stop_title,
      stops.description AS stop_description,
      stops.position AS stop_position
    FROM 
      routes
    JOIN
      stops ON routes.id = stops.route_id
    WHERE 
      routes.id = ?;`, [routeId]
  );

    const [images] = await connection.query(`
      SELECT 
        route_images.image_id AS id
      FROM 
        route_images
      WHERE
        route_images.route_id = ?`,
      [routeId]
    );

    if (stopsWithRoute.length === 0) {
      const routeQuery = await connection.query(`
        SELECT r.*
        FROM routes r
        LEFT JOIN stops s ON r.id = s.route_id
        WHERE r.id = ${routeId} AND s.id IS NULL;`
      );

      const route =  routeQuery[0][0];
      route.images = images;

      if (!route) {
        response.status(404).send('Маршрут не найден');
      }

      return response.status(201).json({message: 'Маршрут успешно добавлен', route});
    } else {
      stopsWithRoute.forEach(data => {
        data.images = images;
      });

      const routesWithStopsFormatted = formattedRouteWithStops(stopsWithRoute)[0];

      return response.status(201).json({ message: 'Маршрут и остановки добавлены успешно', route: routesWithStopsFormatted });
    }

  } catch (err) {
    console.error('Ошибка выполнения запроса:', err);
    return response.status(500).send('Ошибка сервера');
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

app.get('/routes', (request, response) => {
  const ownerId = request.query.user_id;

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

    response.json(routesWithStops);
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

  let connection;

  try {
    connection = await pool.getConnection();

    await connection.beginTransaction();

    const [routeResult] = await connection.query(
      'INSERT INTO routes (name, description, price, currency, user_id) VALUES (?, ?, ?, ?, ?)',
      [routeData.name, routeData.description, routeData.price, routeData.currency, userId]
    );

    const routeId = routeResult.insertId;

    await addImages({images: imagesData, db: connection, routeId});

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

    const routesWithStopsFormatted = formattedRouteWithStops(stopsWithRoute)[0];

    return response.status(201).json({ message: 'Маршрут и остановки добавлены успешно', route: routesWithStopsFormatted });

  } catch (error) {
    await connection.rollback();

    console.error(error);

    return response.status(500).json({ error: 'Ошибка сервера при добавлении маршрута и остановок' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

app.put("/edit-route", upload.array('newImages', 5), async function (request, response) {
  if(!request.body) {
    return response.sendStatus(400);
  }

  const {userId, routeData: routeDataRaw} = request.body;
  const routeData = JSON.parse(routeDataRaw);
  const imagesData = request.files ? request.files.map(file => [file.buffer, file.originalname]) : [];

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    let changes = [];
    let vals = [];

    ['name', 'description', 'price', 'currency'].forEach((key) => {
      if(routeData[key] !== undefined) {
        changes.push(`${key} = ?`);
        vals.push(routeData[key]);
      }
    });

    const updateRouteSql =
      `UPDATE routes
       SET ${changes.join(', ')}
       WHERE id = ?;`
    ;

    await connection.query(updateRouteSql, [...vals, routeData.id]);

    const remainingImageIds = routeData.images?.map(({id}) => id) || [];

    if (remainingImageIds.length) {
      await removeRouteImages({imageIds: remainingImageIds, routeId: routeData.id, db: connection});
      await removeImages({db: connection});
    }

    await addImages({images: imagesData, db: connection, routeId: routeData.id});

    await connection.commit();

    return response.status(201).json({message: 'Изменения внесены в маршрут'})

  } catch (error) {
    await connection.rollback();

    console.error(error);

    return response.status(500).json({ error: 'Ошибка сервера при добавлении маршрута и остановок' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});