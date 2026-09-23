export { api, PRIVACY_URL } from "./endpoints";
export { apiRequest, type HttpMethod, type ApiRequestOptions, type QueryParams } from "./http";
export {
  ApiClientError,
  ERROR_MESSAGES_FR,
  NETWORK_ERROR_MESSAGE_FR,
  TIMEOUT_ERROR_MESSAGE_FR,
  UNEXPECTED_RESPONSE_MESSAGE_FR,
  type ApiClientErrorKind,
} from "./errors";
export { getSession, setSession, clearSession, getToken } from "./session";
export { onUnauthorized } from "./authEvents";
export { queryClient } from "./queryClient";
export { API_BASE_URL } from "./env";
