function formattedRouteWithStops(stops) {
  const route = stops.reduce((acc, row) => {
    const routeId = row.route_id;
    if (!acc[routeId]) {
      acc[routeId] = {
        id: routeId,
        name: row.route_name,
        description: row.route_description,
        price: row.route_price,
        currency: row.route_currency,
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

  return db.query(updateRouteSql, [...vals, routeData.id]);
}

function deleteRoute({db, routeId}) {
  const deleteRouteSql = `DELETE FROM routes WHERE id = ?;`

  return db.query(deleteRouteSql, [routeId]);
}

module.exports = {deleteRoute, formattedRouteWithStops, updateRoute};