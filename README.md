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

Intialize apitoolkit into your project by providing `apikey` and `tracer` like so:

```js
import express from "express";
import { logs, NodeSDK } from "@opentelemetry/sdk-node";
import { APIToolkit } from "apitoolkit-express";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  trace,
} from "@opentelemetry/api";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { Resource } from "@opentelemetry/resources";

const loggerLevel = DiagLogLevel.DEBUG;
diag.setLogger(new DiagConsoleLogger(), loggerLevel);

const defaultAttributes = {
  [SemanticResourceAttributes.SERVICE_NAME]: "apitoolkit-js-express",
  [SemanticResourceAttributes.SERVICE_VERSION]: "1.0.0",
  environment: "production",
  "at-api-key": "<API-KEY>",
};

const resource = new Resource(defaultAttributes);

const logExporter = new OTLPLogExporter({
  url: "http://otelcol.apitoolkit.io:4317",
});

const traceExporter = new OTLPTraceExporter({
  url: "http://otelcol.apitoolkit.io:4317",
});

const sdk = new NodeSDK({
  resource: resource,
  logRecordProcessors: [new logs.SimpleLogRecordProcessor(logExporter)],
  traceExporter,
});
sdk.start();

const tracer = trace.getTracer("example-app");

const apitoolkitClient = APIToolkit.NewClient({ apiKey: "<API-KEY>", tracer });
```

where `<API-KEY>` is the API key which can be generated from your [apitoolkit.io](apitoolkit.io) account

#### Quick overview of the configuration parameters

In the configuration above, **only the `apiKey` and `tracer` fields required**, but you can add the following optional fields:

{class="docs-table"}
:::
| Option | Description |
| ------ | ----------- |
| `debug` | Set to `true` to enable debug mode. |
| `tags` | A list of defined tags for your services (used for grouping and filtering data on the dashboard). |
| `serviceVersion` | A defined string version of your application (used for further debugging on the dashboard). |
| `redactHeaders` | A list of HTTP header keys to redact. |
| `redactResponseBody` | A list of JSONPaths from the response body to redact. |
| `redactRequestBody` | A list of JSONPaths from the request body to redact. |
| `captureRequestBody` | default `false`, set to true if you want to capture the request body. |
| `captureResponseBody` | default `false`, set to true if you want to capture the response body. |
:::

```=html
<hr />
<a href="https://github.com/apitoolkit/apitoolkit-express" target="_blank" rel="noopener noreferrer" class="w-full btn btn-outline link link-hover">
    <i class="fa-brands fa-github"></i>
    Explore the ExpressJS SDK
</a>
```
