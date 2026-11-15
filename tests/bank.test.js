const test = require("node:test");
const assert = require("node:assert/strict");
const bank = require("../ios-src/bank.js");

test("reads a stored zip and rejects path escape", () => {
  const pack = storedZip({
    "bank.json": JSON.stringify({ format: "ielts-iphone-bank-v1", checksum: "abc" }),
    "exams/sample-harbor.json": JSON.stringify({
      examId: "sample-harbor", passage: { blocks: [] }, answerKey: { q1: "shed" }, questionOrder: ["q1"]
    })
  });
  const files = bank.decodeStoredZip(pack);
  const read = bank.readPack(files);
  assert.equal(read.exams["sample-harbor"].answerKey.q1, "shed");
  assert.throws(() => bank.decodeStoredZip(storedZip({ "../x.json": "{}" })), /不安全|不允许/);
});

function storedZip(entries) {
  const locals = [];
  let offset = 0;
  const central = [];
  for (const [name, text] of Object.entries(entries)) {
    const data = Buffer.from(text);
    const nameBytes = Buffer.from(name);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 8);
    header.writeUInt32LE(bank.crc32(data), 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    locals.push(header, nameBytes, data);
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt32LE(bank.crc32(data), 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, nameBytes);
    offset += header.length + nameBytes.length + data.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBytes, end]);
}

test("rejects truncated, corrupt and inconsistent archives", () => {
  const original = storedZip({ "bank.json": '{"format":"ielts-iphone-bank-v1"}' });
  assert.throws(() => bank.decodeStoredZip(original.subarray(0, original.length - 4)), /目录|完整/);
  const corrupt = Buffer.from(original);
  corrupt[30 + Buffer.byteLength("bank.json") + 5] ^= 1;
  assert.throws(() => bank.decodeStoredZip(corrupt), /校验/);
  const mismatch = Buffer.from(original);
  mismatch.writeUInt32LE(123, mismatch.indexOf(Buffer.from([0x50,0x4b,0x01,0x02])) + 20);
  assert.throws(() => bank.decodeStoredZip(mismatch), /目录/);
});

test("rejects a bank whose declared reading count is incomplete", () => {
  assert.throws(() => bank.readPack({
    "bank.json": JSON.stringify({format:"ielts-iphone-bank-v1",counts:{exams:2,explanations:0}}),
    "exams/example.json": JSON.stringify({examId:"example",passage:{blocks:[]},answerKey:{q1:"a"},questionOrder:["q1"]})
  }), /数量/);
});
