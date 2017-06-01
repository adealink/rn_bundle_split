/**
 * Created by sunxiaodong on 2017/5/27.
 */
const fileUtil = require('../util/fileUtil');
const babylon = require('babylon');
const ASTUtil = require('./ASTUtil');
const path = require('path');
const minimatch = require('minimatch');
const traverse = require('babel-traverse').default;
const assetUtil = require('./AssetUtil');
const fs = require('fs');

let parser = {};

let codeBlob;//压缩混淆处理后的bundle代码
let globalConfig;//拆分配置
let useCustomSplit;//是否使用自定义 拆分
let modules = {};//存放所有modules,key:moduleId,value:module 信息
let base = new Set();//base modules集合
let customEntries = [];//自定义实体集
let polyfills = [];//polyfills，依赖模块应用，全局定义部分
let moduleCalls = [];//模块调用部分
let baseEntryIndexModule;//base index module id，配置中base定义的index
let bundles = [];//拆分的bundle

const MODULE_SPLITER = '\n';//打入同一bundle中的各module代码分隔符

/**
 * 拆分bundle
 * @param code    使用react-native bundle打包，压缩后的代码
 * @param config  配置文件
 */
parser.splitBundle = (code, config) => {
    codeBlob = code;
    globalConfig = config;
    useCustomSplit = typeof config.customEntries !== 'undefined';

    let {outputDir} = config;
    fileUtil.createFilePath(outputDir);
    const bundleAST = babylon.parse(code, {
        sourceType: 'script',
        plugins: ['jsx', 'flow']
    });

    parseAST(bundleAST);//解析AST

    doSplit();//执行拆分

    genBundles(outputDir);//生成bundles
};

/**
 * 生成bundles
 */
const genBundles = (outputDir) => {
    bundles.forEach(subBundle => {
        console.log('----------- Split ' + subBundle.name + '--------------Start');
        //处理 code
        const code = subBundle.codes.join(MODULE_SPLITER);//将所有拆入相同module bundle的代码生成一份代码，打入同一bundle
        const subBundlePath = path.resolve(outputDir, subBundle.name);
        fileUtil.createFilePath(subBundlePath);
        const codePath = path.resolve(subBundlePath, 'index.bundle');
        fs.writeFileSync(codePath, code);
        console.log('[Code] Write code to ' + codePath);
        if (subBundle.assetRenames) {
            //处理 asset
            subBundle.assetRenames.forEach(item => {
                const assetNewDir = path.dirname(item.newPath);
                fileUtil.createFilePath(assetNewDir);
                console.log('[Resource] Move resource ' + item.originPath + ' to ' + item.newPath);
                fs.createReadStream(item.originPath).pipe(fs.createWriteStream(item.newPath));//移动 资产 到新的bundle路径
            });
        }
        console.log('----------- Split ' + subBundle.name + '--------------End');
    });
};

/**
 * 解析AST
 * @param bundleAST
 */
