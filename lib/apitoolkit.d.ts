import { Span } from "@opentelemetry/api";
import { Application, NextFunction, Request, Response } from "express";
export type Config = {
    apiKey: string;
    serviceName: string;
    rootURL?: string;
    debug?: boolean;
    redactHeaders?: string[];
    redactRequestBody?: string[];
    redactResponseBody?: string[];
    clientMetadata?: ClientMetadata;
    ignoreEndpoints?: string[];
    serviceVersion?: string;
    tags?: string[];
    otelInstrumentated: boolean;
};
type ClientMetadata = {
    project_id: string;
    pubsub_project_id: string;
    topic_id: string;
};
declare class APIToolkit {
    private otelSDk?;
    private tracer?;
    private config;
    private project_id?;
    private currentSpan;
    constructor(config: Config, apiKey: string, projectId?: string);
    private updateCurrentSpan;
    handleHTTPRequestSpan(span: Span): void;
    expressMiddleware(req: Request, res: Response, next: NextFunction): void;
    static NewClient(config: Config): APIToolkit;
    static getClientMetadata(rootURL: string, apiKey: string): ClientMetadata | undefined;
}
export declare const findMatchedRoute: (app: Application, method: string, url: string) => string;
export default APIToolkit;
