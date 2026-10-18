package org.food4all.pilot;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FoodPrintPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
