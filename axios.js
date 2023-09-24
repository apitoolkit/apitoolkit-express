"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.observeAxios = exports.onResponseError = exports.onResponse = exports.onRequestError = exports.onRequest = void 0;
const onRequest = (config) => {
    config.meta = { startTime: new Date() };
    console.info(`[request] [${JSON.stringify(config)}]`);
    return config;
};
exports.onRequest = onRequest;
const onRequestError = (error) => {
    console.error(`[request error] [${JSON.stringify(error)}]`);
    return Promise.reject(error);
};
exports.onRequestError = onRequestError;
const onResponse = (response) => {
    console.log("response", response);
    // console.info(`[response] [${JSON.stringify(response)}]`);
    return response;
};
exports.onResponse = onResponse;
const onResponseError = (error) => {
    // console.error(`[response error] [${JSON.stringify(error)}]`);
    console.log("Response error", error);
    return Promise.reject(error);
};
exports.onResponseError = onResponseError;
function observeAxios(axiosInstance) {
    axiosInstance.interceptors.request.use(exports.onRequest, exports.onRequestError);
    axiosInstance.interceptors.response.use(exports.onResponse, exports.onResponseError);
    return axiosInstance;
}
exports.observeAxios = observeAxios;
