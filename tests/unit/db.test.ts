import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { DbClient } from "../../packages/db/src/db-client.js";
import type { ZerithDBConfig } from "../../packages/core/src/index.js";

const testConfig: ZerithDBConfig = {
  appId: "test-db-" + Math.random().toString(36).slice(2),
};

describe("DbClient — CollectionClient", () => {
  let db: DbClient;

  beforeEach(() => {
    db = new DbClient(testConfig);
  });

  afterEach(async () => {
    await db.dispose();
  });

  describe("insert()", () => {
    it("should return a generated _id", async () => {
      const col = db.collection<{ text: string }>("todos");
      const result = await col.insert({ text: "hello" });
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe("string");
      expect(result.id.length).toBeGreaterThan(0);
    });

    it("should persist the document so find() returns it", async () => {
      const col = db.collection<{ text: string }>("todos");
      const { id } = await col.insert({ text: "world" });
      const docs = await col.find({});
      expect(docs).toHaveLength(1);
      expect(docs[0]?._id).toBe(id);
      expect(docs[0]?.text).toBe("world");
    });

    it("should add _createdAt and _updatedAt timestamps", async () => {
      const before = Date.now();
      const col = db.collection<{ x: number }>("items");
      await col.insert({ x: 42 });
      const after = Date.now();
      const [doc] = await col.find({});
      expect(doc?._createdAt).toBeGreaterThanOrEqual(before);
      expect(doc?._createdAt).toBeLessThanOrEqual(after);
      expect(doc?._updatedAt).toBeDefined();
    });
  });

  describe("insertMany()", () => {
    it("should insert multiple documents", async () => {
      const col = db.collection<{ n: number }>("nums");
      const results = await col.insertMany([{ n: 1 }, { n: 2 }, { n: 3 }]);
      expect(results).toHaveLength(3);
      const docs = await col.find({});
      expect(docs).toHaveLength(3);
    });
  });

  describe("find()", () => {
    it("should return all documents with empty filter", async () => {
      const col = db.collection<{ v: number }>("vals");
      await col.insertMany([{ v: 1 }, { v: 2 }, { v: 3 }]);
      const docs = await col.find({});
      expect(docs).toHaveLength(3);
    });

    it("should filter by exact equality", async () => {
      const col = db.collection<{ done: boolean }>("tasks");
      await col.insertMany([{ done: true }, { done: false }, { done: true }]);
      const done = await col.find({ done: true });
      expect(done).toHaveLength(2);
    });

    it("should support $gt operator", async () => {
      const col = db.collection<{ score: number }>("scores");
      await col.insertMany([{ score: 10 }, { score: 50 }, { score: 90 }]);
      const high = await col.find({ score: { $gt: 30 } });
      expect(high).toHaveLength(2);
    });

    it("should support $in operator", async () => {
      const col = db.collection<{ status: string }>("items");
      await col.insertMany([{ status: "open" }, { status: "closed" }, { status: "pending" }]);
      const active = await col.find({ status: { $in: ["open", "pending"] } });
      expect(active).toHaveLength(2);
    });

    it("should return empty array when no documents match", async () => {
      const col = db.collection<{ x: number }>("empty");
      await col.insert({ x: 1 });
      const result = await col.find({ x: { $gt: 100 } });
      expect(result).toHaveLength(0);
    });
  });

  describe("findById()", () => {
    it("should return the document with matching _id", async () => {
      const col = db.collection<{ name: string }>("people");
      const { id } = await col.insert({ name: "Alice" });
      const doc = await col.findById(id);
      expect(doc?.name).toBe("Alice");
    });

    it("should return undefined for unknown _id", async () => {
      const col = db.collection<{ name: string }>("people");
      const doc = await col.findById("nonexistent-id");
      expect(doc).toBeUndefined();
    });
  });

  describe("update()", () => {
    it("should update matching documents", async () => {
      const col = db.collection<{ done: boolean; text: string }>("todos");
      await col.insert({ text: "fix bug", done: false });
      const count = await col.update({ done: false }, { $set: { done: true } });
      expect(count).toBe(1);
      const docs = await col.find({ done: true });
      expect(docs).toHaveLength(1);
    });

    it("should update _updatedAt on update", async () => {
      const col = db.collection<{ v: number }>("vals");
      const { id } = await col.insert({ v: 1 });
      const before = (await col.findById(id))?._updatedAt ?? 0;
      await new Promise((r) => setTimeout(r, 5));
      await col.update({ _id: id } as never, { $set: { v: 2 } });
      const after = (await col.findById(id))?._updatedAt ?? 0;
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  describe("delete()", () => {
    it("should remove matching documents", async () => {
      const col = db.collection<{ done: boolean }>("tasks");
      await col.insertMany([{ done: true }, { done: false }]);
      const count = await col.delete({ done: true });
      expect(count).toBe(1);
      const remaining = await col.find({});
      expect(remaining).toHaveLength(1);
    });
  });

  describe("clearAll()", () => {
    it("should remove every document in the collection", async () => {
      const col = db.collection<{ done: boolean }>("tasks");
      await col.insertMany([{ done: true }, { done: false }, { done: true }]);

      await col.clearAll();

      expect(await col.find({})).toHaveLength(0);
      expect(await col.count()).toBe(0);
    });

    it("should not clear other collections", async () => {
      const tasks = db.collection<{ done: boolean }>("tasks");
      const notes = db.collection<{ text: string }>("notes");
      await tasks.insertMany([{ done: true }, { done: false }]);
      await notes.insert({ text: "keep me" });

      await tasks.clearAll();

      expect(await tasks.count()).toBe(0);
      expect(await notes.count()).toBe(1);
    });
  });

  describe("count()", () => {
    beforeEach(async () => {
      const col = db.collection<{ priority: number; status: string; tags: string[] }>("test");
      await col.insertMany([
        { priority: 1, status: "active", tags: ["urgent", "work"] },
        { priority: 2, status: "pending", tags: ["work"] },
        { priority: 3, status: "active", tags: ["personal"] },
        { priority: 1, status: "done", tags: ["urgent"] },
        { priority: 4, status: "active", tags: ["work", "urgent"] },
        { priority: 2, status: "pending", tags: ["personal"] },
      ]);
    });

    // Basic counts
    it("should return total document count", async () => {
      const col = db.collection("test");
      expect(await col.count()).toBe(6);
    });

    it("should return 0 for empty collection", async () => {
      const empty = db.collection("empty");
      expect(await empty.count()).toBe(0);
    });

    // Simple equality
    it("should count with simple equality", async () => {
      const col = db.collection("test");
      expect(await col.count({ status: "active" })).toBe(3);
    });

    it("should count with $eq operator", async () => {
      const col = db.collection("test");
      expect(await col.count({ status: { $eq: "pending" } })).toBe(2);
    });

    // Comparison operators
    it("should count with $gt", async () => {
      const col = db.collection("test");
      expect(await col.count({ priority: { $gt: 2 } })).toBe(2);
    });

    it("should count with $gte", async () => {
      const col = db.collection("test");
      expect(await col.count({ priority: { $gte: 2 } })).toBe(4);
    });

    it("should count with $lt", async () => {
      const col = db.collection("test");
      expect(await col.count({ priority: { $lt: 2 } })).toBe(2);
    });

    it("should count with $lte", async () => {
      const col = db.collection("test");
      expect(await col.count({ priority: { $lte: 2 } })).toBe(4);
    });

    // Array operators
    it("should count with $in", async () => {
      const col = db.collection("test");
      expect(await col.count({ priority: { $in: [1, 3] } })).toBe(3);
    });

    it("should count with $nin", async () => {
      const col = db.collection("test");
      expect(await col.count({ priority: { $nin: [1, 2] } })).toBe(2);
    });

    // Not equal operator
    it("should count with $ne", async () => {
      const col = db.collection("test");
      expect(await col.count({ status: { $ne: "active" } })).toBe(3);
    });

    // Combined filters
    it("should count with multiple simple conditions", async () => {
      const col = db.collection("test");
      expect(await col.count({ status: "active", priority: 1 })).toBe(1);
    });

    it("should count with mixed simple and complex", async () => {
      const col = db.collection("test");
      expect(await col.count({ status: "active", priority: { $gt: 2 } })).toBe(1);
    });

    it("should count with multiple complex operators", async () => {
      const col = db.collection("test");
      expect(await col.count({ priority: { $gte: 2, $lte: 3 } })).toBe(3);
    });

    // Edge cases
    it("should return 0 for non-matching filter", async () => {
      const col = db.collection("test");
      expect(await col.count({ status: "nonexistent" })).toBe(0);
    });

    it("should handle empty object filter", async () => {
      const col = db.collection("test");
      expect(await col.count({})).toBe(6);
    });
  });
});
