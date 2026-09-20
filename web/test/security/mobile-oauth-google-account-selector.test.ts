import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Auth, skipCSRFCheck } from "@auth/core";
import Google from "@auth/core/providers/google";
import { startMobileOAuth } from "../../src/lib/mobileOAuth";

function responseWithCookies(response: Response, cookies: string[] = []): Response {
  Object.assign(response.headers, { getSetCookie: () => cookies });
  return response;
}

describe("OAuth Google mobile — seletor de conta", () => {
  it("envia prompt=select_account ao signin Google e preserva CSRF/callbackUrl", async () => {
    const originalFetch = globalThis.fetch;
    const requests: Request[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      requests.push(request);

      if (request.url.endsWith("/api/auth/csrf")) {
        return responseWithCookies(
          Response.json({ csrfToken: "csrf-token" }),
          ["authjs.csrf-token=csrf-cookie; Path=/; HttpOnly"],
        );
      }

      return responseWithCookies(
        new Response(null, {
          status: 302,
          headers: { location: "https://accounts.google.com/o/oauth2/v2/auth" },
        }),
        ["authjs.pkce.code_verifier=pkce-cookie; Path=/; HttpOnly"],
      );
    }) as typeof fetch;

    try {
      const response = await startMobileOAuth(
        new Request(
          "https://dular.test/api/auth/mobile-google?role=empregador&callbackUrl=%2Fauth%2Fcallback%2Fempregador%3Fplatform%3Dmobile",
        ),
        "google",
      );

      assert.equal(response.status, 302);
      assert.equal(response.headers.get("location"), "https://accounts.google.com/o/oauth2/v2/auth");
      assert.equal(requests.length, 2);

      const signinRequest = requests[1];
      const signinUrl = new URL(signinRequest.url);
      assert.equal(signinUrl.pathname, "/api/auth/signin/google");
      assert.equal(signinUrl.searchParams.get("prompt"), "select_account");
      assert.equal(await signinRequest.text(), "csrfToken=csrf-token&callbackUrl=%2Fauth%2Fcallback%2Fempregador%3Fplatform%3Dmobile");
      assert.match(signinRequest.headers.get("cookie") ?? "", /authjs\.csrf-token=csrf-cookie/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("Auth.js beta.32 inclui o seletor, PKCE e os parâmetros Google na URL de autorização", async () => {
    const response = await Auth(
      new Request("https://dular.test/api/auth/signin/google?prompt=select_account", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          callbackUrl: "/auth/callback/empregador?platform=mobile",
        }),
      }),
      {
        basePath: "/api/auth",
        trustHost: true,
        secret: "test-secret-with-sufficient-length",
        skipCSRFCheck,
        providers: [Google({ clientId: "test-client-id", clientSecret: "test-client-secret" })],
      },
    );

    const location = response.headers.get("location");
    assert.ok(location, "Auth.js deve redirecionar para a autorização Google");

    const authorizationUrl = new URL(location);
    assert.equal(authorizationUrl.host, "accounts.google.com");
    assert.equal(authorizationUrl.searchParams.get("prompt"), "select_account");
    assert.equal(authorizationUrl.searchParams.get("client_id"), "test-client-id");
    assert.equal(authorizationUrl.searchParams.get("redirect_uri"), "https://dular.test/api/auth/callback/google");
    assert.ok(authorizationUrl.searchParams.get("code_challenge"));
    assert.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256");
    assert.equal(authorizationUrl.searchParams.get("scope"), "openid profile email");
  });
});
