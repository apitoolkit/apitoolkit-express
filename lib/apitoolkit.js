"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findMatchedRoute = exports.APIToolkit = exports.ReportError = void 0;
const sync_fetch_1 = __importDefault(require("sync-fetch"));
const uuid_1 = require("uuid");
const api_1 = require("@opentelemetry/api");
const payload_1 = require("apitoolkit-js/lib/payload");
const apitoolkit_js_1 = require("apitoolkit-js");
var apitoolkit_js_2 = require("apitoolkit-js");
Object.defineProperty(exports, "ReportError", { enumerable: true, get: function () { return apitoolkit_js_2.ReportError; } });
class APIToolkit {
    constructor(config, apiKey, projectId) {
        this.ReportError = apitoolkit_js_1.ReportError;
        this.config = config;
        this.captureRequestBody = config.captureRequestBody || false;
        this.captureResponseBody = config.captureResponseBody || false;
        this.serviceName = config.serviceName;
        if (projectId) {
            this.project_id = projectId;
            this.apitoolkit_key = apiKey;
        }
        this.expressMiddleware = this.expressMiddleware.bind(this);
    }
    expressErrorHandler(err, _req, _res, next) {
        (0, apitoolkit_js_1.ReportError)(err);
        next(err);
    }
    errorHandler(err, req, res, next) {
        return this.expressErrorHandler(err, req, res, next);
    }
    expressMiddleware(req, res, next) {
        if (this.project_id === undefined) {
            console.log("APIToolkit: expressMiddleware called, but apitoolkit was not correctly setup. Doing nothing.");
            next();
            return;
        }
        apitoolkit_js_1.asyncLocalStorage.run(new Map(), () => {
            const store = apitoolkit_js_1.asyncLocalStorage.getStore();
            const msg_id = (0, uuid_1.v4)();
            const tracer = api_1.trace.getTracer(this.serviceName);
            const span = tracer.startSpan("apitoolkit-http-span");
            if (store) {
                store.set("apitoolkit-span", span);
                store.set("apitoolkit-msg-id", msg_id);
                store.set("AT_errors", []);
            }
            if (this.config?.debug) {
                console.log("APIToolkit: expressMiddleware called");
            }
            let respBody = "";
            const oldSend = res.send;
            res.send = (val) => {
                if (this.captureResponseBody) {
                    respBody = val;
                }
                return oldSend.apply(res, [val]);
            };
            const onRespFinished = (req, res) => () => {
                res.removeListener("close", onRespFinished(req, res));
                res.removeListener("error", onRespFinished(req, res));
                res.removeListener("finish", onRespFinished(req, res));
                try {
                    let reqBody = "";
                    if (req.body && this.captureRequestBody) {
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
                        span.setAttribute("net.host.name", req.hostname);
                        span.setAttribute("at-project-key", this.apitoolkit_key || "");
                        span.setAttribute("apitoolkit.msg_id", msg_id);
                        span.setAttribute("http.route", url_path);
                        span.setAttribute("http.request.method", req.method);
                        span.setAttribute("http.response.status_code", res.statusCode);
                        span.setAttribute("http.request.query_params", JSON.stringify(req.query));
                        span.setAttribute("http.request.path_params", JSON.stringify(req.params));
                        span.setAttribute("apitoolkit.sdk_type", "JsExpress");
                        const reqHeaders = Object.entries(req.headers);
                        reqHeaders.forEach(([header, value]) => {
                            const isRedacted = this.config.redactHeaders?.some((h) => h.toLowerCase() === header.toLowerCase() ||
                                ["cookie", "authorization"].includes(h.toLowerCase()));
                            const headerVal = isRedacted
                                ? "[CLIENT_REDACTED]"
                                : String(value);
                            span.setAttribute("http.request.header." + header, headerVal);
                        });
                        const resHeaders = Object.entries(res.getHeaders());
                        resHeaders.forEach(([header, value]) => {
                            const isRedacted = this.config.redactHeaders?.some((h) => h.toLowerCase() === header.toLowerCase() ||
                                ["cookie", "authorization"].includes(h.toLowerCase()));
                            const headerVal = isRedacted
                                ? "[CLIENT_REDACTED]"
                                : String(value);
                            span.setAttribute("http.response.header." + header, headerVal);
                        });
                        span.setAttribute("http.request.body", Buffer.from((0, payload_1.redactFields)(reqBody, this.config.redactRequestBody || [])).toString("base64"));
                        span.setAttribute("http.response.body", Buffer.from((0, payload_1.redactFields)(respBody, this.config.redactRequestBody || [])).toString("base64"));
                        span.setAttribute("apitoolkit.errors", JSON.stringify(store?.get("AT_errors") || []));
                        span.setAttribute("apitoolkit.service_version", this.config.serviceVersion || "");
                        span.setAttribute("apitoolkit.tags", this.config.tags || []);
                    }
                }
                catch (error) {
                    if (this.config?.debug) {
                        console.log(error);
                    }
                }
                finally {
                    span.end();
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
        });
    }
    static NewClient(config) {
        const { rootURL = "https://app.apitoolkit.io" } = config;
        if (config.apiKey != "") {
            const clientMeta = this.getClientMetadata(rootURL, config.apiKey);
            return new APIToolkit(config, config.apiKey, clientMeta?.project_id);
        }
        if (config.apiKey == "") {
            console.error("APIToolkit: apiKey is required");
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
            console.error(`Error getting apitoolkit client_metadata ${resp.status}`);
            return;
        }
        return resp.json();
    }
}
exports.APIToolkit = APIToolkit;
const findMatchedRoute = (app, method, url) => {
    try {
        const path = url.split("?")[0];
        const stack = app._router.stack;
        let final_path = "";
        const gatherRoutes = (stack, build_path, path) => {
            for (const layer of stack) {
                if (layer.route) {
                    if (path.startsWith(layer.path) &&
                        layer.route.methods[method.toLowerCase()] &&
                        (layer.path === path || layer.regex.test(path))) {
                        build_path += layer.route.path;
                        final_path = build_path;
                        return;
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
