const mysql = require('mysql2');

function getConnection(dbName) {
  return mysql.createConnection({
    host: '142.132.248.161',
    user: 'masterbe_admin',
    password: 'RMK@1987',
    database: 'masterbe_rmk',
    port: 3306
  });
}

module.exports = getConnection;
