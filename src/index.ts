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
  apiKey: "kPNLecYZO3szyYAfgqZsT2hJ9GKSStaeurruhrlboTBR9dzC",
  serviceName: "express-example",
  serviceVersion: "1.0.0",
  debug: true,
  otelInstrumentated: false,
};
const apitoolkit = APIToolkit.NewClient(config);

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
