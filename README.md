<p>
<img src="https://apitoolkit.io/assets/img/logo-full.svg" alt="APIToolkit" width="250px" />
</p>

APIToolkit Express Middleware is a middleware that can be used to monitor HTTP requests. It is provides additional functionalities on top of the open telemetry instrumentation which creates a custom span for each request capturing details about the request including request and response bodies.

### Installation

Run the following command to install the express js package from your projects root:

```sh
npm install apitoolkit-express

```

### Project setup

Intialize apitoolkit into your project like so:

```js
import express from 'express';
import { APIToolkit } from 'apitoolkit-express';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(APIToolkit.middleware());

app.get('/hello/:name', (req, res) => {
  res.json({ message: `Hello ${req.params.name}!` });
});

// comes after all other route handlers
app.use(APIToolkit.errorMiddleware());

app.listen(3000, () => {
  console.log('Server started on port 3000');
});
```

#### Quick overview of the configuration parameters

An object with the following optional fields can be passed to the middleware to configure it:

| Option                | Description                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `debug`               | Set to `true` to enable debug mode.                                                               |
| `serviceName`         | A defined string name of your application.                                                        |
| `tags`                | A list of defined tags for your services (used for grouping and filtering data on the dashboard). |
| `serviceVersion`      | A defined string version of your application (used for further debugging on the dashboard).       |
| `redactHeaders`       | A list of HTTP header keys to redact.                                                             |
| `redactResponseBody`  | A list of JSONPaths from the response body to redact.                                             |
| `redactRequestBody`   | A list of JSONPaths from the request body to redact.                                              |
| `captureRequestBody`  | Default `false`, set to `true` if you want to capture the request body.                           |
| `captureResponseBody` | Default `false`, set to `true` if you want to capture the response body.                          |

### Usage with configuration parameters

```js
import express from 'express';
import { APIToolkit } from 'apitoolkit-express';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  APIToolkit.middleware({
    serviceName: 'my-service',
    redactHeaders: ['authorization', 'cookie'],
    redactResponseBody: ['$.creditCardNumber'], // jsonpath to redact credit card number from response body
    redactRequestBody: ['$.password'], // jsonpath to redact password from request body
    captureRequestBody: true,
    captureResponseBody: true
  })
);

app.get('/hello/:name', (req, res) => {
  res.json({ message: `Hello ${req.params.name}!` });
});

app.listen(3000, () => {
  console.log('Server started on port 3000');
});
```

<br />

> [!IMPORTANT]
>
> To learn more configuration options (redacting fields, error reporting, outgoing requests, etc.) and complete integration guide, please read this [SDK documentation](https://apitoolkit.io/docs/sdks/nodejs/expressjs/utm_campaign=devrel&utm_medium=github&utm_source=sdks_readme).
