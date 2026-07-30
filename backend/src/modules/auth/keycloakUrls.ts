import { env } from "../../config/env.js";

/**
 * L'URL interno e' del tipo http://keycloak:8080/realms/personal-assistant.
 * Da questo derivano il base URL (per l'Admin API, che vive fuori da /realms/x)
 * e il nome del realm.
 */
function splitInternalUrl(): { baseUrl: string; realm: string } {
  const match = env.keycloakInternalUrl.match(/^(.*)\/realms\/([^/]+)\/?$/);
  if (!match) {
    throw new Error(
      `KEYCLOAK_INTERNAL_URL non ha il formato atteso <base>/realms/<realm>: ${env.keycloakInternalUrl}`,
    );
  }
  return { baseUrl: match[1], realm: match[2] };
}

const { baseUrl, realm } = splitInternalUrl();

export const tokenEndpoint = `${baseUrl}/realms/${realm}/protocol/openid-connect/token`;
export const logoutEndpoint = `${baseUrl}/realms/${realm}/protocol/openid-connect/logout`;
export const adminRealmEndpoint = `${baseUrl}/admin/realms/${realm}`;

/**
 * Endpoint di autorizzazione: a differenza degli altri va costruito sull'URL
 * pubblico, perche' e' il browser dell'utente a seguirlo (l'hostname interno
 * del container Keycloak non e' raggiungibile da fuori Docker).
 */
export const publicAuthorizeEndpoint = `${env.keycloakIssuerUrl.replace(/\/$/, "")}/protocol/openid-connect/auth`;

export function requireBackendClientConfig(): { clientId: string; clientSecret: string } {
  const { clientId, clientSecret } = env.keycloakBackendClient;
  if (!clientSecret) {
    throw new Error(
      "Login non configurato: imposta KEYCLOAK_BACKEND_CLIENT_SECRET in backend/.env con il secret del client " +
        `"${clientId}" del realm ${realm} (Keycloak > Clients > ${clientId} > Credentials).`,
    );
  }
  return { clientId, clientSecret };
}
