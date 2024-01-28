import axios from "axios"
declare module "axios" {
    export interface InternalAxiosRequestConfig {
        meta: any;
    }
}