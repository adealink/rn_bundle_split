/**
 * Created by sunxiaodong on 2017/5/27.
 */

'use strict';

const fs = require('fs');
const path = require('path');

let util = {};

/**
 * 判断文件是否存在
 */
util.isFileExists = (filePath) => {
    return fs.existsSync(filePath);
};

/**
 * 创建文件路径
 * @param filePath
 */
util.createFilePath = (filePath) => {
    if (!util.isFileExists(filePath)) {
        util.createFilePath(path.dirname(filePath));//递归创建父目录
        fs.mkdirSync(filePath);
    }
};

/**
 * 取消与文件的链接
 * @param filePath
 */
util.unlinkFile = (filePath) => {
    if (util.isFileExists(filePath)) {
        fs.unlinkSync(filePath);
    }
};

module.exports = util;