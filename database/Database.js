import mysql from "mysql2"
import * as dotenv from "dotenv"
import sdb8  from "mssql"
dotenv.config()
const db = mysql.createConnection({
    host: '192.168.10.12',
    user: 'wa',
    password: 'pfind@sqlserver',
    database: 'i-whatsapp'
})
const sqlConfig = {
    user: 'sa',
    password: 'voksel@16',
    database: 'dbKantin',
    server: '192.168.9.14',
    options: {
        encrypt: false, // for azure
        trustServerCertificate: false // change to true for local dev / self-signed certs
      }


  }
db.connect((err) => {
    if (err)
    {
        throw err
    }
    else
    {
    console.log('database terhubung.')
    }
})
sdb8.connect(sqlConfig, err => {

    if (err)
    {
         throw err
    }
    else
    {
    console.log('database terhubung MTSQ.')
    }
})
export { db, sdb8}
