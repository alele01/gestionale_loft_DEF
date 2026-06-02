import assert from "node:assert/strict";
import test from "node:test";

import {
  indexRequestDuplicates,
  normalizeRequestEmail,
  normalizeRequestPhone,
} from "../request-duplicates";

test("normalizeRequestEmail lowercases and trims", () => {
  assert.equal(normalizeRequestEmail("  Test@Mail.COM "), "test@mail.com");
});

test("normalizeRequestPhone keeps digits only and strips +39", () => {
  assert.equal(normalizeRequestPhone("+39 333 1122334"), "3331122334");
  assert.equal(normalizeRequestPhone("333 1122334"), "3331122334");
});

test("indexRequestDuplicates matches email within same event only", () => {
  const index = indexRequestDuplicates([
    {
      id: "a",
      eventId: "ev1",
      email: "mario@example.com",
      phone: "+39 333 1111111",
    },
    {
      id: "b",
      eventId: "ev1",
      email: "mario@example.com",
      phone: "+39 444 2222222",
    },
    {
      id: "c",
      eventId: "ev2",
      email: "mario@example.com",
      phone: "+39 333 1111111",
    },
  ]);

  assert.deepEqual(index.get("a")?.matchTypes, ["email"]);
  assert.deepEqual(index.get("a")?.otherIds, ["b"]);
  assert.equal(index.has("c"), false);
});

test("indexRequestDuplicates matches phone within same event", () => {
  const index = indexRequestDuplicates([
    {
      id: "a",
      eventId: "ev1",
      email: "a@example.com",
      phone: "+39 333 1122334",
    },
    {
      id: "b",
      eventId: "ev1",
      email: "b@example.com",
      phone: "333 1122334",
    },
  ]);

  assert.deepEqual(index.get("a")?.matchTypes, ["phone"]);
  assert.deepEqual(index.get("b")?.otherIds, ["a"]);
});
