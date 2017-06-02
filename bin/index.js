/**
 * Created by sunxiaodong on 2017/5/27.
 */

'use strict';

const commander = require('commander');
const babylon = require('babylon');
const fs = require('fs');
const path = require('path');
const fileUtil = require('../util/fileUtil');
const bundler = require('./bundler');
const parser = require('./parse');

/**
 * 命令行参数设置
 */
commander
    .description('Split Bundle')
    .option('-o, --output <path>', 'Path to output bundle.')
    .option('-c, --config <path>', 'Config file for bundle-split.')
    .option('--platform <Platform>', 'Specify platform. ', 'android')
    .option('--dev [boolean]', 'Generate dev module.')
    .parse(process.argv);

//命令行参数保证
let configFile = commander.config;
if (!configFile) {
    throw new Error('not set config option, must set config option');
}

let outputDir = commander.output;
if (!outputDir) {
    throw new Error('not set output option, must set output option');
}

//配置文件相关操作
let configFilePath = path.resolve(process.cwd(), configFile);
if (!fileUtil.isFileExists(configFilePath)) {
    console.log('config file not exists!');
    process.exit(-1);
}
let configFileContent = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));

//输出文件操作
let absOutputDir = path.resolve(process.cwd(), outputDir);
fileUtil.createFilePath(absOutputDir);

//配置
const config = {
    inject: true,
    root: process.cwd(),
    dev: commander.dev === 'true',
    packageName : configFileContent['package'],
    platform : commander.platform,
    outputDir : path.join(absOutputDir, 'split'),
    bundleDir : path.join(absOutputDir, 'bundle'),
    baseEntry : {
        index: configFileContent.base.index,
        includes: configFileContent.base.includes
    },
    customEntries : configFileContent.custom
};

//使用react-native bundle，生成bundle
bundler.bundle(config)
    .then((code) => {
        parser.splitBundle(code, config);//拆分bundle
    })
    .catch((err) => {
        console.log(err);
    })
    .done();

// const parse = (filename) => {
//     const codePathDir = path.resolve(process.cwd(), 'bin');
//     const codePath = path.join(codePathDir, filename);
//     const code = fs.readFileSync(codePath, 'utf-8');
//     const codeAST = babylon.parse(code, {
//         sourceType: 'script',
//         plugins: ['jsx', 'flow']
//     });
//     console.log("parse:codeAST:" + codeAST);
// };
//
// parse('test.js');