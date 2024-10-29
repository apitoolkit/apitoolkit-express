import { NextFunction, Request, Response } from 'express';
import { ReportError } from 'apitoolkit-js';
export { ReportError } from 'apitoolkit-js';
type Config = {
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
export declare function expressMiddleware(config: Config): (req: Request, res: Response, next: NextFunction) => void;
export declare function expressErrorHandler(err: Error, _req: Request, _res: Response, next: NextFunction): void;
declare const APIToolkit: {
    expressMiddleware: typeof expressMiddleware;
    expressErrorHandler: typeof expressErrorHandler;
    reportError: typeof ReportError;
};
export default APIToolkit;
