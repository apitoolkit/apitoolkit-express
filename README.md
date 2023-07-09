<p>
<img src="https://apitoolkit.io/assets/img/logo-full.svg" alt="APIToolkit" width="250px" />
</p>

## APIToolkit expressjs integration.

The NODEJS SDK integration guide for APIToolkit. It monitors incoming traffic, gathers the requests and sends the request to the apitoolkit servers.

### Installation

Run the following command to install the package from your projects root:

```sh
npm install apitoolkit-express

```

### Project setup

Intialize apitoolkit into your project is as simple as :

```js
const apitoolkitClient = await APIToolkit.NewClient({ apiKey: '<API-KEY>' });
```
where ```<API-KEY>``` is the API key which can be generated from your  [apitoolkit.io](apitoolkit.io) accoun

Next, you can use the apitoolkit middleware for your respective routing library.

Eg, for express JS, your final code would look like:

```js
app.use(apitoolkitClient.expressMiddleware);
```

where app is your express js instance.

Your final could might look something like this:

```js
const express = require('express');
const app = express();
const port = 3000;

const apitoolkitClient = await APIToolkit.NewClient({ apiKey: '<API-KEY>' });
app.use(apitoolkitClient.expressMiddleware);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
```

## Redacting Senstive Fields and Headers

While it's possible to mark a field as redacted from the apitoolkit dashboard, this client also supports redacting at the client side. Client side redacting means that those fields would never leave your servers at all. So you feel safer that your sensitive data only stays on your servers.

To mark fields that should be redacted, simply add them to the apitoolkit config object. Eg:

```js
const express = require('express');
const app = express();
const port = 3000;

const apitoolkitClient = await APIToolkit.NewClient({
  apiKey: '<API-KEY>',
  redactHeaders: ['Content-Type', 'Authorization', 'Cookies'], // Specified headers will be redacted
  redactRequestBody: ['$.credit-card.cvv', '$.credit-card.name'], // Specified request bodies fields will be redacted
  redactResponseBody: ['$.message.error'], // Specified response body fields will be redacted
});
app.use(apitoolkitClient.expressMiddleware);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
```

It is important to note that while the `redactHeaders` config field accepts a list of headers(case insensitive), the `redactRequestBody` and `redactResponseBody` expect a list of JSONPath strings as arguments.

The choice of JSONPath was selected to allow you have great flexibility in descibing which fields within your responses are sensitive. Also note that these list of items to be redacted will be aplied to all endpoint requests and responses on your server. To learn more about jsonpath to help form your queries, please take a look at this cheatsheet: https://lzone.de/cheat-sheet/JSONPath
