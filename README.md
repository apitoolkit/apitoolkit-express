## APIToolkit nodejs integration.

The NODEJS SDK integration guide for APIToolkit. It monitors incoming traffic, gathers the requests and sends the request to the apitoolkit servers.

### Installation

Run the following command to install the package from your projects root:

```sh
npm install apitoolkit-js

```

### Project setup
Intialize apitoolkit into your project is as simple as : 

```js
const apitoolkitClient = await APIToolkit.initialize("<API-KEY>")

```
where ```<API-KEY>``` is the API key which can be generated from your  [apitoolkit.io](apitoolkit.io) account.

Next, you can use the apitoolkit middleware for your respective routing library. 

Eg, for express JS, your final code would look like:

```js
app.use(apitoolkitClient.expressMiddleware);

```
where app is your express js instance. 



Your final could might look something like this:


```js
const express = require('express')
const app = express()
const port = 3000

const apitoolkitClient = await APIToolkit.initialize("<API-KEY>")
app.use(apitoolkitClient.expressMiddleware.bind(apitoolkitClient));

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
```
