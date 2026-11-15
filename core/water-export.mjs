export const WATER_RECORD_FILENAME = 'cuili-water-record.json';
export const MAX_WATER_RECORD_BYTES = 64 * 1024;

// Capacitor 8 injects this local plugin proxy into the static Android page.
// A native failure must never fall through to a WebView Blob download.
export function createWaterRecordExporter(runtime = globalThis) {
  let pending = false;
  return async function exportWaterRecord(record) {
    if (pending) throw new Error('另一个水记录正在保存，请先完成或取消系统对话框');
    pending = true;
    try {
      if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('水记录必须为 JSON 对象');
      const json = JSON.stringify(record, null, 2);
      const bytes = new TextEncoder().encode(json).byteLength;
      if (bytes > MAX_WATER_RECORD_BYTES) throw new Error('水记录超过 64 KiB，无法导出');
      const cap = runtime.Capacitor;
      const platform = typeof cap?.getPlatform === 'function' ? cap.getPlatform() : undefined;
      const native = platform === 'android' || platform === 'ios' ||
        (typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform()) || Boolean(runtime.androidBridge);
      if (native) {
        if (platform !== 'android') throw new Error('当前原生平台不支持水记录保存');
        const plugin = cap?.Plugins?.WaterExport;
        if (typeof plugin?.save !== 'function') throw new Error('Android 保存组件尚未就绪，请更新应用');
        const result = await plugin.save({ json });
        if (result?.cancelled === true && result.saved === false) return { status: 'cancelled', platform: 'android' };
        if (result?.saved !== true || result.cancelled !== false || result.bytesWritten !== bytes || result.fileName !== WATER_RECORD_FILENAME) {
          throw new Error('Android 未确认文件写入完成，请重试');
        }
        return { status: 'saved', platform: 'android', bytes, fileName: WATER_RECORD_FILENAME };
      }
      const url = runtime.URL.createObjectURL(new runtime.Blob([json], { type: 'application/json;charset=utf-8' }));
      try {
        const link = runtime.document.createElement('a');
        link.href = url;
        link.download = WATER_RECORD_FILENAME;
        runtime.document.body.appendChild(link);
        try { link.click(); } finally { link.remove(); }
      } catch (error) {
        runtime.URL.revokeObjectURL(url);
        throw error;
      }
      runtime.setTimeout(() => runtime.URL.revokeObjectURL(url), 1000);
      return { status: 'download-requested', platform: 'web', bytes, fileName: WATER_RECORD_FILENAME };
    } finally {
      pending = false;
    }
  };
}
