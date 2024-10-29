"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportError = exports.ReportError = void 0;
exports.expressMiddleware = expressMiddleware;
exports.expressErrorHandler = expressErrorHandler;
const uuid_1 = require("uuid");
const api_1 = require("@opentelemetry/api");
const payload_1 = require("apitoolkit-js/lib/payload");
const apitoolkit_js_1 = require("apitoolkit-js");
var apitoolkit_js_2 = require("apitoolkit-js");
Object.defineProperty(exports, "ReportError", { enumerable: true, get: function () { return apitoolkit_js_2.ReportError; } });
function expressMiddleware(config) {
    if (!config) {
        config = {};
    }
    return function expressMidd(req, res, next) {
        apitoolkit_js_1.asyncLocalStorage.run(new Map(), () => {
            const store = apitoolkit_js_1.asyncLocalStorage.getStore();
            const msg_id = (0, uuid_1.v4)();
            const span = api_1.trace.getTracer(config.serviceName || '').startSpan('apitoolkit-http-span');
            if (store) {
                store.set('apitoolkit-span', span);
                store.set('apitoolkit-msg-id', msg_id);
                store.set('AT_errors', []);
            }
            if (config.debug) {
                console.log('APIToolkit: expressMiddleware called');
            }
            let respBody = '';
            const oldSend = res.send;
            res.send = val => {
                if (config.captureResponseBody) {
                    respBody = val;
                }
                return oldSend.apply(res, [val]);
            };
            const onRespFinished = (req, res) => () => {
                res.removeListener('close', onRespFinished(req, res));
                res.removeListener('error', onRespFinished(req, res));
                res.removeListener('finish', onRespFinished(req, res));
                try {
                    const reqBody = getRequestBody(req, config.captureRequestBody || false);
                    const url_path = getUrlPath(req);
                    setAttributes(span, req, res, msg_id, url_path, reqBody, respBody, config);
                }
                catch (error) {
                    if (config.debug) {
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
    };
}
function setAttributes(span, req, res, msg_id, urlPath, reqBody, respBody, config) {
    span.setAttributes({
        'net.host.name': req.hostname,
        'apitoolkit.msg_id': msg_id,
        'http.route': urlPath,
        'http.request.method': req.method,
        'http.response.status_code': res.statusCode,
        'http.request.query_params': JSON.stringify(req.query),
        'http.request.path_params': JSON.stringify(req.params),
        'apitoolkit.sdk_type': 'JsExpress',
        'http.request.body': Buffer.from((0, payload_1.redactFields)(reqBody, config.redactRequestBody || [])).toString('base64'),
        'http.response.body': Buffer.from((0, payload_1.redactFields)(respBody, config.redactRequestBody || [])).toString('base64'),
        'apitoolkit.errors': JSON.stringify(apitoolkit_js_1.asyncLocalStorage.getStore()?.get('AT_errors') || []),
        'apitoolkit.service_version': config.serviceVersion || '',
        'apitoolkit.tags': config.tags || []
    });
    const redactHeader = (header) => config.redactHeaders?.includes(header.toLowerCase()) || ['cookies', 'authorization'].includes(header.toLowerCase())
        ? '[CLIENT_REDACTED]'
        : header;
    Object.entries(req.headers).forEach(([header, value]) => span.setAttribute(`http.request.header.${header}`, redactHeader(String(value))));
    Object.entries(res.getHeaders()).forEach(([header, value]) => span.setAttribute(`http.response.header.${header}`, redactHeader(String(value))));
}
function expressErrorHandler(err, _req, _res, next) {
    (0, apitoolkit_js_1.ReportError)(err);
    next(err);
}
function getRequestBody(req, captureRequestBody) {
    const reqBody = '';
    if (req.body && captureRequestBody) {
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
function getUrlPath(req) {
    let url_path = req.route?.path || '';
    if (url_path == '' && req.method.toLowerCase() !== 'head') {
        url_path = findMatchedRoute(req.app, req.method, req.originalUrl);
    }
    else if (req.baseUrl && req.baseUrl != '') {
        if (req.originalUrl.startsWith(req.baseUrl)) {
            url_path = req.baseUrl + url_path;
        }
        else {
            url_path = findMatchedRoute(req.app, req.method, req.originalUrl);
        }
    }
    return url_path;
}
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
exports.reportError = apitoolkit_js_1.ReportError;
function transformPath(params, path) {
    let transformedPath = path;
    for (const [key, value] of Object.entries(params)) {
        const placeholder = `:${key}`;
        transformedPath = transformedPath.replace(value, placeholder);
    }
    return transformedPath;
}
const APIToolkit = {
    expressMiddleware,
    expressErrorHandler,
    reportError: exports.reportError
};
exports.default = APIToolkit;
