package com.zjcrop.brewwater;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WaterExportPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
