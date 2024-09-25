"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const apitoolkit_1 = __importDefault(require("./apitoolkit"));
const sdk_node_1 = require("@opentelemetry/sdk-node");
const exporter_logs_otlp_grpc_1 = require("@opentelemetry/exporter-logs-otlp-grpc");
const exporter_trace_otlp_grpc_1 = require("@opentelemetry/exporter-trace-otlp-grpc");
const instrumentation_http_1 = require("@opentelemetry/instrumentation-http");
const api_1 = require("@opentelemetry/api");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const resources_1 = require("@opentelemetry/resources");
const app = (0, express_1.default)();
const config = {
    apiKey: "wKUZLJBKayszzIdJhaZsGDYc9DieSdqetLy8071Z8D8H/d7H",
    serviceName: "express-example",
    serviceVersion: "1.0.0",
    rootURL: "http://localhost:8080",
    debug: true,
    otelInstrumentated: true,
};
const apitoolkit = apitoolkit_1.default.NewClient(config);
const loggerLevel = config.debug ? api_1.DiagLogLevel.DEBUG : api_1.DiagLogLevel.NONE;
api_1.diag.setLogger(new api_1.DiagConsoleLogger(), loggerLevel);
const defaultAttributes = {
    [semantic_conventions_1.SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    [semantic_conventions_1.SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion || "1.0.0",
    environment: "production",
    "at-project-id": "00000000-0000-0000-0000-000000000000",
    // "at-api-key": "kPNLecYZO3szyYAfgqZsT2hJ9GKSStaeurruhrlboTBR9dzC",
};
const resource = new resources_1.Resource(defaultAttributes);
const logExporter = new exporter_logs_otlp_grpc_1.OTLPLogExporter({
    url: "http://localhost:4317", //grpc endpoint
});
const traceExporter = new exporter_trace_otlp_grpc_1.OTLPTraceExporter({
    url: "http://localhost:4317", // grpc endpoint
});
const httpInst = new instrumentation_http_1.HttpInstrumentation({
    requestHook: (span, request) => {
        apitoolkit.handleHTTPRequestSpan(span);
    },
});
const sdk = new sdk_node_1.NodeSDK({
    instrumentations: [httpInst],
    resource: resource,
    logRecordProcessors: [new sdk_node_1.logs.SimpleLogRecordProcessor(logExporter)],
    traceExporter,
});
sdk.start();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
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
