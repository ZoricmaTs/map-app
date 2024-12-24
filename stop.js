function removeStops({db, stopsToDelete}) {
  const deleteStopsSql =
    `DELETE FROM stops
    WHERE id IN (?);`
  ;

  return db.query(deleteStopsSql, [stopsToDelete]);
}

function filterStopsForDeletion(existingStops, updatedStops) {
  const updatedStopIds = updatedStops.map(stop => stop.id).filter(id => id);

  return existingStops
    .filter(stop => !updatedStopIds.includes(stop.id))
    .map(stop => stop.id);
}

function updateStops({db, stopsToUpdate}) {
  const updateStopSql =
    `UPDATE stops
     SET title = ?, position = ?, description = ?
     WHERE id = ?;`
  ;

  const stopPromises = stopsToUpdate.map((stop) => {
    return db.query(updateStopSql, [stop.title,  JSON.stringify(stop.position), stop.description, stop.id]);
  })

  return Promise.all(stopPromises);
}

function addStops({db, stops, routeId}) {
  const addStopSql =
    `INSERT INTO stops (route_id, title, position, description)
     VALUES (?, ?, ?, ?);`
  ;

  const stopPromises = stops.map((stop) => {
    return db.query(addStopSql, [routeId, stop.title, JSON.stringify(stop.position), stop.description]);
  })

  return Promise.all(stopPromises);
}

module.exports = {addStops, filterStopsForDeletion, removeStops, updateStops};