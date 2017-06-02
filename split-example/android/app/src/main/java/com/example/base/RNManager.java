package com.example.base;

import android.app.Application;
import android.content.Context;
import android.content.res.AssetManager;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;
import android.support.annotation.WorkerThread;

import com.example.BuildConfig;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.ReactInstanceManagerBuilder;
import com.facebook.react.ReactRootView;
import com.facebook.react.bridge.CatalystInstance;
import com.facebook.react.bridge.NativeModuleCallExceptionHandler;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.common.LifecycleState;
import com.facebook.react.cxxbridge.CatalystInstanceImpl;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.shell.MainReactPackage;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import rx.Observable;
import rx.Subscriber;
import rx.Subscription;
import rx.android.schedulers.AndroidSchedulers;
import rx.functions.Func1;
import rx.schedulers.Schedulers;


/**
 * Created by sunxiaodong on 2017/5/12.
 */

public class RNManager {

    private static RNManager sInstance;
    private ReactInstanceManager mReactInstanceManager;
    private Context mContext;

    public void setContext(Context context) {
        mContext = context;
    }

    private RNManager() {

    }

    public static RNManager getsInstance() {
        if (sInstance == null) {
            sInstance = new RNManager();
        }
        return sInstance;
    }

    /**
     * 向RN发送事件
     *
     * @param eventName 事件名
     * @param params    参数
     */
    public void sendEventToRN(final String eventName, @Nullable final WritableMap params) {
        if (mReactInstanceManager != null) {
            ReactContext reactContext = mReactInstanceManager.getCurrentReactContext();
            if (reactContext != null) {
                sendEventToRN(reactContext, eventName, params);
            } else {
                mReactInstanceManager.addReactInstanceEventListener(new ReactInstanceManager.ReactInstanceEventListener() {
                    @Override
                    public void onReactContextInitialized(ReactContext context) {
                        sendEventToRN(context, eventName, params);
                    }
                });
            }
        }
    }

    private void sendEventToRN(ReactContext reactContext, String eventName, @Nullable WritableMap params) {
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(eventName, params);
    }

    public ReactInstanceManager getReactInstanceManager() {
        if (mReactInstanceManager == null) {
            throw new IllegalStateException("mReactInstanceManager尚未初始化！");
        }
        return mReactInstanceManager;
    }

    public ReactInstanceManager initReactInstanceManager() {
        ReactInstanceManagerBuilder builder = ReactInstanceManager.builder()
            .setApplication((Application) mContext)
            .addPackage(new MainReactPackage())
            .setUseDeveloperSupport(BuildConfig.DEBUG)
            .setInitialLifecycleState(LifecycleState.BEFORE_CREATE);
        if (!BuildConfig.DEBUG) {
            builder.setNativeModuleCallExceptionHandler(new NativeModuleCallExceptionHandler() {
                @Override
                public void handleException(Exception e) {

                }
            });
        }

        String jsBundleFile;
        String baseBundleFilePath = FileUtil.Path.getBundlePath("base");
        FileUtil.createFilePath(FileUtil.Path.BUNDLE_DIR);
        if (FileUtil.isFileExist(baseBundleFilePath)) {
            jsBundleFile = baseBundleFilePath;
        } else {
            jsBundleFile = "assets://" + "bundle/base/index.bundle";
        }
        builder.setJSBundleFile(jsBundleFile);

        mReactInstanceManager = builder.build();
        return mReactInstanceManager;
    }

    public void startReactApplication(@NonNull final ReactRootView reactRootView, final String moduleName) {
        setJsModuleName(reactRootView, moduleName);

        if (!mReactInstanceManager.hasStartedCreatingInitialContext()) {
            mReactInstanceManager.createReactContextInBackground();
            mReactInstanceManager.addReactInstanceEventListener(new ReactInstanceManager.ReactInstanceEventListener() {
                @Override
                public void onReactContextInitialized(ReactContext reactContext) {
                    loadScriptAsync(reactRootView, moduleName);
                }
            });
        } else {
            loadScriptAsync(reactRootView, moduleName);
        }
    }

    public void detachRootView(@NonNull ReactRootView reactRootView) {
        Subscription subscription = mLoadScriptSubscriptionMap.get(reactRootView);
        if (subscription != null && !subscription.isUnsubscribed()) {
            subscription.unsubscribe();
        }
        mLoadScriptSubscriptionMap.remove(reactRootView);
        getReactInstanceManager().detachRootView(reactRootView);
    }

    private Map<ReactRootView, Subscription> mLoadScriptSubscriptionMap = new HashMap<>();

