"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactFields = exports.redactHeaders = exports.buildPayload = void 0;
const jsonpath_1 = __importDefault(require("jsonpath"));
function buildPayload(start_time, req, res, reqBody, respBody, redactRequestBody, redactResponseBody, redactHeaderLists, project_id, errors, service_version, tags, msg_id, parent_id) {
    const reqObjEntries = Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v : [v]]);
    const reqHeaders = new Map(reqObjEntries);
    console.log("req", req.headers, reqHeaders);
    const resObjEntries = Object.entries(res.getHeaders()).map(([k, v]) => [k, Array.isArray(v) ? v : [v]]);
    const resHeaders = new Map(resObjEntries);
    console.log("res", res.getHeaders, resHeaders);
    const queryObjEntries = Object.entries(req.query).map(([k, v]) => {
        if (typeof v === "string")
            return [k, [v]];
        return [k, v];
    });
    const queryParams = Object.fromEntries(queryObjEntries);
    const pathParams = req.params ?? {};
    let urlPath = req.route?.path ?? "";
    if (req.baseUrl && req.baseUrl !== "") {
        urlPath = req.baseUrl + urlPath;
    }
    const payload = {
        duration: Number(process.hrtime.bigint() - start_time),
        host: req.hostname,
        method: req.method,
        path_params: pathParams,
        project_id: project_id,
        proto_minor: 1,
        proto_major: 1,
        query_params: queryParams,
        raw_url: req.originalUrl,
        referer: req.headers.referer ?? "",
        request_body: Buffer.from(redactFields(reqBody, redactRequestBody)).toString("base64"),
        request_headers: redactHeaders(reqHeaders, redactHeaderLists),
        response_body: Buffer.from(redactFields(respBody, redactResponseBody)).toString("base64"),
        response_headers: redactHeaders(resHeaders, redactHeaderLists),
        sdk_type: "JsExpress",
        status_code: res.statusCode,
        timestamp: new Date().toISOString(),
        url_path: urlPath,
        errors,
        service_version,
        tags, msg_id, parent_id,
    };
    console.log(payload);
    return payload;
}
exports.buildPayload = buildPayload;
function redactHeaders(headers, headersToRedact) {
    const redactedHeaders = {};
    const headersToRedactLowerCase = headersToRedact.map((header) => header.toLowerCase());
    for (let [key, value] of headers) {
        const lowerKey = key.toLowerCase();
        const isRedactKey = headersToRedactLowerCase.includes(lowerKey) || lowerKey === "cookie";
        redactedHeaders[key] = isRedactKey ? ["[CLIENT_REDACTED]"] : value;
    }
    return redactedHeaders;
}
exports.redactHeaders = redactHeaders;
function redactFields(body, fieldsToRedact) {
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
exports.redactFields = redactFields;
