const express = require('express');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

const app = express();
const port = process.env.PORT || 3000;
const specUrl = process.env.SWAGGER_SPEC_URL || '/swagger.json';
const nativePluginPath = path.join(
  __dirname,
  'node_modules',
  'x-openapi-flow',
  'examples',
  'swagger-ui',
  'x-openapi-flow-plugin.js'
);

app.use(express.static(__dirname));

app.get('/x-openapi-flow-plugin.js', (_req, res) => {
  res.sendFile(nativePluginPath);
});

app.get('/', (_req, res) => {
  res.send('x-openapi-flow local example is running. Open /docs');
});

app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(null, {
    customJs: '/x-openapi-flow-plugin.js',
    explorer: true,
    swaggerOptions: {
      showExtensions: true,
      url: specUrl
    }
  })
);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/docs`);
});
