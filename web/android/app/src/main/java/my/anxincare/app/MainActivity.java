package my.anxincare.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ElderModePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
