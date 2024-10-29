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

Intialize apitoolkit into your project by providing `serviceName` like so:

```js
import express from 'express';
import { APIToolkit } from 'apitoolkit-express';

const apitoolkitClient = APIToolkit.NewClient({
  serviceName: '<YOUR_INSTRUMENTATION_SERVICE_NAME>'
});
```

where `<API-KEY>` is the API key which can be generated from your [apitoolkit.io](apitoolkit.io) account

#### Quick overview of the configuration parameters

In the configuration above, **only the `serviceName` field required**, but you can add the following optional fields:

{class="docs-table"} ::: | Option | Description | | ------ | ----------- | | `debug` | Set to `true` to enable debug mode. | | `tags` | A list of defined tags for your services (used for grouping and filtering data on the dashboard). | | `serviceVersion` | A defined string version of your application (used for further debugging on the dashboard). | | `redactHeaders` | A list of HTTP header keys to redact. | | `redactResponseBody` | A list of JSONPaths from the response body to redact. | | `redactRequestBody` | A list of JSONPaths from the request body to redact. | | `captureRequestBody` | default `false`, set to true if you want to capture the request body. | | `captureResponseBody` | default `false`, set to true if you want to capture the response body. | :::

<br />

> [!IMPORTANT]
>
> To learn more configuration options (redacting fields, error reporting, outgoing requests, etc.) and complete integration guide, please read this [SDK documentation](https://apitoolkit.io/docs/sdks/nodejs/expressjs/utm_campaign=devrel&utm_medium=github&utm_source=sdks_readme).
