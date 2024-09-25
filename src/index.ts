import express from "express";
import APIToolkit, { Config } from "./apitoolkit";
import { logs, NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ClientRequest, IncomingMessage } from "http";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { Resource } from "@opentelemetry/resources";
const app = express();
const config: Config = {
  apiKey: "wKUZLJBKayszzIdJhaZsGDYc9DieSdqetLy8071Z8D8H/d7H",
  serviceName: "express-example",
  serviceVersion: "1.0.0",
  rootURL: "http://localhost:8080",
  debug: true,
  otelInstrumentated: true,
};
const apitoolkit = APIToolkit.NewClient(config);

const loggerLevel = config.debug ? DiagLogLevel.DEBUG : DiagLogLevel.NONE;
diag.setLogger(new DiagConsoleLogger(), loggerLevel);

const defaultAttributes = {
  [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
  [SemanticResourceAttributes.SERVICE_VERSION]:
    config.serviceVersion || "1.0.0",
  environment: "production",
  "at-project-id": "00000000-0000-0000-0000-000000000000",
  // "at-api-key": "kPNLecYZO3szyYAfgqZsT2hJ9GKSStaeurruhrlboTBR9dzC",
};

const resource = new Resource(defaultAttributes);

const logExporter = new OTLPLogExporter({
  url: "http://localhost:4317", //grpc endpoint
});

const traceExporter = new OTLPTraceExporter({
  url: "http://localhost:4317", // grpc endpoint
});
const httpInst = new HttpInstrumentation({
  requestHook: (span, request: ClientRequest | IncomingMessage) => {
    apitoolkit.handleHTTPRequestSpan(span);
  },
});
const sdk = new NodeSDK({
  instrumentations: [httpInst],
  resource: resource,
  logRecordProcessors: [new logs.SimpleLogRecordProcessor(logExporter)],
  traceExporter,
});
sdk.start();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(apitoolkit.expressMiddleware);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/hello", (req, res) => {
  res.send("Hello World!");
});
app.post("/user/:name", (req, res) => {
  res.send("Hello " + req.params.name);
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
