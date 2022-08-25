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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _APIToolkit_topic;
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const pubsub_1 = require("@google-cloud/pubsub");
// const { performance } = require("perf_hooks");
const node_process_1 = require("node:process");
function init(cfg) {
    return __awaiter(this, void 0, void 0, function* () {
        let url = "https://app.apitoolkit.io";
        if (cfg.rootURL && cfg.rootURL != "") {
            url = cfg.rootURL;
        }
        console.log(url + "/api/client_metadata");
        const resp = yield (0, node_fetch_1.default)(url + "/api/client_metadata", {
            method: 'GET',
            headers: {
                Authorization: "Bearer " + cfg.apiKey,
                Accept: 'application/json',
            },
        });
        // if (!resp.ok) {
        //   throw new Error(`Error getting apitoolkit client_metadata ${resp.status}`);
        // }
        let clientMetadata = yield resp.json();
        console.dir(clientMetadata);
        let { pubsub_project_id, topic_id } = clientMetadata;
        const pubsubClient = new pubsub_1.PubSub({
            projectId: pubsub_project_id
        });
        const topic = pubsubClient.topic(topic_id);
        const client = {
            config: cfg,
            topic: topic,
        };
        return client;
    });
}
exports.init = init;
class APIToolkit {
    constructor(topic) {
        _APIToolkit_topic.set(this, void 0);
        __classPrivateFieldSet(this, _APIToolkit_topic, topic, "f");
    }
    static initialize(apiKey, rootURL = "https://app.apitoolkit.io") {
        return __awaiter(this, void 0, void 0, function* () {
            const resp = yield (0, node_fetch_1.default)(rootURL + "/api/client_metadata", {
                method: 'GET',
                headers: {
                    Authorization: "Bearer " + apiKey,
                    Accept: 'application/json',
                },
            });
            // if (!resp.ok) {
            //   throw new Error(`Error getting apitoolkit client_metadata ${resp.status}`);
            // }
            let clientMetadata = yield resp.json();
            console.dir(clientMetadata);
            let { pubsub_project_id, topic_id } = clientMetadata;
            const pubsubClient = new pubsub_1.PubSub({
                projectId: pubsub_project_id
            });
            const topic = pubsubClient.topic(topic_id);
            // const client: Client = {
            //   topic: topic,
            // }
            // return client
            return new APIToolkit(topic);
        });
    }
    expressMiddleware(req, res, next) {
        var _a;
        const start_time = node_process_1.hrtime.bigint();
        const oldWrite = res.write;
        const oldEnd = res.end;
        const chunks = [];
        let respBody = '';
        res.write = (chunk, ...args) => {
            chunks.push(chunk);
            return oldWrite.apply(res, [chunk, ...args]);
        };
        res.end = (chunk, ...args) => {
            if (chunk)
                chunks.push(chunk);
            respBody = Buffer.concat(chunks).toString('base64');
            return oldEnd.apply(res, [chunk, ...args]);
        };
        next();
        console.log(node_process_1.hrtime.bigint() - start_time);
        console.dir(req.headers);
        console.dir(res.getHeaders());
        const reqObjEntries = Object.entries(req.headers).map(([k, v]) => {
            if (typeof v === "string") {
                return [k, [v]];
            }
            return [k, v];
        });
        const reqHeaders = Object.fromEntries(reqObjEntries);
        const resObjEntries = Object.entries(res.getHeaders()).map(([k, v]) => {
            if (typeof v === "string") {
                return [k, [v]];
            }
            return [k, v];
        });
        const resHeaders = Object.fromEntries(resObjEntries);
        const queryObjEntries = Object.entries(req.query).map(([k, v]) => {
            if (typeof v === "string") {
                return [k, [v]];
            }
            return [k, v];
        });
        const queryParams = Object.fromEntries(queryObjEntries);
        // req.headers.map(k,v=>console.log(k, v))
        const payload = {
            // path_params: req.params,
            duration: node_process_1.hrtime.bigint() - start_time,
            host: req.hostname,
            method: req.method,
            path_params: new Map(Object.entries(req.params)),
            project_id: "",
            proto_minor: 1,
            proto_major: 1,
            query_params: queryParams,
            raw_url: req.url,
            referer: (_a = req.headers.referer) !== null && _a !== void 0 ? _a : '',
            request_body: new Buffer(req.body).toString('base64'),
            request_headers: reqHeaders,
            response_body: respBody,
            response_headers: resHeaders,
            sdk_type: "JsExpress",
            status_code: res.statusCode,
            timestamp: new Date().toISOString(),
            url_path: req.url,
        };
        console.log("test middleware 🔥", payload);
    }
}
_APIToolkit_topic = new WeakMap();
