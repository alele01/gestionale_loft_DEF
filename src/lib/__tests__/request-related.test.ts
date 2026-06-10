import assert from "node:assert/strict";
import test from "node:test";

import { indexRequestDuplicates } from "../request-duplicates";
import { indexCrossEventRelatedRequests } from "../request-related";

test("indexCrossEventRelatedRequests matches email across different events", () => {
  const index = indexCrossEventRelatedRequests([
    {
      id: "a",
      eventId: "ev1",
      email: "mario@example.com",
      phone: "+39 333 1111111",
    },
    {
      id: "b",
      eventId: "ev2",
      email: "mario@example.com",
      phone: "+39 444 2222222",
    },
  ]);

  assert.deepEqual(index.get("a")?.matchTypes, ["email"]);
  assert.deepEqual(index.get("a")?.otherIds, ["b"]);
  assert.deepEqual(index.get("a")?.otherEventIds, ["ev2"]);
});

test("indexCrossEventRelatedRequests ignores same-event siblings", () => {
  const sameEvent = indexRequestDuplicates([
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
      phone: "+39 333 1111111",
    },
  ]);
  const crossEvent = indexCrossEventRelatedRequests([
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
      phone: "+39 333 1111111",
    },
  ]);

  assert.ok(sameEvent.has("a"));
  assert.equal(crossEvent.has("a"), false);
});

test("indexCrossEventRelatedRequests matches phone across different events", () => {
  const index = indexCrossEventRelatedRequests([
    {
      id: "a",
      eventId: "ev1",
      email: "a@example.com",
      phone: "+39 333 1122334",
    },
    {
      id: "b",
      eventId: "ev2",
      email: "b@example.com",
      phone: "333 1122334",
    },
  ]);

  assert.deepEqual(index.get("a")?.matchTypes, ["phone"]);
  assert.deepEqual(index.get("b")?.otherIds, ["a"]);
});
