function addImages({images, routeId, db}) {
  const insertImageSql =
    `INSERT INTO images (title, image_blob)
        VALUES (?, ?);`
  ;
  const insertRouteImageSql =
    `INSERT INTO route_images (route_id, image_id)
        VALUES (?, ?);`
  ;

  for (let i = 0; i < images.length; i += 1) {
    db.query(insertImageSql, [images[i][1], images[i][0]]).then((result) => {
      const imageId = result[0].insertId;
      return db.query(insertRouteImageSql, [routeId, imageId]);
    });
  }
}

function removeRouteImages({imageIds, routeId, db}) {
  const deleteRouteImagesSql =
    `DELETE FROM route_images
       WHERE route_id = ? AND image_id IN (?);`
  ;

  return db.query(deleteRouteImagesSql, [routeId, imageIds]);
}

function removeImages({db}) {
  const deleteUnusedImagesSql =
    `DELETE FROM images
       WHERE id NOT IN (SELECT image_id FROM route_images);`
  ;

  return db.query(deleteUnusedImagesSql);
}

async function getImagesByRouteId({routeId, db}) {
  const query = `
      SELECT i.id
      FROM route_images ri
               JOIN images i ON ri.image_id = i.id
      WHERE ri.route_id = ?;
  `;

  try {
    const [results] = await db.query(query, [routeId]);
    return results.map(row => row.id);
  } catch (error) {
    console.error('Ошибка при получении ID картинок:', error);
    throw error;
  }
}

module.exports = {addImages, getImagesByRouteId, removeRouteImages, removeImages};