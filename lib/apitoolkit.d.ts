import { Application, NextFunction, Request, Response } from 'express';
import { ReportError } from 'apitoolkit-js';
export { ReportError } from 'apitoolkit-js';
export type Config = {
    serviceName: string;
    debug?: boolean;
    redactHeaders?: string[];
    redactRequestBody?: string[];
    redactResponseBody?: string[];
    captureRequestBody?: boolean;
    captureResponseBody?: boolean;
    tags?: string[];
    serviceVersion?: string;
};
export declare class APIToolkit {
    private config;
    private apitoolkit_key?;
    private captureRequestBody?;
    private captureResponseBody?;
    private serviceName;
    constructor(config: Config);
    expressErrorHandler(err: Error, _req: Request, _res: Response, next: NextFunction): void;
    errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void;
    expressMiddleware(req: Request, res: Response, next: NextFunction): void;
    ReportError: typeof ReportError;
    static NewClient(config: Config): APIToolkit;
    private setAttributes;
    private getRequestBody;
    private getUrlPath;
}
export declare const findMatchedRoute: (app: Application, method: string, url: string) => string;
export default APIToolkit;
