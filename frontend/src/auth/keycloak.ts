import Keycloak from "keycloak-js";

export const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? "http://localhost:8081",
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? "personal-assistant",
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? "web-dashboard",
});

let initPromise: Promise<boolean> | null = null;

/** Va chiamato una sola volta all'avvio dell'app (StrictMode-safe via memoizzazione). */
export function initKeycloak(): Promise<boolean> {
  if (!initPromise) {
    initPromise = keycloak.init({ onLoad: "check-sso", pkceMethod: "S256", silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html` });
  }
  return initPromise;
}
