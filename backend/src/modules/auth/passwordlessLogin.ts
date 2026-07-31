import { randomBytes } from "node:crypto";
import { adminRealmEndpoint } from "./keycloakUrls.js";
import { getAdminAccessToken, findUserIdByEmail, registerUser } from "./keycloakAdmin.js";
import { loginWithPassword, AuthError, type TokenSet } from "./login.js";

/**
 * Accesso senza password: l'utente prova di controllare la propria email
 * inserendo il codice ricevuto, e a quel punto il backend emette i token.
 *
 * Keycloak non ha un modo nativo di emettere token per un utente senza una
 * credenziale, e le alternative (token exchange, impersonation) richiedono
 * feature preview e permessi molto piu' ampi. Qui il backend imposta una
 * password casuale usa-e-getta via Admin API e la spende immediatamente sul
 * direct grant: nessuno la vede mai, cambia a ogni accesso, e Keycloak resta
 * l'unico emittente dei token — cosi' la verifica JWT, il WebSocket e il bot
 * continuano a funzionare senza modifiche.
 */
async function issueTokensFor(email: string): Promise<TokenSet> {
  const userId = await findUserIdByEmail(email);
  if (!userId) throw new AuthError("Utente non trovato.", 404);

  // Lunga e casuale: deve passare la password policy del realm e non serve a
  // nessuno oltre alla riga sotto.
  const oneTimePassword = `${randomBytes(24).toString("base64url")}aA1!`;

  const token = await getAdminAccessToken();
  const res = await fetch(`${adminRealmEndpoint}/users/${userId}/reset-password`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "password", value: oneTimePassword, temporary: false }),
  });
  if (!res.ok) {
    throw new AuthError(`Impossibile completare l'accesso (${res.status}).`, 502);
  }

  return loginWithPassword(email, oneTimePassword);
}

/**
 * Completa l'accesso dopo che il codice email e' stato verificato. Se l'email
 * non ha ancora un account, lo crea: chi riceve il codice ha dimostrato di
 * possedere quella casella, che e' tutto quello che serve per entrare.
 */
export async function completePasswordlessLogin(email: string, displayName?: string): Promise<TokenSet> {
  const normalized = email.trim();
  const existing = await findUserIdByEmail(normalized);

  if (!existing) {
    // Password casuale anche qui: l'account nasce senza una password nota, e
    // verra' comunque rigenerata a ogni accesso.
    await registerUser({
      email: normalized,
      password: `${randomBytes(24).toString("base64url")}aA1!`,
      displayName,
    });
  }

  return issueTokensFor(normalized);
}