const parseAST = (bundleAST) => {
    const program = bundleAST.program;
    const body = program.body;
    const customBase = [];//base includes 中定义
    const customEntry = [];//自定义实体模块
    let reactEntryModule = undefined;//RN实体模块id
    let moduleCount = 0;//所有模块数
    body.forEach(node => {
        if (ASTUtil.isEmptyStmt(node)) {
            //空语句不做处理
            return;
        }
        let {start, end} = node;//设置node对应代码的起止位置

        if (ASTUtil.isPolyfillCall(node, globalConfig.dev)) {
            //将polyfill放入base中
            polyfills.push({start, end});
        } else if (ASTUtil.isModuleCall(node)) {
            //模块调用
            moduleCalls.push({start, end});
        } else if (ASTUtil.isModuleDeclaration(node)) {
            //模块声明
            moduleCount++;
            const args = node.expression.arguments;
            const moduleId = parseInt(args[1].value);
            const moduleName = args[3].value;

            //生成模块信息
            const module = {
                id: moduleId,
                name: moduleName,
                dependencies: getModuleDependency(args[0].body),//该模块所有依赖模块
                code: {start, end},
                idCodeRange: {
                    start: args[1].start - node.start,
                    end: args[1].end - node.start
                }
            };

            if (ASTUtil.isAssetModule(moduleName)) {
                //该模块为 资产 模块
                module.isAsset = true;
                module.assetConfig = Object.assign({}, ASTUtil.getAssetConfig(node), {moduleId});
                console.log('Get asset module ' + moduleName, module.assetConfig);
            }

            if (!reactEntryModule && ASTUtil.isReactNativeEntry(moduleName)) {
                //获取的第一 react-native 实体设置为reactEntryModule，用来初始化 base set。由代码（require('react-native'))生成
                reactEntryModule = moduleId;
            }

            //根据配置文件，拆分bundle code
            if (isBaseEntryModule(module)) {
                baseEntryIndexModule = moduleId;
                console.log('Get base entry module: ' + moduleName);
            } else if (isCustomBaseModule(module)) {
                customBase.push(moduleId);
                console.log('Get custom base ' + moduleName);
            } else if (useCustomSplit) {
                let entry = isCustomEntryModule(module);
                if (entry) {
                    customEntry.push({
                        id: moduleId,
                        name: entry.name
                    });
                    console.log('Get custom entry ' + moduleName);
                }
            }

            modules[moduleId] = module;
            console.log('Module ' + moduleName + '(' + moduleId + ') dependency:' + JSON.stringify(module.dependencies));
        } else {
            console.log(require('util').inspect(node, false, null));
            console.log('Cannot parse node!', codeBlob.substring(node.start, node.end));
        }
    });

    // 先生成 react-native base module.
    if (reactEntryModule) {
        genBaseModules(reactEntryModule);
    } else {
        console.warn('Cannot find react-native entry module! You should require(\'react-native\') at some entry.');
    }

    // 增加自定义 base modules，base includes
    customBase.forEach(base => {
        genBaseModules(base);
    });

    // 增加base index modules
    if (typeof baseEntryIndexModule !== 'undefined') {
        let module = modules[baseEntryIndexModule];
        let dependency = module.dependencies;
        for (let i = dependency.length - 1; i >= 0; i--) {
            if (customEntry.find(item => item.id === dependency[i])) {
                //从base index依赖中，移除所有custom index 实体
                dependency.splice(i, 1);
            }
        }
        genBaseModules(baseEntryIndexModule);
    }

    //生成自定义实体集
    customEntry.forEach(entry => {
        genCustomEntryModules(entry.name, entry.id);
    });

    console.log('Total modules :' + moduleCount);
    console.log('Base modules size: ' + base.size);
};

/**
 * 获取模块依赖
 * @param bodyNode
 * @returns {Array}
 */
const getModuleDependency = (bodyNode) => {
    if (bodyNode.type === 'BlockStatement') {
        let {start, end} = bodyNode;
        return ASTUtil.getModuleDependency(codeBlob, start, end);
    }
    return [];
};

/**
 * 是否为base 实体模块
 * @param module
 * @returns {*}
 */
const isBaseEntryModule = (module) => {
    let baseIndex = globalConfig.baseEntry.index;
    let indexGlob = path.join(globalConfig.packageName, baseIndex + '.tmp');
    return minimatch(module.name, indexGlob);
};

/**
 * 是否为自定义的 base 模块 （配置 base includes 中定义）
 * @param module
 * @returns {boolean}
 */
const isCustomBaseModule = (module) => {
    if (globalConfig.baseEntry.includes && globalConfig.baseEntry.includes.length > 0) {
        const includes = globalConfig.baseEntry.includes;
        const match = includes.find(glob => {
            const pathGlob = path.join(globalConfig.packageName, glob);
            return minimatch(module.name, pathGlob);
        });
        return typeof match !== 'undefined';
    }
    return false;
};

/**
 * 是否为自定义实体模块
 * @param module
 */
