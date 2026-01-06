export const getApiBaseUrl = (betterauth: boolean = false): string => {
  const isProduction = process.env.NODE_ENV === "production";

  if (betterauth) {
    return isProduction ? "https://trykimu.com" : "http://localhost:5173";  // frontend  NOTE: this will be deleted, it is repeating logic. It'll be the default.
  } else {
    return isProduction ? "https://trykimu.com/render" : "http://localhost:8000";   // remotion render server
  }
};

export const apiUrl = (endpoint: string, betterauth: boolean = false): string => {
  const baseUrl = getApiBaseUrl(betterauth);
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  return path ? `${baseUrl}${path}` : `${baseUrl}`;
};