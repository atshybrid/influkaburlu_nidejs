require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./src/models');
const routes = require('./src/routes');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./src/openapi.json');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi));

const PORT = process.env.PORT || 4000;
db.sequelize.authenticate()
  .then(() => db.sequelize.sync())
  .then(() => {
    console.log('Database connected and synced');
    app.listen(PORT, '127.0.0.1', () => {
      console.log('Server running on port', PORT);
      console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
    });
  })
  .catch(err => {
    console.error('Unable to connect to DB:', err);
  });
