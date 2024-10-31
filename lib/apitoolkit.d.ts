import { NextFunction, Request, Response } from 'express';
import { ReportError } from 'apitoolkit-js';
type Config = {
    serviceName?: string;
    debug?: boolean;
    redactHeaders?: string[];
    redactRequestBody?: string[];
    redactResponseBody?: string[];
    captureRequestBody?: boolean;
    captureResponseBody?: boolean;
    tags?: string[];
    serviceVersion?: string;
};
declare function middleware(config?: Config): (req: Request, res: Response, next: NextFunction) => void;
declare function errorMiddleware(): (err: Error, _req: Request, _res: Response, next: NextFunction) => void;
export declare const APIToolkit: {
    middleware: typeof middleware;
    errorMiddleware: typeof errorMiddleware;
    reportError: typeof ReportError;
};
export default APIToolkit;
