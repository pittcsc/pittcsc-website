import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React from "react";
import { act, create } from "react-test-renderer";
import { formFromProfile } from "../../src/lib/account/form.mjs";

// Use Gatsby's Babel toolchain to exercise the actual JSX component in Node.
const require = createRequire(import.meta.url);
const gatsbyRequire = createRequire(require.resolve("gatsby/package.json"));
const { transformFileSync } = gatsbyRequire("@babel/core");
const componentPath =
  require.resolve("../../src/components/account/ResumeAutofill.js");
const { code } = transformFileSync(componentPath, {
  babelrc: false,
  configFile: false,
  presets: [gatsbyRequire.resolve("@babel/preset-react")],
  plugins: [gatsbyRequire.resolve("@babel/plugin-transform-modules-commonjs")],
});
const module = { exports: {} };
new Function("require", "module", "exports", code)(
  createRequire(componentPath),
  module,
  module.exports,
);
const ResumeAutofill = module.exports.default;
const text = (node) => JSON.stringify(node.toJSON());
const button = (node, label) =>
  node.root
    .findAllByType("button")
    .find((entry) => entry.children.join("") === label);

async function fixture(overrides = {}) {
  const applied = [];
  const requests = [];
  const busy = [];
  const props = {
    form: formFromProfile({ firstName: "Existing", lastName: "Member" }),
    email: "member@pitt.edu",
    userID: "verified-owner",
    request: async (...args) => {
      requests.push(args);
      return new Blob(["synthetic PDF"]);
    },
    parseResume: async () => ({ firstName: "Jordan", githubUsername: "jlee" }),
    onApply: (values) => applied.push(values),
    onBusyChange: (value) => busy.push(value),
    ...overrides,
  };
  let view;
  await act(async () => {
    view = create(React.createElement(ResumeAutofill, props));
  });
  return { view, props, applied, requests, busy };
}

test("requires confirmation before replacing populated inputs, cancel preserves edits, retry works", async () => {
  const { view, applied, requests, busy } = await fixture();
  await act(async () => {
    await button(view, "Autofill from resume").props.onClick();
  });
  assert.equal(applied.length, 0);
  assert.match(text(view), /Replace profile information/);
  assert.match(text(view), /First name/);
  assert.equal(requests[0][0], "/profile/resume");
  assert.equal(requests[0][1].userID, "verified-owner");
  assert.equal(requests[0][1].responseType, "blob");
  assert.deepEqual(busy, [true, false]);
  await act(async () => {
    button(view, "Cancel").props.onClick();
  });
  assert.equal(applied.length, 0);
  assert.match(text(view), /has not changed/);
  await act(async () => {
    await button(view, "Autofill from resume").props.onClick();
  });
  await act(async () => {
    button(view, "Confirm autofill").props.onClick();
  });
  assert.deepEqual(applied, [{ firstName: "Jordan", githubUsername: "jlee" }]);
  assert.match(text(view), /click Save profile/);
  assert.equal(requests.length, 2); // No profile save request is issued.
  await act(async () => view.unmount());
});
test("fills empty inputs without a replacement prompt", async () => {
  const { view, applied } = await fixture({ form: formFromProfile({}) });
  await act(async () => {
    await button(view, "Autofill from resume").props.onClick();
  });
  assert.equal(applied.length, 1);
  assert.doesNotMatch(text(view), /Replace profile information/);
  await act(async () => view.unmount());
});
test("confirmation reflects edits made while reviewing suggestions", async () => {
  const { view, props } = await fixture();
  await act(async () => {
    await button(view, "Autofill from resume").props.onClick();
  });
  await act(async () => {
    view.update(
      React.createElement(ResumeAutofill, {
        ...props,
        form: { ...props.form, firstName: "Jordan" },
      }),
    );
  });
  assert.doesNotMatch(text(view), /First name/);
  assert.match(text(view), /GitHub/);
  await act(async () => view.unmount());
});
test("failed download can be retried and duplicate clicks do not start extra requests", async () => {
  let reject;
  let calls = 0;
  const { view, applied } = await fixture({
    request: () => {
      calls++;
      return new Promise((_, failure) => {
        reject = failure;
      });
    },
  });
  let pending;
  const click = button(view, "Autofill from resume").props.onClick;
  await act(async () => {
    pending = click();
    await click();
  });
  assert.equal(calls, 1);
  await act(async () => {
    reject(new Error("Download failed"));
    await pending;
  });
  assert.match(text(view), /Download failed/);
  assert.equal(button(view, "Autofill from resume").props.disabled, false);
  assert.equal(applied.length, 0);
  await act(async () => view.unmount());
});
test("logout/unmount aborts pending work and never applies late results", async () => {
  let resolve;
  let signal;
  const { view, applied } = await fixture({
    request: (_, options) => {
      signal = options.signal;
      return new Promise((success) => {
        resolve = success;
      });
    },
  });
  let pending;
  await act(async () => {
    pending = button(view, "Autofill from resume").props.onClick();
  });
  await act(async () => view.unmount());
  assert.equal(signal.aborted, true);
  await act(async () => {
    resolve(new Blob(["pdf"]));
    await pending;
  });
  assert.equal(applied.length, 0);
});
test("empty and unchanged parse results give useful feedback without changing the form", async () => {
  for (const [result, message] of [
    [{}, /No supported profile fields/],
    [{ firstName: "Existing" }, /already matches/],
  ]) {
    const { view, applied } = await fixture({
      parseResume: async () => result,
    });
    await act(async () => {
      await button(view, "Autofill from resume").props.onClick();
    });
    assert.equal(applied.length, 0);
    assert.match(text(view), message);
    await act(async () => view.unmount());
  }
});
