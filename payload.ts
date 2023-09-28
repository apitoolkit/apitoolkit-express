import { PubSub, Topic } from "@google-cloud/pubsub";
import { NextFunction, Request, Response } from "express";
import { AsyncLocalStorage } from "async_hooks";
import jsonpath from "jsonpath";

// ATError is the Apitoolkit error type/object
export type ATError = {
  when: string; // timestamp
  error_type: string;
  root_error_type?: string;
  message: string;
  root_error_message?: string;
  stack_trace: string;
};

// Payload is an APIToolkit Request Mesasge. It is very standardize,
// and all the other SDKs send this exact type to apitoolkit backend servers as well.
export type Payload = {
  duration: number;
  host: string;
  method: string;
  path_params: Object;
  project_id: string;
  proto_major: number;
  proto_minor: number;
  query_params: Object;
  raw_url: string;
  referer: string;
  request_body: string;
  request_headers: Object;
  response_body: string;
  response_headers: Object;
  sdk_type: string;
  status_code: number;
  timestamp: string;
  url_path: string;
  errors: ATError[];
  service_version?: string;
  tags: string[];
  msg_id?: string;
  parent_id?: string;
};

export function buildPayload(
  start_time: bigint,
  req: Request,
  res: Response,
  reqBody: string,
  respBody: string,
  redactRequestBody: string[],
  redactResponseBody: string[],
  redactHeaderLists: string[],
  project_id: string,
  errors: ATError[],
  service_version: string | undefined,
  tags: string[],
  msg_id: string,
  parent_id: string | undefined
): Payload {
  const reqObjEntries: Array<[string, string[]]> = Object.entries(req.headers).map(
    ([k, v]: [string, any]): [string, string[]] => [k, Array.isArray(v) ? v : [v]]
  );
  const reqHeaders = new Map<string, string[]>(reqObjEntries);

  const resObjEntries: Array<[string, string[]]> = Object.entries(res.getHeaders()).map(
    ([k, v]: [string, any]): [string, string[]] => [k, Array.isArray(v) ? v : [v]]
  );
  const resHeaders = new Map<string, string[]>(resObjEntries);


  const queryObjEntries = Object.entries(req.query).map(([k, v]) => {
    if (typeof v === "string") return [k, [v]];
    return [k, v];
  });
  const queryParams = Object.fromEntries(queryObjEntries);

  const pathParams = req.params ?? {};
  let urlPath = req.route?.path ?? "";
  if (req.baseUrl && req.baseUrl !== "") {
    urlPath = req.baseUrl + urlPath;
  }

  const payload: Payload = {
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
  return payload;
}

export function redactHeaders(headers: Map<string, string[]>, headersToRedact: string[]) {
  const redactedHeaders: { [key: string]: string[] } = {};
  const headersToRedactLowerCase = headersToRedact.map((header) => header.toLowerCase());

  for (let [key, value] of headers) {
    const lowerKey = key.toLowerCase();
    const isRedactKey = headersToRedactLowerCase.includes(lowerKey) || lowerKey === "cookie";
    redactedHeaders[key] = isRedactKey ? ["[CLIENT_REDACTED]"] : value;
  }

  return redactedHeaders;
}

export function redactFields(body: string, fieldsToRedact: string[]): string {
  try {
    const bodyOB = JSON.parse(body);
    fieldsToRedact.forEach((path) => {
      jsonpath.apply(bodyOB, path, function () {
        return "[CLIENT_REDACTED]";
      });
    });
    return JSON.stringify(bodyOB);
  } catch (error) {
    return body;
  }
}
