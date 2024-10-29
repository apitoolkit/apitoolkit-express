"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findMatchedRoute = exports.APIToolkit = exports.ReportError = void 0;
const uuid_1 = require("uuid");
const api_1 = require("@opentelemetry/api");
const payload_1 = require("apitoolkit-js/lib/payload");
const apitoolkit_js_1 = require("apitoolkit-js");
var apitoolkit_js_2 = require("apitoolkit-js");
Object.defineProperty(exports, "ReportError", { enumerable: true, get: function () { return apitoolkit_js_2.ReportError; } });
class APIToolkit {
    constructor(config) {
        this.ReportError = apitoolkit_js_1.ReportError;
        this.config = config;
        this.captureRequestBody = config.captureRequestBody || false;
        this.captureResponseBody = config.captureResponseBody || false;
        this.serviceName = config.serviceName;
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
        apitoolkit_js_1.asyncLocalStorage.run(new Map(), () => {
            const store = apitoolkit_js_1.asyncLocalStorage.getStore();
            const msg_id = (0, uuid_1.v4)();
            const span = api_1.trace.getTracer(this.serviceName).startSpan('apitoolkit-http-span');
            if (store) {
                store.set('apitoolkit-span', span);
                store.set('apitoolkit-msg-id', msg_id);
                store.set('AT_errors', []);
            }
            if (this.config?.debug) {
                console.log('APIToolkit: expressMiddleware called');
            }
            let respBody = '';
            const oldSend = res.send;
            res.send = val => {
                if (this.captureResponseBody) {
                    respBody = val;
                }
                return oldSend.apply(res, [val]);
            };
            const onRespFinished = (req, res) => () => {
                res.removeListener('close', onRespFinished(req, res));
                res.removeListener('error', onRespFinished(req, res));
                res.removeListener('finish', onRespFinished(req, res));
                try {
                    const reqBody = this.getRequestBody(req);
                    const url_path = this.getUrlPath(req);
                    this.setAttributes(span, req, res, msg_id, url_path, reqBody, respBody);
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
            res.on('finish', onRespFinishedCB).on('error', onRespFinishedCB);
            next();
        });
    }
    static NewClient(config) {
        return new APIToolkit(config);
    }
    setAttributes(span, req, res, msg_id, urlPath, reqBody, respBody) {
        span.setAttributes({
            'net.host.name': req.hostname,
            'at-project-key': this.apitoolkit_key || '',
            'apitoolkit.msg_id': msg_id,
            'http.route': urlPath,
            'http.request.method': req.method,
            'http.response.status_code': res.statusCode,
            'http.request.query_params': JSON.stringify(req.query),
            'http.request.path_params': JSON.stringify(req.params),
            'apitoolkit.sdk_type': 'JsExpress',
            'http.request.body': Buffer.from((0, payload_1.redactFields)(reqBody, this.config.redactRequestBody || [])).toString('base64'),
            'http.response.body': Buffer.from((0, payload_1.redactFields)(respBody, this.config.redactRequestBody || [])).toString('base64'),
            'apitoolkit.errors': JSON.stringify(apitoolkit_js_1.asyncLocalStorage.getStore()?.get('AT_errors') || []),
            'apitoolkit.service_version': this.config.serviceVersion || '',
            'apitoolkit.tags': this.config.tags || []
        });
        const redactHeader = (header) => this.config.redactHeaders?.includes(header.toLowerCase()) || ['cookies', 'authorization'].includes(header.toLowerCase())
            ? '[CLIENT_REDACTED]'
            : header;
        Object.entries(req.headers).forEach(([header, value]) => span.setAttribute(`http.request.header.${header}`, redactHeader(String(value))));
        Object.entries(res.getHeaders()).forEach(([header, value]) => span.setAttribute(`http.response.header.${header}`, redactHeader(String(value))));
    }
    getRequestBody(req) {
        const reqBody = '';
        if (req.body && this.captureRequestBody) {
            try {
                if (req.is('multipart/form-data')) {
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
                return JSON.stringify(req.body);
            }
            catch {
                return String(req.body);
            }
        }
        return reqBody;
    }
    getUrlPath(req) {
        let url_path = req.route?.path || '';
        if (url_path == '' && req.method.toLowerCase() !== 'head') {
            url_path = (0, exports.findMatchedRoute)(req.app, req.method, req.originalUrl);
        }
        else if (req.baseUrl && req.baseUrl != '') {
            if (req.originalUrl.startsWith(req.baseUrl)) {
                url_path = req.baseUrl + url_path;
            }
            else {
                url_path = (0, exports.findMatchedRoute)(req.app, req.method, req.originalUrl);
            }
        }
        return url_path;
    }
}
exports.APIToolkit = APIToolkit;
const findMatchedRoute = (app, method, url) => {
    try {
        const path = url.split('?')[0];
        const stack = app._router.stack;
        let final_path = '';
        const gatherRoutes = (stack, build_path, path) => {
            for (const layer of stack) {
                if (layer.route) {
                    if (path.startsWith(layer.path) && layer.route.methods[method.toLowerCase()] && (layer.path === path || layer.regex.test(path))) {
                        build_path += layer.route.path;
                        final_path = build_path;
                        return;
                    }
                }
                else if (layer.name === 'router' && layer.handle.stack) {
                    if (path.startsWith(layer.path)) {
                        build_path += transformPath(layer.params, layer.path);
                        path = path.replace(layer.path, '');
                        gatherRoutes(layer.handle.stack, build_path, path);
                    }
                }
            }
        };
        gatherRoutes(stack, '', path);
        return final_path;
    }
    catch {
        return '';
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
