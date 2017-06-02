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

public class SampleBActivity extends Activity {

    private ReactRootView mReactRootView;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mReactRootView = new ReactRootView(this);
        setContentView(mReactRootView);
        RNManager.getsInstance().startReactApplication(mReactRootView, "SampleB");
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        RNManager.getsInstance().detachRootView(mReactRootView);
    }

}