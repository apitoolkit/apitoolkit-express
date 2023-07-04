"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _APIToolkit_topic, _APIToolkit_pubsub, _APIToolkit_project_id, _APIToolkit_redactHeaders, _APIToolkit_redactRequestBody, _APIToolkit_redactResponseBody;
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIToolkit = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const pubsub_1 = require("@google-cloud/pubsub");
const node_process_1 = require("node:process");
const jsonpath_1 = __importDefault(require("jsonpath"));
class APIToolkit {
    constructor(pubsub, topic, project_id, redactHeaders, redactReqBody, redactRespBody) {
        _APIToolkit_topic.set(this, void 0);
        _APIToolkit_pubsub.set(this, void 0);
        _APIToolkit_project_id.set(this, void 0);
        _APIToolkit_redactHeaders.set(this, void 0);
        _APIToolkit_redactRequestBody.set(this, void 0);
        _APIToolkit_redactResponseBody.set(this, void 0);
        __classPrivateFieldSet(this, _APIToolkit_topic, topic, "f");
        __classPrivateFieldSet(this, _APIToolkit_pubsub, pubsub, "f");
        __classPrivateFieldSet(this, _APIToolkit_project_id, project_id, "f");
        __classPrivateFieldSet(this, _APIToolkit_redactHeaders, redactHeaders, "f");
        __classPrivateFieldSet(this, _APIToolkit_redactRequestBody, redactReqBody, "f");
        __classPrivateFieldSet(this, _APIToolkit_redactResponseBody, redactRespBody, "f");
        this.expressMiddleware = this.expressMiddleware.bind(this);
    }
    static initialize({ apiKey, rootURL = "https://app.apitoolkit.io", redactHeaders = [], redactRequestBody = [], redactResponseBody = [] }) {
        return __awaiter(this, void 0, void 0, function* () {
            const resp = yield (0, node_fetch_1.default)(rootURL + "/api/client_metadata", {
                method: 'GET',
                headers: {
                    Authorization: "Bearer " + apiKey,
                    Accept: 'application/json',
                },
            });
            if (!resp.ok)
                throw new Error(`Error getting apitoolkit client_metadata ${resp.status}`);
            const clientMetadata = yield resp.json();
            const { pubsub_project_id, topic_id, project_id } = clientMetadata;
            const pubsubClient = new pubsub_1.PubSub({
                projectId: pubsub_project_id
            });
            return new APIToolkit(pubsubClient, topic_id, project_id, redactHeaders, redactRequestBody, redactResponseBody);
        });
    }
    expressMiddleware(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const start_time = node_process_1.hrtime.bigint();
            const chunks = [];
            let respBody = '';
            let reqBody = "";
            req.on('data', function (chunk) { reqBody += chunk; });
            req.on('end', function () {
                // req.rawBody = data;
                // next();
            });
            const oldSend = res.send;
            res.send = (val) => {
                respBody = JSON.stringify(val);
                return oldSend.apply(res, [val]);
            };
            // const oldWrite = res.write;
            // const oldEnd = res.end;
            // res.write = (chunk, ...args) => {
            //   console.log("RES.WRITE :", chunk)
            //   chunks.push(chunk);
            //   // @ts-ignore
            //   return oldWrite.apply(res, [chunk, ...args]);
            // };
            // res.end = (chunk: Function | any, encoding?: Function | string, callback?: Function) => {
            //   if (chunk) chunks.push(chunk);
            //   respBody = Buffer.concat(chunks).toString('base64');
            //   // @ts-ignore
            //   return oldEnd.apply(res, [chunk, encoding, callback]);
            // };
            const onRespFinished = (topic, req, res) => (err) => {
                var _a, _b;
                res.removeListener('close', onRespFinished(topic, req, res));
                res.removeListener('error', onRespFinished(topic, req, res));
                res.removeListener('finish', onRespFinished(topic, req, res));
                const reqObjEntries = Object.entries(req.headers).map(([k, v]) => {
                    if (typeof v === "string")
                        return [k, [v]];
                    return [k, v];
                });
                const reqHeaders = new Map(Object.fromEntries(reqObjEntries));
                const resObjEntries = Object.entries(res.getHeaders()).map(([k, v]) => {
                    if (typeof v === "string")
                        return [k, [v]];
                    return [k, v];
                });
                const resHeaders = new Map(Object.fromEntries(resObjEntries));
                const queryObjEntries = Object.entries(req.query).map(([k, v]) => {
                    if (typeof v === "string")
                        return [k, [v]];
                    return [k, v];
                });
                const queryParams = Object.fromEntries(queryObjEntries);
                const pathParams = new Map(Object.entries((_a = req.params) !== null && _a !== void 0 ? _a : {}));
                const payload = {
                    duration: Number(node_process_1.hrtime.bigint() - start_time),
                    host: req.hostname,
                    method: req.method,
                    path_params: pathParams,
                    project_id: __classPrivateFieldGet(this, _APIToolkit_project_id, "f"),
                    proto_minor: 1,
                    proto_major: 1,
                    query_params: queryParams,
                    raw_url: req.url,
                    referer: (_b = req.headers.referer) !== null && _b !== void 0 ? _b : '',
                    request_body: Buffer.from(this.redactFields(reqBody, __classPrivateFieldGet(this, _APIToolkit_redactRequestBody, "f"))).toString('base64'),
                    request_headers: this.redactHeaders(reqHeaders, __classPrivateFieldGet(this, _APIToolkit_redactHeaders, "f")),
                    response_body: Buffer.from(this.redactFields(respBody, __classPrivateFieldGet(this, _APIToolkit_redactResponseBody, "f"))).toString('base64'),
                    response_headers: this.redactHeaders(resHeaders, __classPrivateFieldGet(this, _APIToolkit_redactHeaders, "f")),
                    sdk_type: "JsExpress",
                    status_code: res.statusCode,
                    timestamp: new Date().toISOString(),
                    url_path: req.route.path,
                };
                __classPrivateFieldGet(this, _APIToolkit_pubsub, "f").topic(__classPrivateFieldGet(this, _APIToolkit_topic, "f")).publishMessage({ json: payload });
            };
            const onRespFinishedCB = onRespFinished(__classPrivateFieldGet(this, _APIToolkit_pubsub, "f").topic(__classPrivateFieldGet(this, _APIToolkit_topic, "f")), req, res);
            // res.on('close', onRespFinishedCB)
            res.on('finish', onRespFinishedCB);
            res.on('error', onRespFinishedCB);
            next();
        });
    }
    redactHeaders(headers, headersToRedact) {
        const redactedHeaders = new Map();
        for (const [key, value] of headers.entries()) {
            if (headersToRedact.includes(key)) {
                redactedHeaders.set(key, ["[CLIENT_REDACTED]"]);
            }
            else {
                redactedHeaders.set(key, value);
            }
        }
        return redactedHeaders;
    }
    redactFields(body, fieldsToRedact) {
        try {
            const bodyOB = JSON.parse(body);
            fieldsToRedact.forEach(path => {
                jsonpath_1.default.apply(bodyOB, path, function () { return "[CLIENT_REDACTED]"; });
            });
            return JSON.stringify(bodyOB);
        }
        catch (error) {
            return "";
        }
    }
}
exports.APIToolkit = APIToolkit;
_APIToolkit_topic = new WeakMap(), _APIToolkit_pubsub = new WeakMap(), _APIToolkit_project_id = new WeakMap(), _APIToolkit_redactHeaders = new WeakMap(), _APIToolkit_redactRequestBody = new WeakMap(), _APIToolkit_redactResponseBody = new WeakMap();
