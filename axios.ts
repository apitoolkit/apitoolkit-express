import {AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig} from "axios";

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    meta: any;
  }
}

export const onRequest = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    config.meta = { startTime: new Date() };
    console.info(`[request] [${JSON.stringify(config)}]`);
    return config;
}

export const onRequestError = (error: AxiosError): Promise<AxiosError> => {
    
    console.error(`[request error] [${JSON.stringify(error)}]`);
    return Promise.reject(error);
}

export const onResponse = (response: AxiosResponse): AxiosResponse => {
    console.log("response", response)
    // console.info(`[response] [${JSON.stringify(response)}]`);
    return response;
}

export const onResponseError = (error: AxiosError): Promise<AxiosError> => {
    // console.error(`[response error] [${JSON.stringify(error)}]`);
    console.log("Response error", error)
    return Promise.reject(error);
}

export function observeAxios(axiosInstance: AxiosInstance): AxiosInstance {
    axiosInstance.interceptors.request.use(onRequest, onRequestError);
    axiosInstance.interceptors.response.use(onResponse, onResponseError);
    return axiosInstance;
}
