import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const serverClient = await readFile(new URL("../lib/supabase-server.ts", import.meta.url), "utf8");
const callbackRoute = await readFile(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");

test("Supabase SSR server client keeps auth cookies round-trippable", () => {
  assert.match(serverClient, /createServerClient\(/);
  assert.match(serverClient, /const cookieStore = await cookies\(\)/);
  assert.match(serverClient, /get\(name: string\).*cookieStore\.get\(name\)\?\.value/s);
  assert.match(serverClient, /set\(name: string, value: string, options: Record<string, unknown>\).*cookieStore\.set/s);
  assert.match(serverClient, /remove\(name: string, options: Record<string, unknown>\).*cookieStore\.set\(name, '', options/s);
  assert.doesNotMatch(serverClient, /createBrowserClient/);
});

test("OAuth callback attaches refreshed cookies to its returned response", () => {
  assert.match(callbackRoute, /const successResponse = NextResponse\.redirect/);
  assert.match(callbackRoute, /createCallbackClient\(request, successResponse\)/);
  assert.match(callbackRoute, /response\.cookies\.set\(name, value, options/);
  assert.match(callbackRoute, /if \(code\)[\s\S]*return successResponse/);
});

test("OTP callback returns the same cookie-bearing response after verification", () => {
  assert.match(callbackRoute, /if \(token_hash && type\)/);
  assert.match(callbackRoute, /supabase\.auth\.verifyOtp\(\{ token_hash, type \}\)/);
  assert.match(callbackRoute, /if \(!error\) \{[\s\S]*return successResponse/);
});
