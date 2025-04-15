function formattedRouteWithStops(stops) {
  const route = stops.reduce((acc, row) => {
    const routeId = row.route_id;
    if (!acc[routeId]) {
      acc[routeId] = {
        id: routeId,
        name: row.route_name,
        description: row.route_description,
        price: row.route_price,
        images: row.images,
        stops: [],
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

  return Object.values(route);
}

function updateRoute({db, routeData}) {
  let changes = [];
  let vals = [];

  ['name', 'description', 'price'].forEach((key) => {
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

  return db.query(updateRouteSql, [...vals, routeData.id]);
}

function deleteRoute({db, routeId}) {
  const deleteRouteSql = `DELETE FROM routes WHERE id = ?;`

  return db.query(deleteRouteSql, [routeId]);
}

async function getRoutesWithUser({db, sort, offset, limit}) {
  const [sortedType, sortedValue] = sort.split('-');

  const query = `
    SELECT
      routes.id AS id,
      routes.name AS name,
      routes.description AS description,
      routes.price AS price,
      routes.last_update,
      JSON_OBJECT(
        'id', users.id,
        'name', users.name,
        'age', users.age,
        'role', users.role,
        'login', users.login
      ) AS user
    FROM
      routes
    JOIN
      users
    ON
      routes.user_id = users.id
    GROUP BY
      routes.id
    ORDER BY
      ${sortedType} ${sortedValue}
    LIMIT ? OFFSET ?;`
  ;

  return await db.query(query, [limit, offset]);
}

module.exports = {deleteRoute, getRoutesWithUser, formattedRouteWithStops, updateRoute};