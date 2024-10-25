import { Tracer } from "@opentelemetry/api";
import { Application, NextFunction, Request, Response } from "express";
import { ReportError } from "apitoolkit-js";
export { ReportError } from "apitoolkit-js";
export type Config = {
    apiKey: string;
    rootURL?: string;
    debug?: boolean;
    redactHeaders?: string[];
    redactRequestBody?: string[];
    redactResponseBody?: string[];
    captureRequestBody?: boolean;
    captureResponseBody?: boolean;
    clientMetadata?: ClientMetadata;
    tags?: string[];
    serviceVersion?: string;
    tracer: Tracer;
};
type ClientMetadata = {
    project_id: string;
    pubsub_project_id: string;
    topic_id: string;
};
export declare class APIToolkit {
    private tracer;
    private config;
    private project_id?;
    private apitoolkit_key?;
    private captureRequestBody?;
    private captureResponseBody?;
    constructor(config: Config, apiKey: string, projectId?: string);
    expressErrorHandler(err: Error, req: Request, res: Response, next: NextFunction): void;
    expressMiddleware(req: Request, res: Response, next: NextFunction): void;
    ReportError: typeof ReportError;
    static NewClient(config: Config): APIToolkit;
    static getClientMetadata(rootURL: string, apiKey: string): ClientMetadata | undefined;
}
export declare const findMatchedRoute: (app: Application, method: string, url: string) => string;
export default APIToolkit;
