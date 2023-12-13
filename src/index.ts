import { APIToolkit } from './apitoolkit';
export { APIToolkit, Config } from './apitoolkit';
export { asyncLocalStorage, observeAxios, ReportError } from "apitoolkit-js"
declare module "axios" {
    export interface InternalAxiosRequestConfig {
        meta: any;
    }
}
export default APIToolkit;