const isCustomEntryModule = (module) => {
    return globalConfig.customEntries.find(entry => {
        const pathGlob = path.join(globalConfig.packageName, entry.index);
        return minimatch(module.name, pathGlob);
    });
};

/**
 * 生成base modules，将所有base依赖的module找出
 * @param moduleId
 */
const genBaseModules = (moduleId) => {
    base.add(moduleId);
    const module = modules[moduleId];
    const queue = module.dependencies;

    if (!queue) {
        return;
    }
    let added = 0;
    while (queue.length > 0) {
        const tmp = queue.shift();

        if (base.has(tmp)) {
            //已存在的module不再处理
            continue;
        }

        if (modules[tmp].dependencies &&
            modules[tmp].dependencies.length > 0) {
            modules[tmp].dependencies.forEach(dep => {
                if (!base.has(dep)) {
                    queue.push(dep);
                }
            });
        }
        added++;
        base.add(tmp);
    }
    console.log('Module ' + module.name + ' added to base (' + added + ' more dependency added too)');
};

/**
 * 生成自定义实体modules
 * @param name
 * @param moduleId
 */
const genCustomEntryModules = (name, moduleId) => {
    const set = new Set();
    set.add(moduleId);

    const module = modules[moduleId];
    const queue = module.dependencies;

    if (!queue) {
        return;
    }
    let added = 0;
    while (queue.length > 0) {
        const tmp = queue.shift();

        if (set.has(tmp) || base.has(tmp)) {
            continue;
        }

        const dependency = modules[tmp].dependencies;
        if (dependency && dependency.length > 0) {
            dependency.forEach(dep => {
                if (!base.has(dep) && !set.has(dep)) {
                    queue.push(dep);
                }
            });
        }
        added++;
        set.add(tmp);
    }
    customEntries.push({
        moduleId,
        name,
        moduleSet: set
    });
    console.log('Module ' + module.name + ' added to bundle ' + name + '. (' + added + ' more dependency added too)');
};

/**
 * 执行拆分
 */
const doSplit = () => {
    splitBase();//拆分base

    if (useCustomSplit) {
        customEntries.forEach(entry => {
            splitCustomEntry(entry);//拆分各custom module
        });
        console.log('Use custom split');
    } else {
        splitNonBaseModules();//没有设置自定义拆包时，使用该方法拆包
    }
};

/**
 * 拆分base
 */
const splitBase = () => {
    const bundleName = 'base';
    const dev = globalConfig.dev;
    let codes = [];
    let assetRenames = [];
    //向base bundle中添加代码
    //首先，添加 polyfills
    polyfills.forEach((range, index) => {
        let code = codeBlob.substring(range.start, range.end);
        if (index === 1) {
            let requireAST = babylon.parse(code);
            let conditionNode;
            traverse(requireAST, {
                enter(path) {
                    if (ASTUtil.isRequirePolyfillCondition(path.node, dev)) {
                        conditionNode = path.node;
                    }
                },
                exit(path) {
                }
            });
            if (conditionNode) {
                //为什么移除 conditionNode 的代码？？？
                code = code.substring(0, conditionNode.start)
                    + code.substring(conditionNode.end);
            }
        }
        codes.push(code);
    });
    //然后 添加 base index和includes
    base.forEach(moduleId => {
        const module = modules[moduleId];
        let code = codeBlob.substring(module.code.start, module.code.end);
        code = code.substring(0, module.idCodeRange.start) +
            '\"' + module.name + '\"'
            + code.substring(module.idCodeRange.end);
        if (module.isAsset && module.assetConfig) {
            //资产 模块
            assetRenames = getAssetRenames(module.assetConfig, bundleName);
            code = addBundleToAsset(module, bundleName, code);
        } else if (moduleId === baseEntryIndexModule) {
            //base index module
            let dependencies = ASTUtil.getModuleDependencyCodeRange(code, 0, code.length);
            for (let i = dependencies.length - 1; i >= 0; i--) {
                if (customEntries.find(entry => parseInt(entry.moduleId) === parseInt(dependencies[i].module))) {
                    //移除custom index实体代码
                    code = code.replace(dependencies[i].code, '');
                }
            }
        }
        code = ASTUtil.replaceModuleIdWithName(code, modules);
        codes.push(code);
    });
    //接下来，添加module call
    moduleCalls.forEach(moduleCall => {
        let code = codeBlob.substring(moduleCall.start, moduleCall.end);
        code = ASTUtil.replaceModuleIdWithName(code, modules);
        codes.push(code);
    });

    bundles.push({
        name: bundleName,
        codes,
        assetRenames
    });
};

