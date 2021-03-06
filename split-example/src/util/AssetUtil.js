/**
 * Created by sunxiaodong on 2017/5/31.
 */

'use strict';

let util = {};

/**
 * 获取Asset在drawable文件夹中的路径
 * @param asset
 * @returns {Array}
 */
util.getAssetPathInDrawableFolder = (asset) => {
    const paths = [];
    //根据各种适配比例生成相应文件路径
    asset.scales.forEach(scale => {
        const drawableFolder = getAndroidDrawableFolderName(asset, scale);//asset存储dir
        const fileName = getAndroidResourceIdentifier(asset);//asset文件名
        paths.push(drawableFolder + '/' + fileName + '.' + asset.type);
    });
    return paths;
};

/**
 * 获取asset在所在bundle的完整路径
 * @param asset
 * @param deviceScale
 * @returns {string}
 */
util.getAssetPathInBundle = (asset, deviceScale) => {
    const scale = pickScale(asset.scales, deviceScale);
    const drawableFolder = getAndroidDrawableFolderName(asset, scale);
    const fileName = getAndroidResourceIdentifier(asset);
    return asset.bundle + '/' + drawableFolder + '/' + fileName + '.' + asset.type;
};

/**
 * 根据屏幕比例，选择合适比例的图片
 * @param scales       该图片所有比例
 * @param deviceScale  设备比例
 * @returns {*}
 */
const pickScale = (scales, deviceScale) => {
    // Packager guarantees that `scales` array is sorted
    for (let i = 0; i < scales.length; i++) {
        if (scales[i] >= deviceScale) {
            return scales[i];
        }
    }
    // If nothing matches, device scale is larger than any available
    // scales, so we return the biggest one. Unless the array is empty,
    // in which case we default to 1
    return scales[scales.length - 1] || 1;
};

/**
 * 根据适配比例，获取Android资产文件名后缀
 * @param scale
 * @returns {*}
 */
const getAndroidAssetSuffix = (scale) => {
    switch (scale) {
        case 0.75:
            return 'ldpi';
        case 1:
            return 'mdpi';
        case 1.5:
            return 'hdpi';
        case 2:
            return 'xhdpi';
        case 3:
            return 'xxhdpi';
        case 4:
            return 'xxxhdpi';
    }
};

/**
 * 获取Android资产文件名
 * @param asset
 * @param scale
 * @returns {string}
 */
const getAndroidDrawableFolderName = (asset, scale) => {
    const suffix = getAndroidAssetSuffix(scale);
    if (!suffix) {
        throw new Error(
            'Don\'t know which android drawable suffix to use for asset: ' +
            JSON.stringify(asset)
        );
    }
    return 'drawable-' + suffix;
};

/**
 * 获取asset完整文件名（由asset文件路径和文件名拼接而成）
 * @param asset
 * @returns {string}
 */
const getAndroidResourceIdentifier = (asset) => {
    const folderPath = getBasePath(asset);
    return (folderPath + '/' + asset.name)
        .toLowerCase()
        .replace(/\//g, '_')           // 将文件路径中的'/'替换为'_'
        .replace(/([^a-z0-9_])/g, '')  // 移除文件路径中的非法字符
        .replace(/^assets_/, '');      // 移除"assets_"前缀
};

/**
 * 获取asset文件路径
 * @param asset
 * @returns {string|string|string|string|*|string}
 */
const getBasePath = (asset) => {
    let basePath = asset.httpServerLocation;//httpServerLocation对应value的格式："/assets/src/assets"
    if (basePath[0] === '/') {
        basePath = basePath.substr(1);
    }
    return basePath;
};

module.exports = util;