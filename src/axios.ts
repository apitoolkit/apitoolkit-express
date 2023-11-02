import {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { ATError, Payload, redactFields, redactHeaders } from "./payload";
import { APIToolkit, asyncLocalStorage, Config } from "./index";

declare module "axios" {
  export interface InternalAxiosRequestConfig {
    meta: any;
  }
}

export const onRequest = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
  config.meta = { startTime: process.hrtime.bigint() };
  return config;
};

export const onRequestError = (error: AxiosError): Promise<AxiosError> => {
  console.error(`[request error] [${JSON.stringify(error)}]`);
  return Promise.reject(error);
};

export const onResponse =
  (
    urlWildcard: string | undefined,
    redactHeaderLists: string[],
    redactRequestBody: string[],
    redactResponseBody: string[]
  ) =>
    (response: AxiosResponse): AxiosResponse => {
      if (asyncLocalStorage.getStore() == null) {
        console.log(
          "APIToolkit: observeAxios used outside of the APIToolkit middleware's scope. Use the APIToolkitClient.observeAxios instead, if you're not in a web context."
        );
        return response;
      }
      const req = response.config;
      const res = response;

      const reqBody = JSON.stringify(req.data || {});
      const respBody = JSON.stringify(res.data || {});
      const project_id = asyncLocalStorage.getStore()!.get("AT_project_id");
      const ATClient = asyncLocalStorage.getStore()!.get("AT_client");
      const ATConfig: Config = asyncLocalStorage.getStore()!.get("AT_config");
      const parent_id: string = asyncLocalStorage.getStore()!.get("AT_msg_id");

      var errors: ATError[] = [];

      const payload = buildPayload(
        response.config.meta.startTime,
        req,
        res,
        reqBody,
        respBody,
        redactRequestBody,
        redactResponseBody,
        redactHeaderLists,
        project_id,
        ATConfig.serviceVersion,
        errors,
        ATConfig.tags ?? [],
        parent_id,
        urlWildcard
      );

      ATClient.publishMessage(payload);
      return response;
    };

export const onResponseError =
  (
    urlWildcard: string | undefined,
    redactHeaderLists: string[],
    redactRequestBody: string[],
    redactResponseBody: string[]
  ) =>
    (error: AxiosError): Promise<AxiosError> => {
      if (asyncLocalStorage.getStore() == null) {
        console.log(
          "APIToolkit: observeAxios used outside of the APIToolkit middleware's scope. Use the APIToolkitClient.observeAxios instead, if you're not in a web context."
        );
        return Promise.reject(error);
      }

      const req = error.config;
      const res = error.response;

      const reqBody = JSON.stringify(req?.data || {});
      const respBody = JSON.stringify(res?.data || {});
      const project_id = asyncLocalStorage.getStore()!.get("AT_project_id");
      const ATClient: APIToolkit = asyncLocalStorage.getStore()!.get("AT_client");
      const ATConfig: Config = asyncLocalStorage.getStore()!.get("AT_config");
      const parent_id: string = asyncLocalStorage.getStore()!.get("AT_msg_id");

      var errors: ATError[] = [];

      const payload = buildPayload(
        error.config?.meta.startTime ?? process.hrtime.bigint(),
        error.request,
        res,
        reqBody,
        respBody,
        redactRequestBody,
        redactResponseBody,
        redactHeaderLists,
        project_id,
        ATConfig.serviceVersion,
        errors,
        ATConfig.tags ?? [],
        parent_id,
        urlWildcard
      );

      ATClient.publishMessage(payload);

      return Promise.reject(error);
    };

export function observeAxios(
  axiosInstance: AxiosInstance,
  urlWildcard: string | undefined = undefined,
  redactHeaders: string[] = [],
  redactRequestBody: string[] = [],
  redactResponseBody: string[] = []
): AxiosInstance {
  axiosInstance.interceptors.request.use(onRequest, onRequestError);
  axiosInstance.interceptors.response.use(
    onResponse(urlWildcard, redactHeaders, redactRequestBody, redactResponseBody),
    onResponseError(urlWildcard, redactHeaders, redactRequestBody, redactResponseBody)
  );
  return axiosInstance;
}

export function buildPayload(
  start_time: bigint,
  req: AxiosRequestConfig,
  res: AxiosResponse | undefined,
  reqBody: string,
  respBody: string,
  redactRequestBody: string[],
  redactResponseBody: string[],
  redactHeaderLists: string[],
  project_id: string,
  serviceVersion: string | undefined,
  errors: ATError[],
  tags: string[],
  parent_id: string,
  urlWildcard: string | undefined
): Payload {
  const reqObjEntries: Array<[string, string[]]> = Object.entries(req.headers || {}).map(
    ([k, v]: [string, any]): [string, string[]] => [k, Array.isArray(v) ? v : [v]]
  );
  const reqHeaders = new Map<string, string[]>(reqObjEntries);

  const resObjEntries: Array<[string, string[]]> = Object.entries(res?.headers ?? []).map(
    ([k, v]: [string, any]): [string, string[]] => [k, Array.isArray(v) ? v : [v]]
  );
  const resHeaders = new Map<string, string[]>(resObjEntries);
  const { path: urlPath, rawUrl, queryParams: params } = getPathAndQueryParamsFromURL(req.url ?? "");
  const queryObjEntries = Object.entries(req.params || params).map(([k, v]) => {
    if (typeof v === "string") return [k, [v]];
    return [k, v];
  });
  const queryParams = Object.fromEntries(queryObjEntries);
  const payload: Payload = {
    duration: Number(process.hrtime.bigint() - start_time),
    host: req.baseURL ?? "", // AxiosRequestConfig does not have a hostname property, using baseURL as a substitute
    method: req.method?.toUpperCase() ?? "",
    path_params: {}, // Axios does not have a direct equivalent to Express' path parameters
    project_id: project_id,
    proto_minor: 1, // Update as needed
    proto_major: 1, // Update as needed
    query_params: queryParams,
    raw_url: rawUrl,
    referer: req.headers?.referer ?? "",
    request_body: Buffer.from(redactFields(reqBody, redactRequestBody)).toString("base64"),
    request_headers: redactHeaders(reqHeaders, redactHeaderLists),
    response_body: Buffer.from(redactFields(respBody, redactResponseBody)).toString("base64"),
    response_headers: redactHeaders(resHeaders, redactHeaderLists),
    sdk_type: "JsAxiosOutgoing", // Update the sdk_type since this is not Express.js anymore
    status_code: res?.status || 404,
    timestamp: new Date().toISOString(),
    url_path: urlWildcard ?? urlPath,
    service_version: serviceVersion,
    errors: errors,
    tags: tags,
    parent_id: parent_id,
  };
  return payload;
}


function getPathAndQueryParamsFromURL(url: string) {
  try {
    const urlObject = new URL(url);
    const path = urlObject.pathname;
    const queryParams: { [key: string]: string } = {};
    const queryParamsString = urlObject.search;
    urlObject.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    return { path, queryParams, rawUrl: path + queryParamsString };
  } catch (error) {
    return { path: "", queryParams: {}, rawUrl: "" };
  }
}
