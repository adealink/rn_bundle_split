/**
 * Created by sunxiaodong on 2017/5/31.
 */

'use strict';
const PixelRatio = require('PixelRatio');
const Platform = require('Platform');
const resolveAssetSource = require('resolveAssetSource');
const {SourceCode} = require('NativeModules');
const AssetUtil = require('./util/AssetUtil');

/**
 * 我们定义的Asset加载器
 * @param resolver
 * @returns {*}
 */
const ourAsset = (resolver) => {
    if (resolver.isLoadedFromServer()) {
        //从服务器加载
        return resolver.assetServerURL();
    }
    if (Platform.OS === 'android') {
        //android平台 根据拆分bundle情况，自定义Asset加载
        return resolver.isLoadedFromFileSystem() ?
            resolver.drawableFolderInBundle() :
            getCustomSourceTransformer(resolver);
    } else {
        return resolver.scaledAssetPathInBundle();
    }
};

/**
 * 获取自定义转换器
 * @param resolver
 * @returns {ResolvedAssetSource}
 */
const getCustomSourceTransformer = (resolver) => {
    return resolver.fromSource(getAssetPathInBundle(resolver));
};

/**
 * 获取拆分bundle的asset完整路径
 * @param resolver
 * @returns {*}
 */
const getAssetPathInBundle = (resolver) => {
    const path = getBundleBaseDir() || '';
    let bundleRoot = path.substring(0, path.lastIndexOf('/')); // already has scheme
    if (bundleRoot.startsWith('assets://')) {
        bundleRoot = bundleRoot.replace('assets://', 'asset:///'); // fresco's asset image resource uri scheme
    }
    //bundleRoot格式：asset:///bundle,AssetPath格式：sample_a/drawable-mdpi/src_assets_naruto.jpeg
    return joinPath(bundleRoot, AssetUtil.getAssetPathInBundle(resolver.asset, PixelRatio.get()));
};

let bundleBaseDir;//全局存储base所在目录，不用每次都计算

/**
 * 获取Bundle base所在目录
 * @returns {*}
 */
const getBundleBaseDir = () => {
    if (bundleBaseDir === undefined) {
        const scriptURL = SourceCode.scriptURL;
        if (!scriptURL) {
            // scriptURL is falsy, we have nothing to go on here
            bundleBaseDir = null;
            return bundleBaseDir;
        }
        // cut file://abc/base/index.bundle => file://abc/
        let bundleDir = scriptURL.substring(0, scriptURL.lastIndexOf('/'));
        bundleBaseDir = bundleDir.substring(0, scriptURL.lastIndexOf('/') + 1);
    }
    return bundleBaseDir;
};

/**
 * 拼接路径
 * @returns {*}
 */
const joinPath = (...args) => {
    if (args.length === 0) {
        return '';
    }
    let result = args[0];
    for (let i = 1; i < args.length; i++) {
        const candidate = args[i];
        if (result.endsWith('/')) {
            if (candidate.startsWith('/')) {
                result += candidate.substring(1);
            } else {
                result += candidate;
            }
        } else {
            if (candidate.startsWith('/')) {
                result += candidate;
            } else {
                result += '/' + candidate;
            }
        }
    }
    return result;
};

// function joinPath() {
//     if (arguments.length === 0) {
//         return '';
//     }
//     let result = arguments[0];
//     for (let i = 1; i < arguments.length; i++) {
//         const candidate = arguments[i];
//         if (result.endsWith('/')) {
//             if (candidate.startsWith('/')) {
//                 result += candidate.substring(1);
//             } else {
//                 result += candidate;
//             }
//         } else {
//             if (candidate.startsWith('/')) {
//                 result += candidate;
//             } else {
//                 result += '/' + candidate;
//             }
//         }
//     }
//     return result;
// };

/**
 * 设置自定义的 资源 转换器，替换使用原生default
 */
resolveAssetSource.setCustomSourceTransformer(resolver => {
    return ourAsset(resolver);
});