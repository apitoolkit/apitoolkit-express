"use strict";
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
var _APIToolkit_topic, _APIToolkit_pubsub, _APIToolkit_project_id, _APIToolkit_redactHeaders, _APIToolkit_redactRequestBody, _APIToolkit_redactResponseBody, _APIToolkit_debug;
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = __importDefault(require("node-fetch"));
const pubsub_1 = require("@google-cloud/pubsub");
const async_hooks_1 = require("async_hooks");
const jsonpath_1 = __importDefault(require("jsonpath"));
class APIToolkit {
    constructor(pubsub, topic, project_id, redactHeaders, redactReqBody, redactRespBody, debug) {
        _APIToolkit_topic.set(this, void 0);
        _APIToolkit_pubsub.set(this, void 0);
        _APIToolkit_project_id.set(this, void 0);
        _APIToolkit_redactHeaders.set(this, void 0);
        _APIToolkit_redactRequestBody.set(this, void 0);
        _APIToolkit_redactResponseBody.set(this, void 0);
        _APIToolkit_debug.set(this, void 0);
        this.asyncLocalStorage = new async_hooks_1.AsyncLocalStorage();
        __classPrivateFieldSet(this, _APIToolkit_topic, topic, "f");
        __classPrivateFieldSet(this, _APIToolkit_pubsub, pubsub, "f");
        __classPrivateFieldSet(this, _APIToolkit_project_id, project_id, "f");
        __classPrivateFieldSet(this, _APIToolkit_redactHeaders, redactHeaders, "f");
        __classPrivateFieldSet(this, _APIToolkit_redactRequestBody, redactReqBody, "f");
        __classPrivateFieldSet(this, _APIToolkit_redactResponseBody, redactRespBody, "f");
        __classPrivateFieldSet(this, _APIToolkit_debug, debug, "f");
        this.publishMessage = (payload) => {
            const callback = (err, messageId) => {
                if (__classPrivateFieldGet(this, _APIToolkit_debug, "f")) {
                    console.log("APIToolkit: pubsub publish callback called; messageId: ", messageId, " error ", err);
                    if (err) {
                        console.log("APIToolkit: error publishing message to pubsub");
                        console.error(err);
                    }
                }
            };
            if (__classPrivateFieldGet(this, _APIToolkit_pubsub, "f")) {
                __classPrivateFieldGet(this, _APIToolkit_pubsub, "f").topic(__classPrivateFieldGet(this, _APIToolkit_topic, "f")).publishMessage({ json: payload }, callback);
            }
        };
        this.expressMiddleware = this.expressMiddleware.bind(this);
    }
    static async NewClient({ apiKey, rootURL = "https://app.apitoolkit.io", redactHeaders = [], redactRequestBody = [], redactResponseBody = [], debug = false, clientMetadata, }) {
        var pubsubClient;
        if (clientMetadata == null || apiKey != "") {
            clientMetadata = await this.getClientMetadata(rootURL, apiKey);
            pubsubClient = new pubsub_1.PubSub({
                projectId: clientMetadata.pubsub_project_id,
                authClient: new pubsub_1.PubSub().auth.fromJSON(clientMetadata.pubsub_push_service_account),
            });
        }
        const { pubsub_project_id, topic_id, project_id, pubsub_push_service_account } = clientMetadata;
        if (debug) {
            console.log("apitoolkit:  initialized successfully");
            console.dir(pubsubClient);
        }
        return new APIToolkit(pubsubClient, topic_id, project_id, redactHeaders, redactRequestBody, redactResponseBody, debug);
    }
    static async getClientMetadata(rootURL, apiKey) {
        const resp = await (0, node_fetch_1.default)(rootURL + "/api/client_metadata", {
            method: "GET",
            headers: {
                Authorization: "Bearer " + apiKey,
                Accept: "application/json",
            },
        });
        if (!resp.ok)
            throw new Error(`Error getting apitoolkit client_metadata ${resp.status}`);
        return (await resp.json());
    }
    getStore() {
        return this.asyncLocalStorage.getStore();
    }
    // public async expressMiddleware(req: Request, res: Response, next: NextFunction) {
    //   this.asyncLocalStorage.run(new Map(), () => {
    //     if (this.#debug) {
    //       console.log("APIToolkit: expressMiddleware called");
    //     }
    //     const start_time = process.hrtime.bigint();
    //     let respBody: any = null;
    //     const oldSend = res.send;
    //     res.send = (val) => {
    //       respBody = val;
    //       return oldSend.apply(res, [val]);
    //     };
    //     const onRespFinished = (topic: Topic | undefined, req: Request, res: Response) => (err: any) => {
    //       res.removeListener("close", onRespFinished(topic, req, res));
    //       res.removeListener("error", onRespFinished(topic, req, res));
    //       res.removeListener("finish", onRespFinished(topic, req, res));
    //       let reqBody = "";
    //       if (req.body) {
    //         try {
    //           if (req.is("multipart/form-data")) {
    //             if (req.file) {
    //               req.body[req.file.fieldname] = `[${req.file.mimetype}_FILE]`;
    //             } else if (req.files) {
    //               if (!Array.isArray(req.files)) {
    //                 for (const file in req.files) {
    //                   req.body[file] = (req.files[file] as any).map(
    //                     (f: any) => `[${f.mimetype}_FILE]`
    //                   );
    //                 }
    //               } else {
    //                 for (const file of req.files) {
    //                   req.body[file.fieldname] = `[${file.mimetype}_FILE]`;
    //                 }
    //               }
    //             }
    //           }
    //           reqBody = JSON.stringify(req.body);
    //         } catch (error) {
    //           reqBody = String(req.body);
    //         }
    //       }
    //       const reqObjEntries: Array<[string, string[]]> = Object.entries(req.headers).map(
    //         ([k, v]: [string, any]): [string, string[]] => [k, Array.isArray(v) ? v : [v]]
    //       );
    //       const reqHeaders = new Map<string, string[]>(reqObjEntries);
    //       const resObjEntries: Array<[string, string[]]> = Object.entries(res.getHeaders()).map(
    //         ([k, v]: [string, any]): [string, string[]] => [k, Array.isArray(v) ? v : [v]]
    //       );
    //       const resHeaders = new Map<string, string[]>(resObjEntries);
    //       const queryObjEntries = Object.entries(req.query).map(([k, v]) => {
    //         if (typeof v === "string") return [k, [v]];
    //         return [k, v];
    //       });
    //       const queryParams = Object.fromEntries(queryObjEntries);
    //       const pathParams = req.params ?? {};
    //       let urlPath = req.route?.path ?? "";
    //       let rawURL = req.originalUrl;
    //       if (req.baseUrl && req.baseUrl != "") {
    //         urlPath = req.baseUrl + urlPath;
    //       }
    //       const payload: Payload = {
    //         duration: Number(process.hrtime.bigint() - start_time),
    //         host: req.hostname,
    //         method: req.method,
    //         path_params: pathParams,
    //         project_id: this.#project_id,
    //         proto_minor: 1,
    //         proto_major: 1,
    //         query_params: queryParams,
    //         raw_url: rawURL,
    //         referer: req.headers.referer ?? "",
    //         request_body: Buffer.from(this.redactFields(reqBody, this.#redactRequestBody)).toString(
    //           "base64"
    //         ),
    //         request_headers: this.redactHeaders(reqHeaders, this.#redactHeaders),
    //         response_body: Buffer.from(
    //           this.redactFields(respBody, this.#redactResponseBody)
    //         ).toString("base64"),
    //         response_headers: this.redactHeaders(resHeaders, this.#redactHeaders),
    //         sdk_type: "JsExpress",
    //         status_code: res.statusCode,
    //         timestamp: new Date().toISOString(),
    //         url_path: urlPath,
    //       };
    //       if (this.#debug) {
    //         console.log("APIToolkit: publish prepared payload ");
    //         console.dir(payload);
    //       }
    //       this.publishMessage(payload);
    //     };
    //     const onRespFinishedCB = onRespFinished(this.#pubsub?.topic(this.#topic), req, res);
    //     res.on("finish", onRespFinishedCB);
    //     res.on("error", onRespFinishedCB);
    //     // res.on('close', onRespFinishedCB)
    //     next();
    //   });
    // }
    async expressMiddleware(req, res, next) {
        this.asyncLocalStorage.run(new Map(), () => {
            if (__classPrivateFieldGet(this, _APIToolkit_debug, "f")) {
                console.log("APIToolkit: expressMiddleware called");
            }
            const start_time = process.hrtime.bigint();
            const respBody = this.modifyResSend(res);
            const onRespFinishedCB = this.createOnRespFinishedCallback(start_time, req, res, respBody);
            this.attachResponseListeners(res, onRespFinishedCB);
            next();
        });
    }
    createOnRespFinishedCallback(start_time, req, res, respBody) {
        return (err) => {
            // The logic for handling the response and publishing the message, e.g.:
            const payload = this.createPayload(start_time, req, res, respBody);
            if (__classPrivateFieldGet(this, _APIToolkit_debug, "f")) {
                console.log("APIToolkit: publish prepared payload ");
                console.dir(payload);
            }
            this.publishMessage(payload);
        };
    }
    attachResponseListeners(res, callback) {
        res.on("finish", callback);
        res.on("error", callback);
    }
    modifyResSend(res) {
        let respBody = null;
        const oldSend = res.send;
        res.send = (val) => {
            respBody = val;
            return oldSend.apply(res, [val]);
        };
        return respBody;
    }
    createPayload(start_time, req, res, respBody) {
        // Get information from the request and response objects
        const reqBody = this.getRequestBody(req);
        const reqHeaders = this.getHeaders(req.headers);
        const resHeaders = this.getHeaders(res.getHeaders());
        const queryParams = this.getQueryParams(req.query);
        const pathParams = req.params ?? {};
        const urlPath = this.getUrlPath(req);
        const rawURL = req.originalUrl;
        // Construct and return the payload object
        return {
            duration: Number(process.hrtime.bigint() - start_time),
            host: req.hostname,
            method: req.method,
            path_params: pathParams,
            project_id: __classPrivateFieldGet(this, _APIToolkit_project_id, "f"),
            proto_minor: 1,
            proto_major: 1,
            query_params: queryParams,
            raw_url: rawURL,
            referer: req.headers.referer ?? "",
            request_body: Buffer.from(this.redactFields(reqBody, __classPrivateFieldGet(this, _APIToolkit_redactRequestBody, "f"))).toString("base64"),
            request_headers: this.redactHeaders(reqHeaders, __classPrivateFieldGet(this, _APIToolkit_redactHeaders, "f")),
            response_body: Buffer.from(this.redactFields(respBody, __classPrivateFieldGet(this, _APIToolkit_redactResponseBody, "f"))).toString("base64"),
            response_headers: this.redactHeaders(resHeaders, __classPrivateFieldGet(this, _APIToolkit_redactHeaders, "f")),
            sdk_type: "JsExpress",
            status_code: res.statusCode,
            timestamp: new Date().toISOString(),
            url_path: urlPath,
        };
    }
    getRequestBody(req) {
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
            catch (error) {
                reqBody = String(req.body);
            }
        }
        return reqBody;
    }
    getHeaders(headers) {
        const objEntries = Object.entries(headers).map(([k, v]) => [k, Array.isArray(v) ? v : [v]]);
        return new Map(objEntries);
    }
    getQueryParams(query) {
        const queryObjEntries = Object.entries(query).map(([k, v]) => {
            if (typeof v === "string")
                return [k, [v]];
            return [k, v];
        });
        return Object.fromEntries(queryObjEntries);
    }
    getUrlPath(req) {
        let urlPath = req.route?.path ?? "";
        if (req.baseUrl && req.baseUrl !== "") {
            urlPath = req.baseUrl + urlPath;
        }
        return urlPath;
    }
    redactHeaders(headers, headersToRedact) {
        const redactedHeaders = new Map();
        const headersToRedactLowerCase = headersToRedact.map((header) => header.toLowerCase());
        for (let [key, value] of headers) {
            const lowerKey = key.toLowerCase();
            const isRedactKey = headersToRedactLowerCase.includes(lowerKey) || lowerKey === "cookie";
            redactedHeaders.set(key, isRedactKey ? ["[CLIENT_REDACTED]"] : value);
        }
        return redactedHeaders;
    }
    redactFields(body, fieldsToRedact) {
        try {
            const bodyOB = JSON.parse(body);
            fieldsToRedact.forEach((path) => {
                jsonpath_1.default.apply(bodyOB, path, function () {
                    return "[CLIENT_REDACTED]";
                });
            });
            return JSON.stringify(bodyOB);
        }
        catch (error) {
            return body;
        }
    }
}
_APIToolkit_topic = new WeakMap(), _APIToolkit_pubsub = new WeakMap(), _APIToolkit_project_id = new WeakMap(), _APIToolkit_redactHeaders = new WeakMap(), _APIToolkit_redactRequestBody = new WeakMap(), _APIToolkit_redactResponseBody = new WeakMap(), _APIToolkit_debug = new WeakMap();
exports.default = APIToolkit;
