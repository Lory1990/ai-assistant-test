import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env.js";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  const { host, port, secure, user, password } = env.smtp;
  if (!host) {
    throw new Error(
      "SMTP non configurato: imposta SMTP_HOST (e porta/credenziali) in backend/.env. " +
        'In sviluppo lo stack include Mailpit: bastano SMTP_HOST=mailpit e SMTP_PORT=1025, ' +
        "e le email finiscono su http://localhost:8025 invece di essere spedite.",
    );
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      // Mailpit non richiede autenticazione: passare auth con utente vuoto
      // farebbe fallire la connessione.
      ...(user ? { auth: { user, pass: password } } : {}),
    });
  }
  return transporter;
}

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(input: SendMailInput): Promise<void> {
  await getTransporter().sendMail({ from: env.smtp.from, ...input });
}
