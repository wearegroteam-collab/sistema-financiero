export function getAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error("Falta NEXT_PUBLIC_APP_URL.");
  }
  return appUrl.replace(/\/+$/, "");
}

export function getAuthCallbackUrl(flow?: "recovery") {
  const callbackUrl = `${getAppUrl()}/auth/callback`;
  return flow === "recovery" ? `${callbackUrl}?type=recovery` : callbackUrl;
}
