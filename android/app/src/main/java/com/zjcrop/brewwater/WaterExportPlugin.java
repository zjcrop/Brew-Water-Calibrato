package com.zjcrop.brewwater;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;
import org.json.JSONTokener;

@CapacitorPlugin(name = "WaterExport")
public class WaterExportPlugin extends Plugin {
    private static final String FILE_NAME = "cuili-water-record.json";
    private static final int MAX_BYTES = 64 * 1024;
    private final AtomicBoolean pending = new AtomicBoolean(false);

    private byte[] jsonBytes(PluginCall call) throws Exception {
        String json = call.getString("json");
        if (json == null || json.isEmpty()) throw new IllegalArgumentException("水记录必须为 JSON 对象");
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BYTES) throw new IllegalArgumentException("水记录超过 64 KiB，无法导出");
        JSONTokener tokener = new JSONTokener(json);
        if (!(tokener.nextValue() instanceof JSONObject) || tokener.nextClean() != 0) {
            throw new IllegalArgumentException("水记录必须为有效 JSON 对象");
        }
        return bytes;
    }

    @PluginMethod
    public void save(PluginCall call) {
        if (!pending.compareAndSet(false, true)) {
            call.reject("另一个水记录正在保存，请先完成或取消系统对话框", "EXPORT_BUSY");
            return;
        }
        try {
            jsonBytes(call);
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_TITLE, FILE_NAME);
            getActivity().runOnUiThread(() -> {
                try {
                    startActivityForResult(call, intent, "documentCreated");
                } catch (Exception error) {
                    pending.set(false);
                    call.reject("无法打开系统保存对话框", "EXPORT_PICKER_FAILED", error);
                }
            });
        } catch (Exception error) {
            pending.set(false);
            call.reject(error.getMessage(), "EXPORT_INVALID", error);
        }
    }

    @ActivityCallback
    private void documentCreated(PluginCall call, ActivityResult result) {
        if (call == null) {
            pending.set(false);
            return;
        }
        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            pending.set(false);
            JSObject response = new JSObject();
            response.put("saved", false);
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null || !"content".equals(uri.getScheme())) {
            pending.set(false);
            call.reject("系统未返回可写入的文档", "EXPORT_NO_DOCUMENT");
            return;
        }
        pending.set(true);
        // Re-read the saved call so Capacitor's activity restoration keeps the payload.
        execute(() -> {
            try {
                byte[] bytes = jsonBytes(call);
                try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                    if (stream == null) throw new IOException("文档提供方未提供写入流");
                    stream.write(bytes);
                    stream.flush();
                }
                JSObject response = new JSObject();
                response.put("saved", true);
                response.put("cancelled", false);
                response.put("fileName", FILE_NAME);
                response.put("bytesWritten", bytes.length);
                call.resolve(response);
            } catch (Exception error) {
                call.reject("水记录写入失败，请重新选择保存位置", "EXPORT_WRITE_FAILED", error);
            } finally {
                pending.set(false);
            }
        });
    }
}
