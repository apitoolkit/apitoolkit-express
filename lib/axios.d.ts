import { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { ATError, Payload } from "./payload";
declare module "axios" {
    interface InternalAxiosRequestConfig {
        meta: any;
    }
}
export declare const onRequest: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig;
export declare const onRequestError: (error: AxiosError) => Promise<AxiosError>;
export declare const onResponse: (urlWildcard: string | undefined, redactHeaderLists: string[], redactRequestBody: string[], redactResponseBody: string[]) => (response: AxiosResponse) => AxiosResponse;
export declare const onResponseError: (urlWildcard: string | undefined, redactHeaderLists: string[], redactRequestBody: string[], redactResponseBody: string[]) => (error: AxiosError) => Promise<AxiosError>;
export declare function observeAxios(axiosInstance: AxiosInstance, urlWildcard?: string | undefined, redactHeaders?: string[], redactRequestBody?: string[], redactResponseBody?: string[]): AxiosInstance;
export declare function buildPayload(start_time: bigint, req: AxiosRequestConfig, res: AxiosResponse | undefined, reqBody: string, respBody: string, redactRequestBody: string[], redactResponseBody: string[], redactHeaderLists: string[], project_id: string, serviceVersion: string | undefined, errors: ATError[], tags: string[], parent_id: string, urlWildcard: string | undefined): Payload;
