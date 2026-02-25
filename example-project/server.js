const express = require('express');
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

const app = express();
const port = process.env.PORT || 3000;
const specUrl = process.env.SWAGGER_SPEC_URL || '/swagger.json';
const baseSpecPath = path.join(__dirname, 'swagger.json');
const flowSpecPath = path.join(__dirname, 'swagger.flow.json');
const configuredSpecFile = process.env.SWAGGER_SPEC_FILE;
const defaultSpecPath = configuredSpecFile
  ? path.join(__dirname, configuredSpecFile)
  : (fs.existsSync(flowSpecPath) ? flowSpecPath : baseSpecPath);
const nativePluginPath = path.join(
  __dirname,
  'node_modules',
  'x-openapi-flow',
  'lib',
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

app.get('/swagger.json', (_req, res) => {
  res.sendFile(defaultSpecPath);
});

const swaggerUiBaseOptions = {
  customJs: '/x-openapi-flow-plugin.js',
  explorer: true,
  swaggerOptions: {
    showExtensions: true,
  }
};

const useExternalUrl = Boolean(process.env.SWAGGER_SPEC_URL);
const swaggerUiSetup = useExternalUrl
  ? swaggerUi.setup(null, {
      ...swaggerUiBaseOptions,
      swaggerOptions: {
        ...swaggerUiBaseOptions.swaggerOptions,
        url: specUrl,
      },
    })
  : swaggerUi.setup(JSON.parse(fs.readFileSync(defaultSpecPath, 'utf8')), swaggerUiBaseOptions);

app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUiSetup
);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/docs`);
});
