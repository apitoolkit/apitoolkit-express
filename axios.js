"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPayload = exports.observeAxios = exports.onResponseError = exports.onResponse = exports.onRequestError = exports.onRequest = void 0;
const payload_1 = require("./payload");
const index_1 = require("./index");
const onRequest = (config) => {
    config.meta = { startTime: process.hrtime.bigint() };
    return config;
};
exports.onRequest = onRequest;
const onRequestError = (error) => {
    console.error(`[request error] [${JSON.stringify(error)}]`);
    return Promise.reject(error);
};
exports.onRequestError = onRequestError;
const onResponse = (urlWildcard, redactHeaderLists, redactRequestBody, redactResponseBody) => (response) => {
    if (index_1.asyncLocalStorage.getStore() == null) {
        console.log("APIToolkit: observeAxios used outside of the APIToolkit middleware's scope. Use the APIToolkitClient.observeAxios instead, if you're not in a web context.");
        return response;
    }
    const req = response.config;
    const res = response;
    const reqBody = JSON.stringify(req.data || {});
    const respBody = JSON.stringify(res.data || {});
    const project_id = index_1.asyncLocalStorage.getStore().get("AT_project_id");
    const ATClient = index_1.asyncLocalStorage.getStore().get("AT_client");
    const ATConfig = index_1.asyncLocalStorage.getStore().get("AT_config");
    const parent_id = index_1.asyncLocalStorage.getStore().get("AT_msg_id");
    var errors = [];
    const payload = buildPayload(response.config.meta.startTime, req, res, reqBody, respBody, redactRequestBody, redactResponseBody, redactHeaderLists, project_id, ATConfig.serviceVersion, errors, ATConfig.tags ?? [], parent_id, urlWildcard);
    ATClient.publishMessage(payload);
    return response;
};
exports.onResponse = onResponse;
const onResponseError = (urlWildcard, redactHeaderLists, redactRequestBody, redactResponseBody) => (error) => {
    if (index_1.asyncLocalStorage.getStore() == null) {
        console.log("APIToolkit: observeAxios used outside of the APIToolkit middleware's scope. Use the APIToolkitClient.observeAxios instead, if you're not in a web context.");
        return Promise.reject(error);
    }
    const req = error.config;
    const res = error.response;
    const reqBody = JSON.stringify(req?.data || {});
    const respBody = JSON.stringify(res?.data || {});
    const project_id = index_1.asyncLocalStorage.getStore().get("AT_project_id");
    const ATClient = index_1.asyncLocalStorage.getStore().get("AT_client");
    const ATConfig = index_1.asyncLocalStorage.getStore().get("AT_config");
    const parent_id = index_1.asyncLocalStorage.getStore().get("AT_msg_id");
    var errors = [];
    const payload = buildPayload(error.config?.meta.startTime ?? process.hrtime.bigint(), error.request, res, reqBody, respBody, redactRequestBody, redactResponseBody, redactHeaderLists, project_id, ATConfig.serviceVersion, errors, ATConfig.tags ?? [], parent_id, urlWildcard);
    ATClient.publishMessage(payload);
    return Promise.reject(error);
};
exports.onResponseError = onResponseError;
function observeAxios(axiosInstance, urlWildcard = undefined, redactHeaders = [], redactRequestBody = [], redactResponseBody = []) {
    axiosInstance.interceptors.request.use(exports.onRequest, exports.onRequestError);
    axiosInstance.interceptors.response.use((0, exports.onResponse)(urlWildcard, redactHeaders, redactRequestBody, redactResponseBody), (0, exports.onResponseError)(urlWildcard, redactHeaders, redactRequestBody, redactResponseBody));
    return axiosInstance;
}
exports.observeAxios = observeAxios;
function buildPayload(start_time, req, res, reqBody, respBody, redactRequestBody, redactResponseBody, redactHeaderLists, project_id, serviceVersion, errors, tags, parent_id, urlWildcard) {
    const reqObjEntries = Object.entries(req.headers || {}).map(([k, v]) => [k, Array.isArray(v) ? v : [v]]);
    const reqHeaders = new Map(reqObjEntries);
    const resObjEntries = Object.entries(res?.headers ?? []).map(([k, v]) => [k, Array.isArray(v) ? v : [v]]);
    const resHeaders = new Map(resObjEntries);
    const { path: urlPath, rawUrl, queryParams: params } = getPathAndQueryParamsFromURL(req.url ?? "");
    const queryObjEntries = Object.entries(req.params || params).map(([k, v]) => {
        if (typeof v === "string")
            return [k, [v]];
        return [k, v];
    });
    const queryParams = Object.fromEntries(queryObjEntries);
    const payload = {
        duration: Number(process.hrtime.bigint() - start_time),
        host: req.baseURL ?? "",
        method: req.method?.toUpperCase() ?? "",
        path_params: {},
        project_id: project_id,
        proto_minor: 1,
        proto_major: 1,
        query_params: queryParams,
        raw_url: rawUrl,
        referer: req.headers?.referer ?? "",
        request_body: Buffer.from((0, payload_1.redactFields)(reqBody, redactRequestBody)).toString("base64"),
        request_headers: (0, payload_1.redactHeaders)(reqHeaders, redactHeaderLists),
        response_body: Buffer.from((0, payload_1.redactFields)(respBody, redactResponseBody)).toString("base64"),
        response_headers: (0, payload_1.redactHeaders)(resHeaders, redactHeaderLists),
        sdk_type: "JsAxiosOutgoing",
        status_code: res?.status || 404,
        timestamp: new Date().toISOString(),
        url_path: urlWildcard ?? urlPath,
        service_version: serviceVersion,
        errors: errors,
        tags: tags,
        parent_id: parent_id,
    };
    return payload;
}
exports.buildPayload = buildPayload;
function getPathAndQueryParamsFromURL(url) {
    try {
        const urlObject = new URL(url);
        const path = urlObject.pathname;
        const queryParams = {};
        const queryParamsString = urlObject.search;
        urlObject.searchParams.forEach((value, key) => {
            queryParams[key] = value;
        });
        return { path, queryParams, rawUrl: path + queryParamsString };
    }
    catch (error) {
        return { path: "", queryParams: {}, rawUrl: "" };
    }
}
