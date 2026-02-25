const express = require('express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');

const app = express();
const port = process.env.PORT || 3000;

const openapiPath = path.join(__dirname, 'openapi.yaml');
const openapiDocument = yaml.load(fs.readFileSync(openapiPath, 'utf8'));
const nativePluginPath = path.join(
  __dirname,
  'node_modules',
  'x-openapi-flow',
  'examples',
  'swagger-ui',
  'x-openapi-flow-plugin.js'
);

app.get('/x-openapi-flow-plugin.js', (_req, res) => {
  res.sendFile(nativePluginPath);
});

app.get('/', (_req, res) => {
  res.send('x-openapi-flow local example is running. Open /docs');
});

app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiDocument, {
    customJs: '/x-openapi-flow-plugin.js',
    explorer: true,
    swaggerOptions: {
      showExtensions: true
    }
  })
);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/docs`);
});
