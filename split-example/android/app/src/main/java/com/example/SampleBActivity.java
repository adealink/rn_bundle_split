package com.example;

//public class SampleBActivity extends BaseSubBundleActivity {
//
//    @Override
//    protected String getScriptAssetPath() {
//        return "bundle/SampleB/index.bundle";
//    }
//
//    @Override
//    protected String getMainComponentName() {
//        return "SampleB";
//    }
//
//}

import android.app.Activity;
import android.os.Bundle;
import android.support.annotation.Nullable;

import com.example.base.RNManager;
import com.facebook.react.ReactRootView;
import com.facebook.react.modules.core.DefaultHardwareBackBtnHandler;

public class SampleBActivity extends Activity implements DefaultHardwareBackBtnHandler {

    private ReactRootView mReactRootView;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mReactRootView = new ReactRootView(this);
        setContentView(mReactRootView);
        RNManager.getsInstance().startReactApplication(mReactRootView, "SampleB");
    }

    @Override
    protected void onPause() {
        super.onPause();
        RNManager.getsInstance().getReactInstanceManager().onHostPause(this);
    }

    @Override
    protected void onResume() {
        super.onResume();
        RNManager.getsInstance().getReactInstanceManager().onHostResume(this, this);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        RNManager.getsInstance().detachRootView(mReactRootView);
        RNManager.getsInstance().getReactInstanceManager().onHostDestroy(this);
    }

    @Override
    public void invokeDefaultOnBackPressed() {

    }

}