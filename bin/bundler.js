/**
 * Created by sunxiaodong on 2017/5/27.
 */

'use strict';
const exec = require('child_process').exec;
const path = require('path');
const fileUtil = require('../util/fileUtil');
const fs = require('fs');
const UglifyJS = require('uglify-js');
const Q = require('q');

let bundler = {};

const DEV_REGEX = /global\.__DEV__\s?=\s?true/;
const DEV_FALSE = 'global.__DEV__ = false';

/**
 * 向base中注入引入业务模块代码
 * @param config
 * @returns {*}
 */
const injectBllModuleToBase = (config) => {
    let {customEntries, root, baseEntry} = config;
    let entryInject = '\n\nrequire(\'AppRegistry\')\n';
    customEntries.forEach(entry => {
        if (entry.inject === false) {
            return;
        }
        let indexModule = path.resolve(root, entry.index);
        entryInject += 'require(\'' + indexModule + '\');\n';
    });
    let tmpEntry = path.resolve(root, baseEntry.index + '.tmp');
    fileUtil.unlinkFile(tmpEntry);
    let baseOriginCode = fs.readFileSync(baseEntry.index, 'utf-8');
    fs.writeFileSync(tmpEntry, baseOriginCode + entryInject);
    return tmpEntry;
};

/**
 * 打包
 */
bundler.bundle = (config) => {
    const q = Q.defer();

    let {bundleDir, platform, dev} = config;
    let tmpBaseFile = injectBllModuleToBase(config);

    let bundlePath = path.resolve(bundleDir, 'index.bundle');
    fileUtil.createFilePath(bundleDir);

    //构建react-native打bundle命令
    let cmd = 'react-native bundle';
    cmd += ' --entry-file ' + tmpBaseFile;
    cmd += ' --bundle-output ' + bundlePath;
    cmd += ' --assets-dest ' + bundleDir;
    cmd += ' --platform ' + platform;

    console.log('--------Start Bundle---------');
    console.log(cmd);

    exec(cmd, (error) => {
        if (error) {
            q.reject(error);
            console.log('--------End Bundle---------');
        } else {
            let code = fs.readFileSync(bundlePath, 'utf-8');
            if (!dev) {
                //只截取5000个字符进行匹配，应该能更短？
                let globalDev = DEV_REGEX.exec(code.substring(0, 5000));
                //用将global.__DEV__ = true替换成false的作用？
                if (globalDev) {
                    console.log('Replace ' + globalDev[0] + ' with ' + DEV_FALSE);
                    code = code.replace(globalDev[0], DEV_FALSE);
                }
                fs.writeFileSync(bundlePath, code, 'utf-8');

                //压缩，混淆code
                code = UglifyJS.minify(bundlePath, {
                    compress: {
                        sequences: false,
                        global_defs: {
                            __DEV__: false
                        }
                    },
                    mangle: {
                        except: ['__d', 'require', '__DEV__']
                    }
                }).code;
                let minBundlePath = bundlePath + '.min';
                fs.writeFileSync(minBundlePath, code, 'utf-8');
            }
            fs.unlinkSync(tmpBaseFile);
            q.resolve(code);
            console.log('--------End Bundle---------');
        }
    });
    // exec(cmd).stdout.pipe(process.stdout);
    return q.promise;
};

module.exports = bundler;