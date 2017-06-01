/**
 * Created by sunxiaodong on 2017/5/30.
 */

'use strict';

const MODULE_REGEX = /require\s?\(([0-9]+)[^)]*\)/g;
const EXPR_STMT = 'ExpressionStatement';//表达式语句
const EMPTY_STMT = 'EmptyStatement';//空语句
const IF_STMT = 'IfStatement';//if语句

const BINARY_EXPR = 'BinaryExpression';//二元运算表达式
const LOGICAL_EXPR = 'LogicalExpression';//逻辑运算表达式
const UNARY_EXPR = 'UnaryExpression';//一元运算表达式
const CALL_EXPR = 'CallExpression';//函数或方法调用表达式
const FUNC_EXPR = 'FunctionExpression';//函数表达式
const COND_EXPR = 'ConditionalExpression';//条件表达式
const IDENTIFIER = 'Identifier';//标识符
const LITERAL_NUM = 'NumericLiteral';//数字常量
const LITERAL_STR = 'StringLiteral';//字符串常量

let util = {};

//默认资产后缀
const DEFAULT_ASSET_EXTS = [
    'bmp', 'gif', 'jpg', 'jpeg', 'png', 'psd', 'svg', 'webp', // 图片 Image formats
    'm4v', 'mov', 'mp4', 'mpeg', 'mpg', 'webm', // 视频 Video formats
    'aac', 'aiff', 'caf', 'm4a', 'mp3', 'wav', // 音频 Audio formats
    'html', 'pdf', // 文档 Document formats
];

/**
 * 判断是否为RN 实体 require('react-native')时引入
 * @param moduleName
 * @returns {boolean}
 */
util.isReactNativeEntry = (moduleName) => {
    return moduleName === 'react-native-implementation' ||
        moduleName === 'react-native/Libraries/react-native/react-native.js';
};

/**
 * 判断是否为 资产 module
 * @param moduleName
 * @returns {boolean}
 */
util.isAssetModule = (moduleName) => {
    let ext = moduleName.substring(moduleName.lastIndexOf('.') + 1);
    return DEFAULT_ASSET_EXTS.indexOf(ext) > 0;
};

/**
 * 判断是否为 空语句
 * @param type
 * @returns {boolean}
 */
util.isEmptyStmt = (node) => {
    try {
        return node.type === EMPTY_STMT;
    } catch (e) {
        return false;
    }
};

/**
 * 获取资产配置
 * @param node
 * @returns {{code: {start, end}}}
 */
util.getAssetConfig = (node) => {
    const func = node.expression.arguments[0];
    const rhs = func.body.body[0].expression.right; //require(240).registerAsset({...})
    const propNode = rhs.arguments[0].properties; // {...}
    const assetConfig = {
        code: {
            start: rhs.arguments[0].start,
            end: rhs.arguments[0].end
        }
    };
    propNode.forEach(prop => {
        let key = prop.key.value ? prop.key.value : prop.key.name;
        if (key === 'scales') {
            let value = [];
            prop.value.elements.forEach(scaleNode => {
                value.push(scaleNode.value);
            });
            assetConfig[key] = value;
        } else {
            assetConfig[key] = prop.value.value;
        }
    });
    return assetConfig;
};

/**
 * 是否为模块调用
 * @param node
 * @returns {boolean}
 */
util.isModuleCall = (node) => {
    try {
        return node.type === EXPR_STMT
            && node.expression.type === CALL_EXPR
            && node.expression.callee.type === IDENTIFIER
            && node.expression.callee.name === 'require'
            && node.expression.arguments.length === 1
            && node.expression.arguments[0].type === LITERAL_NUM;
    } catch (e) {
        return false;
    }
};

/**
 * 是否为请求填充条件
 * @param node
 * @param dev
 * @returns {boolean}
 */
util.isRequirePolyfillCondition = (node, dev) => {
    if (node.type === IF_STMT
        && node.test.type === LOGICAL_EXPR
        && node.test.left.name === '__DEV__'
        && node.test.operator === '&&'
        && node.test.right.type === BINARY_EXPR) {
        let binaryExpr = node.test.right;
        if (dev) {
            return binaryExpr.left.operator === 'typeof'
                && binaryExpr.operator === '==='
                && binaryExpr.right.type === LITERAL_STR;
        } else {
            return binaryExpr.left.type === LITERAL_STR
                && binaryExpr.operator === '=='
                && binaryExpr.right.operator === 'typeof';
        }
    }
};

/**
 * 是否为填充调用
 * @param node
 * @param dev
 * @returns {boolean}
 */
util.isPolyfillCall = (node, dev) => {
    try {
        let isPolyfillCallExpr = (expr) => {
            return expr.type === CALL_EXPR
                && expr.callee.type === FUNC_EXPR
                && expr.callee.params.length === 1
                && expr.callee.params[0].type === IDENTIFIER
                && expr.arguments.length === 1
                && expr.arguments[0].type === COND_EXPR;
        };
        if (dev) {
            return node.type === EXPR_STMT && isPolyfillCallExpr(node.expression);
        } else {
            return node.type === EXPR_STMT
                && node.expression.type === UNARY_EXPR
                && isPolyfillCallExpr(node.expression.argument);
        }
    } catch (e) {
        return false;
    }
};

/**
 * 是否为模块声明
 * @param node
 * @returns {boolean}
 */
util.isModuleDeclaration = (node) => {
    try {
        return node.type === EXPR_STMT
            && node.expression.type === CALL_EXPR
            && node.expression.callee.type === IDENTIFIER
            && node.expression.callee.name === '__d';
    } catch (e) {
        return false;
    }
};


/**
 * 用名字替换module Id，防止因id更新导致的模块不能加载
 * @param codeBlob
 * @param modules
 * @returns {*}
 */
util.replaceModuleIdWithName = (codeBlob, modules) => {
    let dependencies = util.getModuleDependencyCodeRange(codeBlob, 0, codeBlob.length);
    if (dependencies) {
        dependencies.forEach(deps => {
            let moduleName = modules[deps.module].name;
            codeBlob = codeBlob.replace(deps.code, 'require(\"' + moduleName + '\")');
        });
    }
    return codeBlob;
};

/**
 * 获取模块依赖
 * @param codeBlob
 * @param start
 * @param end
 * @returns {Array} 依赖的moduleId数组
 */
util.getModuleDependency = (codeBlob, start, end) => {
    const dependency = [];
    const bodyString = codeBlob.substring(start, end);
    let result;
    while (result = MODULE_REGEX.exec(bodyString)) {
        dependency.push(parseInt(result[1]));//push的是moduleId
    }
    return dependency;
};

/**
 * 获取模块依赖代码范围
 * @param codeBlob
 * @param start
 * @param end
 * @returns {Array}
 */
util.getModuleDependencyCodeRange = (codeBlob, start, end) => {
    const dependency = [];
    const bodyString = codeBlob.substring(start, end);
    let result;
    while (result = MODULE_REGEX.exec(bodyString)) {
        dependency.push({
            code: result[0],
            module: parseInt(result[1])
        });
    }
    return dependency;
};

module.exports = util;