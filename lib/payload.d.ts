import { Request, Response } from "express";
export type ATError = {
    when: string;
    error_type: string;
    root_error_type?: string;
    message: string;
    root_error_message?: string;
    stack_trace: string;
};
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
export declare function buildPayload(start_time: bigint, req: Request, res: Response, reqBody: string, respBody: string, redactRequestBody: string[], redactResponseBody: string[], redactHeaderLists: string[], project_id: string, errors: ATError[], service_version: string | undefined, tags: string[], msg_id: string, parent_id: string | undefined): Payload;
export declare function redactHeaders(headers: Map<string, string[]>, headersToRedact: string[]): {
    [key: string]: string[];
};
export declare function redactFields(body: string, fieldsToRedact: string[]): string;
