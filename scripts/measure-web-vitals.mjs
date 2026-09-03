#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseURL = process.env.PERF_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
const routes = [
  { name: "dashboard", path: "/dashboard" },
  { name: "skills", path: "/dashboard/skills" },
  { name: "course", path: "/dashboard/courses/asking-for-clarity" },
  { name: "contacts", path: "/dashboard/contacts" },
  { name: "practice", path: "/dashboard/practice" },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

async function signInIfConfigured() {
  if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) return false;
  await page.goto(new URL("/auth/login", baseURL).toString(), { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 30_000 });
  return true;
}

async function measure(route) {
  await page.addInitScript(() => {
    window.__beckettVitals = { cls: 0, lcp: null, fcp: null, inp: null };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__beckettVitals.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__beckettVitals.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__beckettVitals.fcp = entry.startTime;
    }).observe({ type: "paint", buffered: true });
  });
  const response = await page.goto(new URL(route.path, baseURL).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(500);
  const result = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const vitals = window.__beckettVitals || {};
    const scripts = performance.getEntriesByType("resource")
      .filter((entry) => entry.name.includes("/_next/") && entry.name.endsWith(".js"));
    return {
      ttfb: navigation?.responseStart ?? null,
      domContentLoaded: navigation?.domContentLoadedEventEnd ?? null,
      load: navigation?.loadEventEnd ?? null,
      jsBytes: scripts.reduce((total, entry) => total + (entry.transferSize || entry.encodedBodySize || 0), 0),
      jsFiles: scripts.length,
      ...vitals,
    };
  });
  return { ...route, status: response?.status() ?? null, finalPath: new URL(page.url()).pathname, ...result };
}

const authenticated = await signInIfConfigured();
const results = [];
for (const route of routes) results.push(await measure(route));

const output = {
  capturedAt: new Date().toISOString(),
  baseURL,
  authenticated,
  note: authenticated ? "Authenticated route measurements." : "Protected routes were measured as unauthenticated redirects. Set E2E_EMAIL and E2E_PASSWORD for authenticated measurements.",
  routes: results,
};

await mkdir("docs/performance", { recursive: true });
await writeFile("docs/performance/baseline.json", `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
await browser.close();
