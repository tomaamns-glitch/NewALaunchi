export interface AuthData {
  mcToken: string;
  username: string;
  uuid: string;
  mcTokenExpiresAt: number;
  msRefreshToken: string;
  msRefreshTokenExpiresAt: number;
}

const eAPI = (window as any).electronAPI;
export const isElectron = !!eAPI;

export type AuthStep =
  | { stage: "idle" }
  | { stage: "requesting_code" }
  | { stage: "awaiting_user"; userCode: string; verificationUri: string; expiresIn: number }
  | { stage: "polling" }
  | { stage: "authenticating" }
  | { stage: "done"; data: AuthData }
  | { stage: "error"; message: string };

type ProgressCallback = (step: AuthStep) => void;

async function msTokenToMinecraft(msAccessToken: string): Promise<{
  mcToken: string;
  username: string;
  uuid: string;
}> {
  const xblRes = await eAPI.xboxAuth({ msToken: msAccessToken });
  const xstsRes = await eAPI.xstsAuth({ xblToken: xblRes.xblToken });
  const mcRes = await eAPI.minecraftAuth({ xstsToken: xstsRes.xstsToken, userHash: xstsRes.userHash });
  const profile = await eAPI.getMinecraftProfile({ mcToken: mcRes.mcToken });
  return { mcToken: mcRes.mcToken, username: profile.username, uuid: profile.uuid };
}

export async function loginWithMicrosoft(onProgress: ProgressCallback): Promise<AuthData> {
  if (!isElectron) throw new Error("not_electron");

  onProgress({ stage: "requesting_code" });

  let deviceCodeRes: {
    userCode: string;
    verificationUri: string;
    expiresIn: number;
    interval: number;
    deviceCode: string;
  };
  try {
    deviceCodeRes = await eAPI.startDeviceCodeAuth();
  } catch {
    throw new Error("No se pudo conectar con Microsoft. Comprueba tu conexión a internet.");
  }

  onProgress({
    stage: "awaiting_user",
    userCode: deviceCodeRes.userCode,
    verificationUri: deviceCodeRes.verificationUri,
    expiresIn: deviceCodeRes.expiresIn,
  });

  onProgress({ stage: "polling" });

  const tokenRes = await pollForToken(deviceCodeRes.deviceCode, deviceCodeRes.interval, deviceCodeRes.expiresIn);

  onProgress({ stage: "authenticating" });

  const mc = await msTokenToMinecraft(tokenRes.access_token);

  const authData: AuthData = {
    ...mc,
    mcTokenExpiresAt: Date.now() + 86_400_000,
    msRefreshToken: tokenRes.refresh_token,
    msRefreshTokenExpiresAt: Date.now() + 90 * 86_400_000,
  };

  onProgress({ stage: "done", data: authData });
  return authData;
}

export async function silentRefresh(current: AuthData): Promise<AuthData | null> {
  if (!isElectron) return null;
  if (!current.msRefreshToken) return null;
  if (current.msRefreshTokenExpiresAt < Date.now()) return null;

  try {
    const tokenRes = await eAPI.refreshMsToken({ refreshToken: current.msRefreshToken });
    if (!tokenRes?.access_token) return null;

    const mc = await msTokenToMinecraft(tokenRes.access_token);

    return {
      ...mc,
      mcTokenExpiresAt: Date.now() + 86_400_000,
      msRefreshToken: tokenRes.refresh_token ?? current.msRefreshToken,
      msRefreshTokenExpiresAt: tokenRes.refresh_token
        ? Date.now() + 90 * 86_400_000
        : current.msRefreshTokenExpiresAt,
    };
  } catch {
    return null;
  }
}

const MC_TOKEN_REFRESH_BUFFER = 30 * 60 * 1000;

export function mcTokenIsExpiredOrNearExpiry(data: AuthData): boolean {
  return data.mcTokenExpiresAt - Date.now() < MC_TOKEN_REFRESH_BUFFER;
}

async function pollForToken(
  deviceCode: string,
  intervalSecs: number,
  expiresSecs: number
): Promise<{ access_token: string; refresh_token: string }> {
  const deadline = Date.now() + expiresSecs * 1000;
  const intervalMs = (intervalSecs + 1) * 1000;

  while (Date.now() < deadline) {
    await delay(intervalMs);
    const res = await eAPI.pollToken({ deviceCode });

    if (res.access_token) return res;
    if (res.error === "authorization_declined") throw new Error("El inicio de sesión fue rechazado.");
    if (res.error === "expired_token") throw new Error("El código de verificación ha expirado. Inténtalo de nuevo.");
    if (res.error === "slow_down") await delay(intervalMs);
  }

  throw new Error("Tiempo de espera agotado. Inténtalo de nuevo.");
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
