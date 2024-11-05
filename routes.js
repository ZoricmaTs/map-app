function formattedRouteWithStops(stops) {
  console.log('stops', stops)
  const route = stops.reduce((acc, row) => {
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

  return route;
}

module.exports = {formattedRouteWithStops};