import { PubSub } from '@google-cloud/pubsub';
import { ReportError } from 'apitoolkit-js';
import { AxiosInstance, AxiosStatic } from 'axios';
import { NextFunction, Request, Response } from 'express';
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
    path_params: Record<string, any>;
    project_id: string;
    proto_major: number;
    proto_minor: number;
    query_params: Record<string, any>;
    raw_url: string;
    referer: string;
    request_body: string;
    request_headers: Record<string, any>;
    response_body: string;
    response_headers: Record<string, any>;
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
export type Config = {
    apiKey: string;
    rootURL?: string;
    debug?: boolean;
    redactHeaders?: string[];
    redactRequestBody?: string[];
    redactResponseBody?: string[];
    clientMetadata?: ClientMetadata;
    serviceVersion?: string;
    tags?: string[];
    monitorAxios?: AxiosInstance;
};
type ClientMetadata = {
    project_id: string;
    pubsub_project_id: string;
    topic_id: string;
    pubsub_push_service_account: any;
};
export declare class APIToolkit {
    #private;
    publishMessage: (payload: Payload) => void;
    constructor(pubsub: PubSub | undefined, topicName: string, project_id: string, config: Config);
    static NewClient(config: Config): APIToolkit;
    close(): Promise<void>;
    static getClientMetadata(rootURL: string, apiKey: string): ClientMetadata;
    getConfig(): {
        project_id: string;
        config: Config;
    };
    observeAxios(axiosInstance: AxiosStatic, urlWildcard?: string | undefined, redactHeaders?: string[] | undefined, redactRequestBody?: string[] | undefined, redactResponseBody?: string[] | undefined): AxiosInstance;
    ReportError: typeof ReportError;
    expressMiddleware(req: Request, res: Response, next: NextFunction): void;
    errorHandler(err: any, req: Request, res: Response, next: NextFunction): void;
}
export default APIToolkit;
