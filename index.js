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
var _APIToolkit_topic, _APIToolkit_pubsub, _APIToolkit_project_id, _APIToolkit_config;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportError = exports.APIToolkit = exports.asyncLocalStorage = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const pubsub_1 = require("@google-cloud/pubsub");
const async_hooks_1 = require("async_hooks");
const payload_1 = require("./payload");
const uuid_1 = require("uuid");
exports.asyncLocalStorage = new async_hooks_1.AsyncLocalStorage();
class APIToolkit {
    constructor(pubsub, topic, project_id, config) {
        _APIToolkit_topic.set(this, void 0);
        _APIToolkit_pubsub.set(this, void 0);
        _APIToolkit_project_id.set(this, void 0);
        _APIToolkit_config.set(this, void 0);
        __classPrivateFieldSet(this, _APIToolkit_topic, topic, "f");
        __classPrivateFieldSet(this, _APIToolkit_pubsub, pubsub, "f");
        __classPrivateFieldSet(this, _APIToolkit_project_id, project_id, "f");
        __classPrivateFieldSet(this, _APIToolkit_config, config, "f");
        this.publishMessage = (payload) => {
            const callback = (err, messageId) => {
                if (__classPrivateFieldGet(this, _APIToolkit_config, "f").debug) {
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
    static async NewClient(config) {
        var { apiKey, rootURL = "https://app.apitoolkit.io", clientMetadata } = config;
        var pubsubClient;
        if (clientMetadata == null || apiKey != "") {
            clientMetadata = await this.getClientMetadata(rootURL, apiKey);
            pubsubClient = new pubsub_1.PubSub({
                projectId: clientMetadata.pubsub_project_id,
                authClient: new pubsub_1.PubSub().auth.fromJSON(clientMetadata.pubsub_push_service_account),
            });
        }
        const { pubsub_project_id, topic_id, project_id, pubsub_push_service_account } = clientMetadata;
        if (config.debug) {
            console.log("apitoolkit:  initialized successfully");
            console.dir(pubsubClient);
        }
        return new APIToolkit(pubsubClient, topic_id, project_id, config);
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
    // public getStore() {
    //   return this.asyncLocalStorage.getStore();
    // }
    async expressMiddleware(req, res, next) {
        exports.asyncLocalStorage.run(new Map(), () => {
            exports.asyncLocalStorage.getStore().set("AT_client", this);
            exports.asyncLocalStorage.getStore().set("AT_project_id", __classPrivateFieldGet(this, _APIToolkit_project_id, "f"));
            exports.asyncLocalStorage.getStore().set("AT_config", __classPrivateFieldGet(this, _APIToolkit_config, "f"));
            exports.asyncLocalStorage.getStore().set("AT_errors", []);
            const msg_id = (0, uuid_1.v4)();
            exports.asyncLocalStorage.getStore().set("AT_msg_id", msg_id);
            if (__classPrivateFieldGet(this, _APIToolkit_config, "f").debug) {
                console.log("APIToolkit: expressMiddleware called");
            }
            const start_time = process.hrtime.bigint();
            let respBody = "";
            const oldSend = res.send;
            res.send = (val) => {
                respBody = val;
                return oldSend.apply(res, [val]);
            };
            const onRespFinished = (topic, req, res) => (err) => {
                res.removeListener("close", onRespFinished(topic, req, res));
                res.removeListener("error", onRespFinished(topic, req, res));
                res.removeListener("finish", onRespFinished(topic, req, res));
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
                const errors = exports.asyncLocalStorage.getStore()?.get("AT_errors") ?? [];
                const payload = (0, payload_1.buildPayload)(start_time, req, res, reqBody, respBody, __classPrivateFieldGet(this, _APIToolkit_config, "f").redactRequestBody ?? [], __classPrivateFieldGet(this, _APIToolkit_config, "f").redactResponseBody ?? [], __classPrivateFieldGet(this, _APIToolkit_config, "f").redactHeaders ?? [], __classPrivateFieldGet(this, _APIToolkit_project_id, "f"), errors, __classPrivateFieldGet(this, _APIToolkit_config, "f").serviceVersion, __classPrivateFieldGet(this, _APIToolkit_config, "f").tags ?? [], msg_id, undefined);
                if (__classPrivateFieldGet(this, _APIToolkit_config, "f").debug) {
                    console.log("APIToolkit: publish prepared payload ");
                    console.dir(payload);
                }
                this.publishMessage(payload);
            };
            const onRespFinishedCB = onRespFinished(__classPrivateFieldGet(this, _APIToolkit_pubsub, "f")?.topic(__classPrivateFieldGet(this, _APIToolkit_topic, "f")), req, res);
            res.on("finish", onRespFinishedCB);
            res.on("error", onRespFinishedCB);
            // res.on('close', onRespFinishedCB)
            try {
                next();
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.APIToolkit = APIToolkit;
_APIToolkit_topic = new WeakMap(), _APIToolkit_pubsub = new WeakMap(), _APIToolkit_project_id = new WeakMap(), _APIToolkit_config = new WeakMap();
function ReportError(error) {
    if (exports.asyncLocalStorage.getStore() == null) {
        console.log("APIToolkit: ReportError used outside of the APIToolkit middleware's scope. Use the APIToolkitClient.ReportError instead, if you're not in a web context.");
        return Promise.reject(error);
    }
    const resp = normaliseError(error);
    if (!resp) {
        return;
    }
    const [nError, internalFrames] = resp;
    const atError = buildError(nError);
    var errList = exports.asyncLocalStorage.getStore().get("AT_errors");
    errList.push(atError);
    exports.asyncLocalStorage.getStore().set("AT_errors", errList);
}
exports.ReportError = ReportError;
// Recursively unwraps an error and returns the original cause.
function rootCause(err) {
    let cause = err;
    while (cause && cause.cause) {
        cause = cause.cause;
    }
    return cause;
}
function normaliseError(maybeError) {
    let error;
    let internalFrames = 0;
    // In some cases:
    //
    //  - the promise rejection handler (both in the browser and node)
    //  - the node uncaughtException handler
    //
    // We are really limited in what we can do to get a stacktrace. So we use the
    // tolerateNonErrors option to ensure that the resulting error communicates as
    // such.
    switch (typeof maybeError) {
        case "string":
        case "number":
        case "boolean":
            error = new Error(String(maybeError));
            internalFrames += 1;
            break;
        case "function":
            return;
        case "object":
            if (maybeError !== null && isError(maybeError)) {
                error = maybeError;
            }
            else if (maybeError !== null && hasNecessaryFields(maybeError)) {
                error = new Error(maybeError.message || maybeError.errorMessage);
                error.name = maybeError.name || maybeError.errorClass;
                internalFrames += 1;
            }
            else {
                // unsupported error
                return;
            }
            break;
        default:
        // unsupported errors found
    }
    return [error, internalFrames];
}
const hasNecessaryFields = (error) => (typeof error.name === "string" || typeof error.errorClass === "string") &&
    (typeof error.message === "string" || typeof error.errorMessage === "string");
function isError(value) {
    switch (Object.prototype.toString.call(value)) {
        case "[object Error]":
            return true;
        case "[object Exception]":
            return true;
        case "[object DOMException]":
            return true;
        default:
            return value instanceof Error;
    }
}
function buildError(err) {
    const errType = err.constructor.name;
    const rootError = rootCause(err);
    const rootErrorType = rootError.constructor.name;
    return {
        when: new Date().toISOString(),
        error_type: errType,
        message: err.message,
        root_error_type: rootErrorType,
        root_error_message: rootError.message,
        stack_trace: err.stack ?? "",
    };
}
exports.default = APIToolkit;