    /**
     * 异步加载脚本
     */
    private void loadScriptAsync(final ReactRootView reactRootView, String moduleName) {
        Subscription subscription = Observable.just(moduleName)
            .map(new Func1<String, String>() {
                @Override
                public String call(String moduleName) {
                    return getBundleFileByModule(moduleName);
                }
            })
            .map(new Func1<String, Boolean>() {
                @Override
                public Boolean call(String jsBundleFile) {
                    return loadScript(mContext, getCatalystInstance(), jsBundleFile);
                }
            })
            .subscribeOn(Schedulers.io())
            .observeOn(AndroidSchedulers.mainThread())
            .subscribe(new Subscriber<Boolean>() {
                @Override
                public void onCompleted() {

                }

                @Override
                public void onError(Throwable e) {

                }

                @Override
                public void onNext(Boolean aBoolean) {
                    if (aBoolean) {
                        getReactInstanceManager().attachMeasuredRootView(reactRootView);
                    }
                }
            });
        mLoadScriptSubscriptionMap.put(reactRootView, subscription);
    }

    /**
     * 根据module 获取bundle文件
     *
     * @param moduleName
     */
    private String getBundleFileByModule(String moduleName) {
        String jsBundleFile;
        String moduleBundleFilePath = FileUtil.Path.getBundlePath(moduleName);
        if (FileUtil.isFileExist(moduleBundleFilePath)) {
            jsBundleFile = moduleBundleFilePath;
        } else {
            jsBundleFile = "assets://" + "bundle/" + moduleName + "/index.bundle";
        }
        return jsBundleFile;
    }

    /**
     * 设置JS module name
     */
    private void setJsModuleName(ReactRootView rootView, String moduleName) {
        try {
            Field field = ReactRootView.class.getDeclaredField("mJSModuleName");
            field.setAccessible(true);
            field.set(rootView, moduleName);
        } catch (NoSuchFieldException e) {
            e.printStackTrace();
        } catch (IllegalAccessException e) {
            e.printStackTrace();
        }
    }

    @Nullable
    private CatalystInstance getCatalystInstance() {
        if (mReactInstanceManager == null) {
            return null;
        }
        ReactContext context = mReactInstanceManager.getCurrentReactContext();
        if (context == null) {
            return null;
        }
        return context.getCatalystInstance();
    }

    private Set<String> mLoadedScript = new HashSet<>();

    @WorkerThread
    private boolean loadScript(Context context, CatalystInstance instance, String jsBundleFile) {
        if (jsBundleFile.startsWith("assets://")) {
            return loadScriptFromAsset(context, instance, jsBundleFile);
        } else {
            return loadScriptFromFile(instance, jsBundleFile);
        }
    }

    @WorkerThread
    private boolean loadScriptFromFile(CatalystInstance instance, String fileName) {
        if (mLoadedScript.contains(fileName)) {
            return true;
        }
        boolean ret = false;
        try {
            Method method = CatalystInstanceImpl.class.getDeclaredMethod("loadScriptFromFile",
                String.class,
                String.class);
            method.setAccessible(true);
            method.invoke(instance, fileName, fileName);
            mLoadedScript.add(fileName);
            ret = true;
        } catch (IllegalAccessException e) {
            e.printStackTrace();
        } catch (NoSuchMethodException e) {
            e.printStackTrace();
        } catch (InvocationTargetException e) {
            e.printStackTrace();
        }
        return ret;
    }

    @WorkerThread
    private boolean loadScriptFromAsset(Context context, CatalystInstance instance, String assetName) {
        if (mLoadedScript.contains(assetName)) {
            return true;
        }
        boolean ret = false;
        try {
            Method method = CatalystInstanceImpl.class.getDeclaredMethod("loadScriptFromAssets",
                AssetManager.class,
                String.class);
            method.setAccessible(true);
            method.invoke(instance, context.getAssets(), assetName);
            mLoadedScript.add(assetName);
            ret = true;
        } catch (IllegalAccessException e) {
            e.printStackTrace();
        } catch (NoSuchMethodException e) {
            e.printStackTrace();
        } catch (InvocationTargetException e) {
            e.printStackTrace();
        }
        return ret;
    }

    /**
     * 重新创建ReactContext
     */
    public void recreateReactContext() {
        UiThreadUtil.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (mReactInstanceManager != null) {
                    Class<?> reactInstanceManagerType = mReactInstanceManager.getClass();
                    try {
                        Method method = reactInstanceManagerType.getDeclaredMethod("recreateReactContextInBackground");
                        method.invoke(mReactInstanceManager);
                    } catch (Exception e) {

                    }
                }
            }
        });
    }

}