/**
 * asset根据拆包重命名
 * @param asset
 * @param bundle
 * @returns {Array}
 */
const getAssetRenames = (asset, bundle) => {
    const assetRenames = [];
    if (globalConfig.platform === 'android') {
        console.log('Get asset renames', asset);
        assetUtil.getAssetPathInDrawableFolder(asset).forEach(
            (relativePath) => {
                assetRenames.push({
                    originPath: path.resolve(globalConfig.bundleDir, relativePath),
                    relativePath: relativePath,
                    newPath: path.resolve(globalConfig.outputDir, bundle, relativePath)
                });
            }
        )
    }

    return assetRenames;
};

/**
 * 根据拆包分asset，生成bundle下的asset名
 * @param module
 * @param bundleName
 * @param code
 * @returns {string}
 */
const addBundleToAsset = (module, bundleName, code) => {
    const asset = module.assetConfig;
    let startInner = asset.code.start - module.code.start;
    let endInner = asset.code.end - module.code.start;
    return code.substring(0, startInner) + JSON.stringify({
            httpServerLocation: asset.httpServerLocation,
            width: asset.width,
            height: asset.height,
            scales: asset.scales,
            hash: asset.hash,
            name: asset.name,
            type: asset.type,
            bundle: bundleName
        }) + code.substring(endInner);
};

/**
 * 拆分自定义实体 custom index
 * @param entry
 */
const splitCustomEntry = (entry) => {
    const bundleName = entry.name;
    let codes = [];
    let assetRenames = [];
    entry.moduleSet.forEach(moduleId => {
        //添加各自定义 module 代码
        const module = modules[moduleId];
        let code = codeBlob.substring(module.code.start, module.code.end);
        code = code.substring(0, module.idCodeRange.start) +
            '\"' + module.name + '\"'
            + code.substring(module.idCodeRange.end);
        if (module.isAsset && module.assetConfig) {
            //资产 module
            assetRenames = assetRenames.concat(getAssetRenames(module.assetConfig, bundleName));
            code = addBundleToAsset(module, bundleName, code);
        }
        code = ASTUtil.replaceModuleIdWithName(code, modules);
        codes.push(code);
    });
    let entryModuleName = modules[entry.moduleId].name;
    codes.push('\nrequire(\"' + entryModuleName + '\");');
    bundles.push({
        name: bundleName,
        codes,
        assetRenames
    });
};

/**
 * 没有自定义 拆分 时的默认拆分
 */
const splitNonBaseModules = () => {
    const bundleName = 'business';
    let codes = [];
    let assetRenames = [];
    for (let moduleId in modules) {
        let moduleIdInt = parseInt(moduleId);

        if (modules.hasOwnProperty(moduleId) && !base.has(moduleIdInt)) {
            const module = modules[moduleIdInt];
            let code = codeBlob.substring(module.code.start, module.code.end);
            code = code.substring(0, module.idCodeRange.start) +
                '\"' + module.name + '\"'
                + code.substring(module.idCodeRange.end);
            if (module.isAsset && module.assetConfig) {
                assetRenames = getAssetRenames(module.assetConfig, bundleName);
                code = addBundleToAsset(module, bundleName, code);
            }
            code = ASTUtil.replaceModuleIdWithName(code, modules);
            codes.push(code);
        }
    }
    bundles.push({
        name: bundleName,
        codes,
        assetRenames
    });
};

module.exports = parser;