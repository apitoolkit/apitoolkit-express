"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findMatchedRoute = void 0;
const sync_fetch_1 = __importDefault(require("sync-fetch"));
const sdk_node_1 = require("@opentelemetry/sdk-node");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const api_1 = require("@opentelemetry/api");
const exporter_logs_otlp_grpc_1 = require("@opentelemetry/exporter-logs-otlp-grpc");
const exporter_trace_otlp_grpc_1 = require("@opentelemetry/exporter-trace-otlp-grpc");
const payload_1 = require("apitoolkit-js/lib/payload");
const instrumentation_http_1 = require("@opentelemetry/instrumentation-http");
class APIToolkit {
    constructor(config, apiKey, projectId) {
        this.currentSpan = [];
        this.config = config;
        if (projectId) {
            this.project_id = projectId;
            if (!config.otelInstrumentated) {
                const loggerLevel = config.debug
                    ? api_1.DiagLogLevel.DEBUG
                    : api_1.DiagLogLevel.NONE;
                api_1.diag.setLogger(new api_1.DiagConsoleLogger(), loggerLevel);
                const defaultAttributes = {
                    [semantic_conventions_1.SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
                    [semantic_conventions_1.SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion || "1.0.0",
                    environment: "production",
                    "at-project-id": projectId,
                    "at-api-key": apiKey,
                };
                const resource = new resources_1.Resource(defaultAttributes);
                const logExporter = new exporter_logs_otlp_grpc_1.OTLPLogExporter({
                    url: "http://otelcol.apitoolkit.io:4317",
                });
                const traceExporter = new exporter_trace_otlp_grpc_1.OTLPTraceExporter({
                    url: "http://otelcol.apitoolkit.io:4317",
                });
                const httpInst = new instrumentation_http_1.HttpInstrumentation({
                    requestHook: (span, request) => {
                        this.updateCurrentSpan(span);
                    },
                });
                const sdk = new sdk_node_1.NodeSDK({
                    instrumentations: [httpInst],
                    resource: resource,
                    logRecordProcessors: [new sdk_node_1.logs.SimpleLogRecordProcessor(logExporter)],
                    traceExporter,
                });
                this.otelSDk = sdk;
                sdk.start();
            }
        }
        this.expressMiddleware = this.expressMiddleware.bind(this);
        this.updateCurrentSpan = this.updateCurrentSpan.bind(this);
    }
    updateCurrentSpan(span) {
        this.currentSpan?.push(span);
    }
    handleHTTPRequestSpan(span) {
        this.updateCurrentSpan(span);
    }
    expressMiddleware(req, res, next) {
        if (this.project_id === undefined) {
            console.log("APIToolkit: expressMiddleware called, but apitoolkit was not correctly setup. Doing nothing.");
            next();
            return;
        }
        let span;
        if (this.tracer) {
            span = this.tracer.startSpan("HTTP");
        }
        else {
            span = this.currentSpan?.shift();
            // default Http auto instrumentation doesn't get reported otherwise
            const tracer = api_1.trace.getTracer(this.config.serviceName);
            const sp = tracer.startSpan("express-request");
            sp.end();
        }
        if (this.config?.debug) {
            console.log("APIToolkit: expressMiddleware called");
        }
        let respBody = "";
        const oldSend = res.send;
        res.send = (val) => {
            respBody = val;
            return oldSend.apply(res, [val]);
        };
        const onRespFinished = (req, res) => () => {
            res.removeListener("close", onRespFinished(req, res));
            res.removeListener("error", onRespFinished(req, res));
            res.removeListener("finish", onRespFinished(req, res));
            try {
                let reqBody = "";
                if (req.body) {
                    try {
                        if (req.is("multipart/form-data")) {
                            if (req.file) {
                                req.body[req.file.fieldname] = `[${req.file.mimetype}_FILE]`;
                            }
                            else if (req.files) {
                                if (!Array.isArray(req.files)) {
                                    for (const file in req.files) {
                                        req.body[file] = req.files[file].map((f) => `[${f.mimetype}_FILE]`);
                                    }
                                }
                                else {
                                    for (const file of req.files) {
                                        req.body[file.fieldname] = `[${file.mimetype}_FILE]`;
                                    }
                                }
                            }
                        }
                        reqBody = JSON.stringify(req.body);
                    }
                    catch {
                        reqBody = String(req.body);
                    }
                }
                let url_path = req.route?.path || "";
                if (url_path == "" && req.method.toLowerCase() !== "head") {
                    url_path = (0, exports.findMatchedRoute)(req.app, req.method, req.originalUrl);
                }
                else if (req.baseUrl && req.baseUrl != "") {
                    if (req.originalUrl.startsWith(req.baseUrl)) {
                        url_path = req.baseUrl + url_path;
                    }
                    else {
                        url_path = (0, exports.findMatchedRoute)(req.app, req.method, req.originalUrl);
                    }
                }
                if (span) {
                    if (url_path !== "") {
                        span.updateName(`${req.method} ${url_path}`);
                    }
                    span.setAttribute("http.route", url_path);
                    span.setAttribute("http.request.method", req.method);
                    span.setAttribute("http.response.status_code", res.statusCode);
                    span.setAttribute("http.request.query_params", JSON.stringify(req.query));
                    span.setAttribute("http.request.path_params", JSON.stringify(req.params));
                    span.setAttribute("http.apt.sdk_type", "JsExpress");
                    const reqHeaders = Object.entries(req.headers);
                    reqHeaders.forEach(([header, value]) => {
                        const isRedacted = this.config.redactHeaders?.some((h) => h.toLowerCase() === header.toLowerCase() ||
                            ["cookie", "authorization"].includes(h.toLowerCase()));
                        const headerVal = isRedacted ? "[CLIENT_REDACTED]" : String(value);
                        span.setAttribute("http.request.header." + header, headerVal);
                    });
                    const resHeaders = Object.entries(res.getHeaders());
                    resHeaders.forEach(([header, value]) => {
                        const isRedacted = this.config.redactHeaders?.some((h) => h.toLowerCase() === header.toLowerCase() ||
                            ["cookie", "authorization"].includes(h.toLowerCase()));
                        const headerVal = isRedacted ? "[CLIENT_REDACTED]" : String(value);
                        span.setAttribute("http.response.header." + header, headerVal);
                    });
                    span.setAttribute("http.request.body", Buffer.from((0, payload_1.redactFields)(reqBody, this.config.redactRequestBody || [])).toString("base64"));
                    span.setAttribute("http.response.body", Buffer.from((0, payload_1.redactFields)(respBody, this.config.redactRequestBody || [])).toString("base64"));
                }
            }
            catch (error) {
                if (this.config?.debug) {
                    console.log(error);
                }
            }
            finally {
                if (this.tracer) {
                    span?.end();
                }
            }
        };
        const onRespFinishedCB = onRespFinished(req, res);
        res.on("finish", onRespFinishedCB);
        res.on("error", onRespFinishedCB);
        try {
            next();
        }
        catch (error) {
            next(error);
        }
    }
    static NewClient(config) {
        const { rootURL = "https://app.apitoolkit.io", clientMetadata } = config;
        if (!clientMetadata || config.apiKey != "") {
            const clientMeta = this.getClientMetadata(rootURL, config.apiKey);
            if (!clientMeta) {
                return new APIToolkit(config, config.apiKey, undefined);
            }
            else {
                return new APIToolkit(config, config.apiKey, clientMeta.project_id);
            }
        }
        return new APIToolkit(config, config.apiKey, undefined);
    }
    static getClientMetadata(rootURL, apiKey) {
        const resp = (0, sync_fetch_1.default)(rootURL + "/api/client_metadata", {
            method: "GET",
            headers: {
                Authorization: "Bearer " + apiKey,
                Accept: "application/json",
            },
        });
        if (!resp.ok) {
            if (resp.status === 401) {
                throw new Error("APIToolkit: Invalid API Key");
            }
            else {
                console.error(`Error getting apitoolkit client_metadata ${resp.status}`);
                return;
            }
        }
        return resp.json();
    }
}
const findMatchedRoute = (app, method, url) => {
    try {
        const path = url.split("?")[0];
        const stack = app._router.stack;
        let final_path = "";
        const gatherRoutes = (stack, build_path, path) => {
            for (const layer of stack) {
                if (layer.route) {
                    if (path.startsWith(layer.path)) {
                        const route = layer.route;
                        if (route.methods[method.toLowerCase()]) {
                            const match = layer.path === path || layer.regex.test(path);
                            if (match) {
                                build_path += route.path;
                                final_path = build_path;
                                return;
                            }
                        }
                    }
                }
                else if (layer.name === "router" && layer.handle.stack) {
                    if (path.startsWith(layer.path)) {
                        build_path += transformPath(layer.params, layer.path);
                        path = path.replace(layer.path, "");
                        gatherRoutes(layer.handle.stack, build_path, path);
                    }
                }
            }
        };
        gatherRoutes(stack, "", path);
        return final_path;
    }
    catch {
        return "";
    }
};
exports.findMatchedRoute = findMatchedRoute;
function transformPath(params, path) {
    let transformedPath = path;
    for (const [key, value] of Object.entries(params)) {
        const placeholder = `:${key}`;
        transformedPath = transformedPath.replace(value, placeholder);
    }
    return transformedPath;
}
exports.default = APIToolkit;
