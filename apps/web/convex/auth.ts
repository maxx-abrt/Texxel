// Auth is now handled by WorkOS AuthKit (@workos-inc/authkit-nextjs).
// This file is kept as a stub — nothing below is imported or executed.
export {};

/*
const emailCopy: Record<string, {
  subject: string;
  tagline: string;
  title: string;
  subtitle: string;
  codeLabel: string;
  cta: string;
  fallback: string;
  footerIgnore: string;
  footerCopy: string;
}> = {
  en: {
    subject: "Your sign-in code for A2E Money",
    tagline: "All-in-one money management",
    title: "Sign in to your account",
    subtitle: "Use the code below or click the button to sign in. This code expires in 24 hours.",
    codeLabel: "Your sign-in code",
    cta: "Sign in to A2E Money",
    fallback: "If the button doesn't work, copy and paste this link into your browser:",
    footerIgnore: "If you didn't request this email, you can safely ignore it.",
    footerCopy: "A2E Suite — association2e.org",
  },
  fr: {
    subject: "Votre code de connexion pour A2E Money",
    tagline: "Gestion d'argent tout-en-un",
    title: "Connectez-vous à votre compte",
    subtitle: "Utilisez le code ci-dessous ou cliquez sur le bouton pour vous connecter. Ce code expire dans 24 heures.",
    codeLabel: "Votre code de connexion",
    cta: "Se connecter à A2E Money",
    fallback: "Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :",
    footerIgnore: "Si vous n'avez pas demandé cet email, vous pouvez l'ignorer en toute sécurité.",
    footerCopy: "Suite A2E — association2e.org",
  },
};

function resendEmailProvider() {
  const apiKey = process.env.AUTH_RESEND_KEY;
  const from = process.env.AUTH_RESEND_FROM ?? "A2E Money <auth@association2e.org>";
  return {
    id: "resend",
    type: "email" as const,
    name: "Resend",
    from,
    maxAge: 60 * 60 * 24, // 24 hours
    async sendVerificationRequest(params: any) {
      if (!apiKey) {
        throw new Error("Missing AUTH_RESEND_KEY environment variable");
      }
      const { identifier, url, token, provider } = params;
      const locale = extractLocaleFromUrl(url);
      const copy = emailCopy[locale] ?? emailCopy.fr;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: provider.from,
          to: identifier,
          subject: copy.subject,
          html: buildEmailHtml(url, token, copy),
          text: buildEmailText(url, token, copy),
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Resend error (${res.status}): ${body}`);
      }
    },
  };
}

function extractLocaleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("locale") || "en";
  } catch {
    return "en";
  }
}

function buildEmailHtml(url: string, token: string, copy: typeof emailCopy.en): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${copy.title}</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: #fafaf7;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    @media (prefers-color-scheme: dark) {
      body { background-color: #0a0a0b; }
      .container { background-color: #111113 !important; box-shadow: 0 1px 3px rgba(0,0,0,0.3) !important; }
      .logo, .title, .code { color: #fafafa !important; }
      .subtitle, .code-label, .fallback, .footer { color: #9ca3af !important; }
      .code-box { background-color: #17181b !important; border-color: #1f2024 !important; }
      .divider { background-color: #1f2024 !important; }
      .fallback a { color: #9ca3af !important; }
    }
    .container {
      max-width: 480px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 16px;
      padding: 48px 32px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .logo { font-size: 20px; font-weight: 600; color: #0a0a0a; margin-bottom: 8px; text-align: center; }
    .tagline { font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em; color: #16a34a; margin-bottom: 24px; text-align: center; }
    .title { font-size: 18px; font-weight: 600; color: #0a0a0a; margin-bottom: 8px; text-align: center; }
    .subtitle { font-size: 14px; color: #6b7280; margin-bottom: 32px; text-align: center; line-height: 1.5; }
    .code-box { background: #f4f4f1; border: 1px solid #e7e7e1; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .code-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 8px; }
    .code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 28px; font-weight: 600; color: #0a0a0a; letter-spacing: 0.15em; }
    .divider { height: 1px; background: #e7e7e1; margin: 32px 0; }
    .cta { display: block; width: 100%; background: #0a0a0a; color: #ffffff; text-decoration: none; text-align: center; padding: 14px 0; border-radius: 10px; font-size: 15px; font-weight: 500; margin-bottom: 16px; }
    .fallback { font-size: 13px; color: #6b7280; text-align: center; line-height: 1.5; }
    .fallback a { color: #6b7280; text-decoration: underline; }
    .footer { margin-top: 32px; font-size: 12px; color: #6b7280; text-align: center; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">A2E Money</div>
    <div class="tagline">${copy.tagline}</div>
    <div class="title">${copy.title}</div>
    <div class="subtitle">${copy.subtitle}</div>
    <div class="code-box">
      <div class="code-label">${copy.codeLabel}</div>
      <div class="code">${token}</div>
    </div>
    <a href="${url}" class="cta">${copy.cta}</a>
    <div class="divider"></div>
    <div class="fallback">
      ${copy.fallback}<br/>
      <a href="${url}">${url}</a>
    </div>
    <div class="footer">
      ${copy.footerIgnore}<br/>
      &copy; ${copy.footerCopy}
    </div>
  </div>
</body>
</html>`;
}

function buildEmailText(url: string, token: string, copy: typeof emailCopy.en): string {
  return `A2E Money — ${copy.tagline}\n\n${copy.title}\n\n${copy.codeLabel}: ${token}\n\n${copy.cta}: ${url}\n\n${copy.subtitle}\n\n${copy.footerIgnore}\n\n${copy.footerCopy}`;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    resendEmailProvider(),
    // Email + password — works on any domain (no redirect), used by Bureau for
    // direct sign-up/sign-in and for automated testing. Additive: A2EMoney is
    // unaffected.
    Password({ id: "password" }),
  ],
});
*/
