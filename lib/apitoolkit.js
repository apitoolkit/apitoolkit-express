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
var _APIToolkit_topicName, _APIToolkit_topic, _APIToolkit_pubsub, _APIToolkit_project_id, _APIToolkit_config;
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIToolkit = void 0;
const pubsub_1 = require("@google-cloud/pubsub");
const apitoolkit_js_1 = require("apitoolkit-js");
const sync_fetch_1 = __importDefault(require("sync-fetch"));
const uuid_1 = require("uuid");
class APIToolkit {
    constructor(pubsub, topicName, project_id, config) {
        _APIToolkit_topicName.set(this, void 0);
        _APIToolkit_topic.set(this, void 0);
        _APIToolkit_pubsub.set(this, void 0);
        _APIToolkit_project_id.set(this, void 0);
        _APIToolkit_config.set(this, void 0);
        this.ReportError = apitoolkit_js_1.ReportError;
        __classPrivateFieldSet(this, _APIToolkit_topicName, topicName, "f");
        __classPrivateFieldSet(this, _APIToolkit_pubsub, pubsub, "f");
        __classPrivateFieldSet(this, _APIToolkit_project_id, project_id, "f");
        __classPrivateFieldSet(this, _APIToolkit_config, config, "f");
        if (__classPrivateFieldGet(this, _APIToolkit_pubsub, "f") && __classPrivateFieldGet(this, _APIToolkit_topicName, "f")) {
            __classPrivateFieldSet(this, _APIToolkit_topic, __classPrivateFieldGet(this, _APIToolkit_pubsub, "f")?.topic(__classPrivateFieldGet(this, _APIToolkit_topicName, "f")), "f");
        }
        this.publishMessage = (payload) => {
            const callback = (err, messageId) => {
                if (__classPrivateFieldGet(this, _APIToolkit_config, "f")?.debug) {
                    console.log('APIToolkit: pubsub publish callback called; messageId: ', messageId, ' error ', err);
                    if (err != null) {
                        console.log('APIToolkit: error publishing message to pubsub');
                        console.error(err);
                    }
                }
            };
            if (__classPrivateFieldGet(this, _APIToolkit_topic, "f")) {
                __classPrivateFieldGet(this, _APIToolkit_topic, "f").publishMessage({ json: payload }, callback);
            }
            else {
                if (__classPrivateFieldGet(this, _APIToolkit_config, "f")?.debug) {
                    console.error('APIToolkit: error publishing message to pubsub, Undefined topic');
                }
            }
        };
        if (config.monitorAxios) {
            (0, apitoolkit_js_1.observeAxiosGlobal)(config.monitorAxios, undefined, config.redactHeaders, config.redactRequestBody, config.redactResponseBody, this);
        }
        this.expressMiddleware = this.expressMiddleware.bind(this);
    }
    static NewClient(config) {
        let { rootURL = 'https://app.apitoolkit.io', clientMetadata } = config;
        let pubsubClient;
        if (clientMetadata == null || config.apiKey != '') {
            clientMetadata = this.getClientMetadata(rootURL, config.apiKey);
            pubsubClient = new pubsub_1.PubSub({
                projectId: clientMetadata.pubsub_project_id,
                authClient: new pubsub_1.PubSub().auth.fromJSON(clientMetadata.pubsub_push_service_account),
            });
        }
        const { topic_id, project_id } = clientMetadata;
        if (config.debug) {
            console.log('apitoolkit:  initialized successfully');
            console.dir(pubsubClient);
        }
        return new APIToolkit(pubsubClient, topic_id, project_id, config);
    }
    async close() {
        await __classPrivateFieldGet(this, _APIToolkit_topic, "f")?.flush();
        await __classPrivateFieldGet(this, _APIToolkit_pubsub, "f")?.close();
    }
    static getClientMetadata(rootURL, apiKey) {
        const resp = (0, sync_fetch_1.default)(rootURL + '/api/client_metadata', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + apiKey,
                Accept: 'application/json',
            },
        });
        if (!resp.ok)
            throw new Error(`Error getting apitoolkit client_metadata ${resp.status}`);
        return resp.json();
    }
    getConfig() {
        return { project_id: __classPrivateFieldGet(this, _APIToolkit_project_id, "f"), config: __classPrivateFieldGet(this, _APIToolkit_config, "f") };
    }
    observeAxios(axiosInstance, urlWildcard, redactHeaders, redactRequestBody, redactResponseBody) {
        return (0, apitoolkit_js_1.observeAxios)(axiosInstance, urlWildcard, redactHeaders, redactRequestBody, redactResponseBody, true, this);
    }
    expressMiddleware(req, res, next) {
        if (!__classPrivateFieldGet(this, _APIToolkit_project_id, "f")) {
            // If APItoolkit wasnt initialized correctly, esp using Async initializer, then log error
            console.log('APIToolkit: expressMiddleware called, but apitoolkit was not correctly setup. Doing nothing.');
            next();
            return;
        }
        apitoolkit_js_1.asyncLocalStorage.run(new Map(), () => {
            apitoolkit_js_1.asyncLocalStorage.getStore().set('AT_client', this);
            apitoolkit_js_1.asyncLocalStorage.getStore().set('AT_project_id', __classPrivateFieldGet(this, _APIToolkit_project_id, "f"));
            apitoolkit_js_1.asyncLocalStorage.getStore().set('AT_config', __classPrivateFieldGet(this, _APIToolkit_config, "f"));
            apitoolkit_js_1.asyncLocalStorage.getStore().set('AT_errors', []);
            const msg_id = (0, uuid_1.v4)();
            apitoolkit_js_1.asyncLocalStorage.getStore().set('AT_msg_id', msg_id);
            if (__classPrivateFieldGet(this, _APIToolkit_config, "f")?.debug) {
                console.log('APIToolkit: expressMiddleware called');
            }
            const start_time = process.hrtime.bigint();
            let respBody = '';
            const oldSend = res.send;
            res.send = (val) => {
                respBody = val;
                return oldSend.apply(res, [val]);
            };
            const onRespFinished = (topic, req, res) => (_err) => {
                res.removeListener('close', onRespFinished(topic, req, res));
                res.removeListener('error', onRespFinished(topic, req, res));
                res.removeListener('finish', onRespFinished(topic, req, res));
                let reqBody = '';
                if (req.body) {
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
                        reqBody = JSON.stringify(req.body);
                    }
                    catch (error) {
                        reqBody = String(req.body);
                    }
                }
                let url_path = req.route?.path || '';
                if (req.baseUrl && req.baseUrl != '') {
                    url_path = req.baseUrl + url_path;
                }
                const errors = apitoolkit_js_1.asyncLocalStorage.getStore()?.get('AT_errors') ?? [];
                if (__classPrivateFieldGet(this, _APIToolkit_project_id, "f")) {
                    const payload = (0, apitoolkit_js_1.buildPayload)({
                        start_time,
                        requestHeaders: req.headers,
                        responseHeaders: res.getHeaders(),
                        sdk_type: 'JsExpress',
                        reqQuery: req.query,
                        raw_url: req.originalUrl,
                        url_path: url_path,
                        reqParams: req.params,
                        status_code: res.statusCode,
                        reqBody,
                        respBody,
                        method: req.method,
                        host: req.hostname,
                        redactRequestBody: __classPrivateFieldGet(this, _APIToolkit_config, "f")?.redactRequestBody ?? [],
                        redactResponseBody: __classPrivateFieldGet(this, _APIToolkit_config, "f")?.redactResponseBody ?? [],
                        redactHeaderLists: __classPrivateFieldGet(this, _APIToolkit_config, "f")?.redactHeaders ?? [],
                        project_id: __classPrivateFieldGet(this, _APIToolkit_project_id, "f"),
                        errors,
                        service_version: __classPrivateFieldGet(this, _APIToolkit_config, "f")?.serviceVersion,
                        tags: __classPrivateFieldGet(this, _APIToolkit_config, "f")?.tags ?? [],
                        msg_id,
                        parent_id: undefined,
                    });
                    if (__classPrivateFieldGet(this, _APIToolkit_config, "f")?.debug) {
                        console.log('APIToolkit: publish prepared payload ');
                        console.dir(payload);
                    }
                    this.publishMessage(payload);
                }
            };
            const onRespFinishedCB = onRespFinished(__classPrivateFieldGet(this, _APIToolkit_topic, "f"), req, res);
            res.on('finish', onRespFinishedCB);
            res.on('error', onRespFinishedCB);
            // res.on('close', onRespFinishedCB)
            try {
                next();
            }
            catch (error) {
                next(error);
            }
        });
    }
    errorHandler(err, req, res, next) {
        void (0, apitoolkit_js_1.ReportError)(err);
        next(err);
    }
}
exports.APIToolkit = APIToolkit;
_APIToolkit_topicName = new WeakMap(), _APIToolkit_topic = new WeakMap(), _APIToolkit_pubsub = new WeakMap(), _APIToolkit_project_id = new WeakMap(), _APIToolkit_config = new WeakMap();
exports.default = APIToolkit;
