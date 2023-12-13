import { APIToolkit } from './apitoolkit';
export { APIToolkit, Config } from './apitoolkit';
export { asyncLocalStorage, observeAxios, ReportError } from "apitoolkit-js";
declare module "axios" {
    interface InternalAxiosRequestConfig {
        meta: any;
    }
}
export default APIToolkit;
