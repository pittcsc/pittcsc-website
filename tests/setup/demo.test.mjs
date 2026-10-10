import assert from "node:assert/strict";
import { test } from "node:test";
import { localOrigin, pittEmail } from "../../scripts/demo.mjs";

test("demo accepts only loopback HTTP services", () => {
  for (const value of [
    "http://127.0.0.1:54321",
    "http://localhost:8000/",
    "http://[::1]:8080",
  ])
    assert.equal(localOrigin(value), new URL(value).origin);
  for (const value of [
    "https://project.supabase.co",
    "http://project.supabase.co",
    "http://127.0.0.1.example.com",
    "http://10.0.0.5:54321",
  ])
    assert.throws(() => localOrigin(value), /nonlocal service/);
});

test("demo reads codes only for Pitt addresses", () => {
  assert.equal(
    pittEmail("  CSC-Demo-Member@Pitt.edu "),
    "csc-demo-member@pitt.edu",
  );
  for (const value of [
    "",
    undefined,
    "member@example.com",
    "member@pitt.edu.example.com",
    "'; drop table csc.profiles; --@pitt.edu",
  ])
    assert.throws(() => pittEmail(value), /Pitt email address/);
});
