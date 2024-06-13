<div align="center">

![APItoolkit's Logo](https://github.com/apitoolkit/.github/blob/main/images/logo-white.svg?raw=true#gh-dark-mode-only)
![APItoolkit's Logo](https://github.com/apitoolkit/.github/blob/main/images/logo-black.svg?raw=true#gh-light-mode-only)

## ExpressJS SDK

[![APItoolkit SDK](https://img.shields.io/badge/APItoolkit-SDK-0068ff?logo=express)](https://github.com/topics/apitoolkit-sdk) [![](https://img.shields.io/npm/v/apitoolkit-express.svg?logo=npm)](https://npmjs.com/package/apitoolkit-express) [![](https://img.shields.io/npm/dw/apitoolkit-express)](https://npmjs.com/package/apitoolkit-expresss) [![Join Discord Server](https://img.shields.io/badge/Chat-Discord-7289da)](https://discord.gg/dEB6EjQnKB) [![APItoolkit Docs](https://img.shields.io/badge/Read-Docs-0068ff)](https://apitoolkit.io/docs/sdks/nodejs/expressjs?utm_source=github-sdks)

APItoolkit is an end-to-end API and web services management toolkit for engineers and customer support teams. To integrate your ExpressJS application with APItoolkit, you need to use this SDK to monitor incoming traffic, aggregate the requests, and then deliver them to the APItoolkit's servers.

</div>

---

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Contributing and Help](#contributing-and-help)
- [License](#license)

---

## Installation

Kindly run the command below to install the SDK:

```sh
npm install apitoolkit-express
```

## Configuration

Next, initialize APItoolkit in your application's entry point (e.g., `index.js`) like so:

```js
import { APIToolkit } from 'apitoolkit-express';

const apitoolkitClient = APIToolkit.NewClient({ apiKey: '<API-KEY>' });
```

where `<API-KEY>` is the API key which can be generated from your [apitoolkit.io](apitoolkit.io) accoun

Next, you can use the apitoolkit middleware for your respective routing library.

Eg, for express JS, your final code would look like:

```js
app.use(apitoolkitClient.expressMiddleware);
```

where app is your express js instance.

Your final could might look something like this especially on typescript:

```js
import { APIToolkit } from 'apitoolkit-express';
import express from 'express';

const app = express();
const port = 3000;
const apitoolkit = APIToolkit.NewClient({
  apiKey: '<API-KEY>', // Required: API Key generated from apitoolkit dashboard
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(apitoolkit.expressMiddleware);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// The error handler must be before any other error middleware and after all controllers
app.use(apitoolkitClient.errorHandler);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
```

Common js:

```js
const { APIToolkit } = require('apitoolkit-express');
const express = require('express');

const app = express();
const port = 3000;
const apitoolkit = APIToolkit.NewClient({
  apiKey: '<API-KEY>', // Required: API Key generated from apitoolkit dashboard
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(apitoolkit.expressMiddleware);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// The error handler must be before any other error middleware and after all controllers
app.use(apitoolkitClient.errorHandler);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
```

## Redacting Senstive Fields and Headers

While it's possible to mark a field as redacted from the apitoolkit dashboard, this client also supports redacting at the client side. Client side redacting means that those fields would never leave your servers at all. So you feel safer that your sensitive data only stays on your servers.

To mark fields that should be redacted, simply add them to the apitoolkit config object. Eg:

```js
const express = require('express');
import APIToolkit from 'apitoolkit-express';

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const apitoolkitClient = APIToolkit.NewClient({
  apiKey: '<API-KEY>',
  redactHeaders: ['Content-Type', 'Authorization', 'Cookies'], // Specified headers will be redacted
  redactRequestBody: ['$.credit-card.cvv', '$.credit-card.name'], // Specified request bodies fields will be redacted
  redactResponseBody: ['$.message.error'], // Specified response body fields will be redacted
});
app.use(apitoolkitClient.expressMiddleware);
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// The error handler must be before any other error middleware and after all controllers
app.use(apitoolkitClient.errorHandler);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
```

It is important to note that while the `redactHeaders` config field accepts a list of headers(case insensitive), the `redactRequestBody` and `redactResponseBody` expect a list of JSONPath strings as arguments.

The choice of JSONPath was selected to allow you have great flexibility in descibing which fields within your responses are sensitive. Also note that these list of items to be redacted will be aplied to all endpoint requests and responses on your server. To learn more about jsonpath to help form your queries, please take a look at this cheatsheet: https://lzone.de/cheat-sheet/JSONPath

## Handling File Uploads with Formidable

Working with file uploads using the `multer` package is quite straightforward and requires no manual intervention, making it seamless to send multipart/form-data requests to APIToolkit.

However, if you choose to employ `formidable` for managing file uploads, a more hands-on approach becomes necessary to ensure proper data transmission to APIToolkit. Without manual intervention, no data is dispatched, potentially hindering the accurate monitoring of the endpoint. To enable this functionality, developers must attach both the `fields` and `files` extracted from the `form.parse` method to the request object.

For instance:

```js
import express from 'express';
import { APIToolkit } from 'apitoolkit-express';
import formidable from 'formidable';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const app = express();
const client = APIToolkit.NewClient({
  apiKey: '<API_KEY>',
});

app.use(client.expressMiddleware);

app.post('/upload-formidable', (req, res, next) => {
  const form = formidable({});
  form.parse(req, (err, fields, files) => {
    // Attach fields to request body
    req.body = fields;
    // Attach files
    req.files = files;

    res.json({ message: 'Uploaded successfully' });
  });
});

// The error handler must be before any other error middleware and after all controllers
app.use(apitoolkitClient.errorHandler);

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
```

## Using APIToolkit to Monitor Axios-Based Outgoing Requests

### Global Monitoring of Axios Requests

To enable global monitoring of all Axios requests with APIToolkit, add you `axios` import into the `NewClient` options.

Example:

```typescript
import APIToolkit from 'apitoolkit-express';
import axios from 'axios';
import express from 'express';

const app = express();
const apitoolkitClient = APIToolkit.NewClient({ apiKey: '<API-KEY>', monitorAxios: axios });
app.use(apitoolkitClient.expressMiddleware);

app.get('/', async (req, res) => {
  // This Axios request will be monitored and logged in the APIToolkit log explorer
  const response = await axios.get(`${baseURL}/users/123`);
  res.send(response.data);
});
```

### Monitoring a Specific Axios Request

To monitor a specific Axios request, use the `observeAxios` function from APIToolkit. This approach offers greater flexibility, such as specifying URL path patterns for requests with dynamic paths.

Example:

```typescript
import APIToolkit, { observeAxios } from 'apitoolkit-express';
import axios from 'axios';
import express from 'express';

const app = express();
const apitoolkitClient = APIToolkit.NewClient({ apiKey: '<API-KEY>' });
app.use(apitoolkitClient.expressMiddleware);

app.get('/', async (req, res) => {
  // This specific Axios request will be monitored
  const response = await observeAxios(axios).get(`${baseURL}/users/123`);
  res.send(response.data);
});
```

By following these steps, you can efficiently monitor your `axios` requests using APIToolkit, whether you want to observe all requests globally or just specific ones.

### Monitoring request with dynamic paths

If you're making requests to endpoints which have variable urlPaths, you should include a wildcard url of the path, so that apitoolkit groups the endpoints correctly for you on the dashboardL:

```typescript
import { observeAxios } from 'apitoolkit-express';
import axios from 'axios';
import express from 'express';

const app = express();
const apitoolkitClient = APIToolkit.NewClient({ apiKey: '<API-KEY>' });
app.use(apitoolkitClient.expressMiddleware);

app.get('/', (req, res) => {
    const response = await observeAxios(axios,'/users/{user_id}').get(`${baseURL}/users/123`);
    res.send(response.data);
  }
});
```

There are other optional arguments you could pass on to the `observeAxios` function, eg:

```typescript
import { observeAxios } from 'apitoolkit-express';
import axios from 'axios';

const redactHeadersList = ['Content-Type', 'Authorization'];
const redactRequestBodyList = ['$.body.bla.bla'];
const redactResponseBodyList = undefined;
const response = await observeAxios(
  axios,
  '/users/{user_id}',
  redactHeadersList,
  redactRequestBodyList,
  redactResponseBodyList
).get(`${baseURL}/users/user1234`);
```

Note that you can ignore any of these arguments except the first argument which is the axios instance to observe.
For the other arguments, you can either skip them if at the end, or use undefined as a placeholder.

### Observing request outside incoming request context

Monitoring outgoing requests inside an incoming request' context
associates both request in the dashboard. You can also monitor
outgoing requests outside an incoming requests' context
in a background job for example. To achieve this, instead of calling `observeAxios` as a standalone function
use the method on the APIToolkit client after initialization

#### Example

```js
import axios from 'axios';
import { APIToolkit } from 'apitoolkit-express';

const apitoolkitClient = APIToolkit.NewClient({
  apiKey: '<API_KEY>',
});
// using the above initialized client,
// you can monitor outgoing requests anywhere in your application.

const response = await apitoolkitClient.observeAxios(axios).get(`${baseURL}/ping`);
console.log(response.data);
```

The above request will show in the log explorer as a standalone outgoing request

## Reporting errors to APIToolkit

APIToolkit detects a lot of API issues automatically, but it's also valuable to report and track errors. This helps you associate more details about the backend with a given failing request.
If you've used sentry, or rollback, or bugsnag, then you're likely aware of this functionality.

To enable automatic error reporting, add the APIToolkit `errorHandler` middleware immediately after your app's controllers and APIToolkit will handle all uncaught errors that happened during a request and associate the error to that request.

```typescript
import { APIToolkit, ReportError } from 'apitoolkit-express';
import express from 'express';
import axios from 'axios';

const app = express();
const port = 3000;
const apitoolkitClient = APIToolkit.NewClient({ apiKey: '<API-KEY>' });
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(apitoolkitClient.expressMiddleware);

// All controllers should live here
app.get('/', (req, res) => {});
// end of your app's controllers

// The error handler must be before any other error middleware and after all controllers
app.use(apitoolkitClient.errorHandler);
```

Or manually report errors within the context of a web request, by calling the ReportError function.

```typescript
import { APIToolkit, ReportError } from 'apitoolkit-express';
import express from 'express';
import axios from 'axios';

const app = express();
const port = 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const apitoolkitClient = APIToolkit.NewClient({ apiKey: '<API-KEY>' });
app.use(apitoolkitClient.expressMiddleware);

app.get('/', (req, res) => {
  try {
    const response = await observeAxios(axios).get(`${baseURL}/ping`);
    res.send(response);
  } catch (error) {
    ReportError(error);
    res.send('Something went wrong');
  }
});
```

This works automatically from within a web request which is wrapped by the apitoolkit middleware. But if called from a background job, ReportError will not know how to actually Report the Error.
In that case, you can call ReportError, but on the apitoolkit client, instead.

```js
import { APIToolkit, ReportError } from 'apitoolkit-express';
import express from 'express';
import axios from 'axios';

const app = express();
const port = 3000;

const apitoolkitClient = APIToolkit.NewClient({ apiKey: '{ENTER_YOUR_API_KEY_HERE}' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(apitoolkitClient.expressMiddleware);

app.get('/', (req, res) => {
  res.json({ hello: 'Hello world!' });
});

app.use(apitoolkitClient.errorHandler);

app.listen(port, () => console.log('App running on port: ' + port));
```

> [!NOTE]
>
> - The `{ENTER_YOUR_API_KEY_HERE}` demo string should be replaced with the [API key](https://apitoolkit.io/docs/dashboard/settings-pages/api-keys?utm_source=github-sdks) generated from the APItoolkit dashboard.
> - The `apitoolkitClient.errorHandler` must be after all controllers and before any other error middleware.

<br />

> [!IMPORTANT]
>
> To learn more configuration options (redacting fields, error reporting, outgoing requests, etc.), please read this [SDK documentation](https://apitoolkit.io/docs/sdks/nodejs/expressjs?utm_source=github-sdks).

## Contributing and Help

To contribute to the development of this SDK or request help from the community and our team, kindly do any of the following:

- Read our [Contributors Guide](https://github.com/apitoolkit/.github/blob/main/CONTRIBUTING.md).
- Join our community [Discord Server](https://discord.gg/dEB6EjQnKB).
- Create a [new issue](https://github.com/apitoolkit/apitoolkit-dotnet/issues/new/choose) in this repository.

## License

This repository is published under the [MIT](LICENSE) license.

---

<div align="center">
    
<a href="https://apitoolkit.io?utm_source=github-sdks" target="_blank" rel="noopener noreferrer"><img src="https://github.com/apitoolkit/.github/blob/main/images/icon.png?raw=true" width="40" /></a>

</div>
