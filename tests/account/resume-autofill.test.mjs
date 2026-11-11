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
const submit = (view) =>
  view.root.findByType("form").props.onSubmit({ preventDefault() {} });
const input = (view, field) =>
  view.root.findAll(
    (entry) =>
      entry.props.id?.endsWith(`-${field}`) &&
      ["input", "textarea"].includes(entry.type),
  )[0];
const checkbox = (view, label) =>
  view.root.findByProps({ "aria-label": `Include ${label}` });

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
  assert.match(text(view), /Review resume autofill/);
  assert.equal(view.root.findAllByType("dialog").length, 1);
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
    submit(view);
  });
  assert.deepEqual(applied, [{ firstName: "Jordan", githubUsername: "jlee" }]);
  assert.match(text(view), /click Save profile/);
  assert.equal(requests.length, 2); // No profile save request is issued.
  await act(async () => view.unmount());
});
test("empty profiles also review editable suggestions before anything is applied", async () => {
  const { view, applied } = await fixture({ form: formFromProfile({}) });
  await act(async () => {
    await button(view, "Autofill from resume").props.onClick();
  });
  assert.equal(applied.length, 0);
  assert.match(text(view), /Review resume autofill/);
  await act(async () => submit(view));
  assert.equal(applied.length, 1);
  await act(async () => view.unmount());
});
test("the review stays editable if the underlying form changes", async () => {
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
  assert.match(text(view), /First name/);
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
test("empty results give feedback and matching results can still be reviewed and edited", async () => {
  for (const [result, message] of [
    [{}, /No supported profile fields/],
    [{ firstName: "Existing" }, /Review resume autofill/],
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

test("members can correct a name, exclude a suggestion, and blank another without clearing the profile", async () => {
  const { view, applied } = await fixture({
    parseResume: async () => ({
      lastName: "Q. Example",
      githubUsername: "jlee",
      currentCompany: "Example Labs",
      bio: "Suggested bio",
    }),
  });
  await act(async () => {
    await button(view, "Autofill from resume").props.onClick();
  });
  await act(async () =>
    input(view, "lastName").props.onChange({ target: { value: "Example" } }),
  );
  await act(async () =>
    checkbox(view, "github").props.onChange({ target: { checked: false } }),
  );
  assert.equal(input(view, "githubUsername").props.disabled, true);
  await act(async () =>
    input(view, "currentCompany").props.onChange({ target: { value: "  " } }),
  );
  await act(async () => submit(view));
  assert.deepEqual(applied, [{ lastName: "Example", bio: "Suggested bio" }]);
  assert.doesNotMatch(text(view), /Reads your saved PDF/);
  await act(async () => view.unmount());
});

test("invalid selected edits keep the modal open; excluding them allows other fields", async () => {
  const { view, applied } = await fixture({
    parseResume: async () => ({
      firstName: "Jordan",
      contactEmail: "hello@example.com",
    }),
  });
  await act(async () => {
    await button(view, "Autofill from resume").props.onClick();
  });
  await act(async () =>
    input(view, "contactEmail").props.onChange({
      target: { value: "member@pitt.edu" },
    }),
  );
  await act(async () => submit(view));
  assert.equal(applied.length, 0);
  assert.match(text(view), /different from your Pitt/);
  assert.equal(view.root.findAllByType("dialog").length, 1);
  await act(async () =>
    checkbox(view, "contact email").props.onChange({
      target: { checked: false },
    }),
  );
  await act(async () => submit(view));
  assert.deepEqual(applied, [{ firstName: "Jordan" }]);
  await act(async () => view.unmount());
});

test("blank or unchecked selections disable applying, and Escape cancels the modal", async () => {
  const { view, applied } = await fixture({
    parseResume: async () => ({ firstName: "Jordan" }),
  });
  await act(async () => {
    await button(view, "Autofill from resume").props.onClick();
  });
  await act(async () =>
    input(view, "firstName").props.onChange({ target: { value: " " } }),
  );
  assert.equal(button(view, "Apply selected").props.disabled, true);
  await act(async () =>
    view.root.findByType("dialog").props.onCancel({ preventDefault() {} }),
  );
  assert.equal(applied.length, 0);
  assert.equal(view.root.findAllByType("dialog").length, 0);
  await act(async () => view.unmount());
});

test("company, title and location remain available when extraction misses them", async () => {
  const { view, applied } = await fixture({
    parseResume: async () => ({ firstName: "Jordan" }),
  });
  await act(async () => {
    await button(view, "Autofill from resume").props.onClick();
  });
  for (const field of ["currentCompany", "jobTitle", "location"]) {
    assert.equal(input(view, field).props.value, "");
    assert.equal(input(view, field).props.disabled, false);
  }
  await act(async () =>
    input(view, "currentCompany").props.onChange({
      target: { value: "Example Labs" },
    }),
  );
  await act(async () =>
    input(view, "jobTitle").props.onChange({
      target: { value: "Software Engineer" },
    }),
  );
  await act(async () =>
    input(view, "location").props.onChange({
      target: { value: "Pittsburgh, PA" },
    }),
  );
  await act(async () => submit(view));
  assert.deepEqual(applied, [
    {
      firstName: "Jordan",
      currentCompany: "Example Labs",
      jobTitle: "Software Engineer",
      location: "Pittsburgh, PA",
    },
  ]);
  await act(async () => view.unmount());
});
