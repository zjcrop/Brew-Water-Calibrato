import test from 'node:test';
import assert from 'node:assert/strict';
import { createWaterRecordExporter, MAX_WATER_RECORD_BYTES, WATER_RECORD_FILENAME } from '../../core/water-export.mjs';

function webRuntime() {
  const calls = [];
  const link = { click() { calls.push('click'); }, remove() { calls.push('remove'); } };
  return {
    calls, link, Blob,
    document: { body: { appendChild(value) { assert.equal(value, link); calls.push('append'); } }, createElement(tag) { assert.equal(tag, 'a'); return link; } },
    URL: { createObjectURL(blob) { calls.push(blob); return 'blob:test'; }, revokeObjectURL(url) { calls.push(['revoke', url]); } },
    setTimeout(callback) { callback(); }
  };
}
function nativeRuntime(save) {
  return {
    Capacitor: { getPlatform: () => 'android', isNativePlatform: () => true, Plugins: { WaterExport: { save } } },
    URL: { createObjectURL() { assert.fail('Native must never attempt a Blob download'); } }
  };
}
function saved(json) {
  return { saved: true, cancelled: false, fileName: WATER_RECORD_FILENAME, bytesWritten: Buffer.byteLength(json, 'utf8') };
}

test('web requests a UTF-8 JSON download with fixed filename and revokes its URL', async () => {
  const runtime = webRuntime(), record = { name: '萃离', value: 1 };
  const result = await createWaterRecordExporter(runtime)(record);
  assert.equal(result.status, 'download-requested');
  assert.equal(runtime.link.download, WATER_RECORD_FILENAME);
  const blob = runtime.calls[0];
  assert.equal(blob.type, 'application/json;charset=utf-8');
  assert.deepEqual(JSON.parse(await blob.text()), record);
  assert.deepEqual(runtime.calls.slice(1), ['append', 'click', 'remove', ['revoke', 'blob:test']]);
});

test('native success requires explicit completed byte count and filename', async () => {
  const record = { name: '萃离' };
  const result = await createWaterRecordExporter(nativeRuntime(async ({ json }) => {
    assert.deepEqual(JSON.parse(json), record);
    return saved(json);
  }))(record);
  assert.equal(result.status, 'saved');
  assert.equal(result.bytes, Buffer.byteLength(JSON.stringify(record, null, 2), 'utf8'));
});

test('native cancellation is distinct from saved and does not download', async () => {
  assert.deepEqual(await createWaterRecordExporter(nativeRuntime(async () => ({ saved: false, cancelled: true })))({}), { status: 'cancelled', platform: 'android' });
});

test('native rejection propagates and the next attempt is allowed', async () => {
  let count = 0;
  const exportRecord = createWaterRecordExporter(nativeRuntime(async ({ json }) => {
    if (++count === 1) throw new Error('provider write failed');
    return saved(json);
  }));
  await assert.rejects(exportRecord({}), /provider write failed/);
  assert.equal((await exportRecord({})).status, 'saved');
});

test('native incomplete or contradictory acknowledgement is rejected without web fallback', async () => {
  for (const response of [undefined, {}, { saved: true }, { saved: true, cancelled: true }, { ...saved('{}'), bytesWritten: 0 }, { ...saved('{}'), fileName: 'other.json' }]) {
    await assert.rejects(createWaterRecordExporter(nativeRuntime(async () => response))({}), /未确认文件写入完成/);
  }
});

test('native missing plugin and unsupported native platforms cannot fall through to web', async () => {
  const runtime = nativeRuntime();
  delete runtime.Capacitor.Plugins.WaterExport;
  await assert.rejects(createWaterRecordExporter(runtime)({}), /保存组件尚未就绪/);
  runtime.Capacitor.getPlatform = () => 'ios';
  await assert.rejects(createWaterRecordExporter(runtime)({}), /原生平台不支持/);
  delete runtime.Capacitor.getPlatform;
  await assert.rejects(createWaterRecordExporter(runtime)({}), /原生平台不支持/);
});

test('an existing Android bridge without Capacitor cannot be mistaken for a web page', async () => {
  await assert.rejects(createWaterRecordExporter({ androidBridge: {} })({}), /原生平台不支持/);
});

test('concurrent native saves are rejected until the active dialog resolves', async () => {
  let finish;
  const exportRecord = createWaterRecordExporter(nativeRuntime(({ json }) => new Promise(resolve => { finish = () => resolve(saved(json)); })));
  const active = exportRecord({});
  await assert.rejects(exportRecord({}), /另一个水记录正在保存/);
  finish();
  assert.equal((await active).status, 'saved');
});

test('UTF-8 size limit accepts exactly 64 KiB and rejects one byte over before native call', async () => {
  let count = 0;
  const exportRecord = createWaterRecordExporter(nativeRuntime(async ({ json }) => { count++; return saved(json); }));
  const overhead = Buffer.byteLength(JSON.stringify({ data: '' }, null, 2));
  assert.equal((await exportRecord({ data: 'a'.repeat(MAX_WATER_RECORD_BYTES - overhead) })).bytes, MAX_WATER_RECORD_BYTES);
  await assert.rejects(exportRecord({ data: 'a'.repeat(MAX_WATER_RECORD_BYTES - overhead + 1) }), /超过 64 KiB/);
  await assert.rejects(exportRecord({ data: '萃'.repeat(30000) }), /超过 64 KiB/);
  assert.equal(count, 1);
});

test('invalid record values are rejected before a native call', async () => {
  const exportRecord = createWaterRecordExporter(nativeRuntime(() => assert.fail('Invalid data reached native')));
  for (const value of [null, undefined, [], 'json', 1, true]) await assert.rejects(exportRecord(value), /JSON 对象/);
});
