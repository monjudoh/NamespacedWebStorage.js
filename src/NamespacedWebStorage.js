/*
 * NamespacedWebStorage.js
 *
 * https://github.com/monjudoh/NamespacedWebStorage.js
 * version: 0.0.1
 *
 * Copyright (c) 2013 monjudoh
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 */
/**
 * @module NamespacedWebStorage
 * @version 0.0.1
 * @author monjudoh
 * @copyright (c) 2013 monjudoh<br/>
 * Dual licensed under the MIT (MIT-LICENSE.txt)<br/>
 * and GPL (GPL-LICENSE.txt) licenses.
 * @see https://github.com/monjudoh/NamespacedWebStorage.js
 * @see NamespacedWebStorage
 */
define('NamespacedWebStorage',
[],
function () {
  /**
   * @name NamespacedWebStorage
   * @param {string} primaryNamespace
   * @param {Array.<string>=} restNamespaces
   * @param {Storage=} storage 保存先のStorage。デフォルトはlocalStorage
   * @constructor
   */
  function NamespacedWebStorage(primaryNamespace,restNamespaces,storage){
    var namespaces = (restNamespaces || []).slice();
    namespaces.unshift(primaryNamespace);
    this.namespaces = namespaces;
    this.storage = storage || localStorage;
  }
  var proto = NamespacedWebStorage.prototype;
  function key2FullKey(key){
    return this.namespaces.join('.') + '.' + key;
  }
  /**
   * @name getItem
   * @memberOf NamespacedWebStorage
   * @function
   *
   * @param {string} key
   * @returns {*}
   */
  proto.getItem = function getItem(key){
    var fullKey = key2FullKey.call(this,key);
    return JSON.parse((this.storage[fullKey] || '{}')).value;
  };
  /**
   * @name setItem
   * @memberOf NamespacedWebStorage
   * @function
   *
   * @param {string} key
   * @param {*} data JSON化可能な任意の型のデータ
   */
  proto.setItem = function setItem(key,data){
    var fullKey = key2FullKey.call(this,key);
    var json = JSON.stringify({
      value:data,
      timestamp:Date.now()
    });
    this.storage[fullKey] = json;
  };
  /**
   * @name removeItem
   * @memberOf NamespacedWebStorage
   * @function
   *
   * @param {string} key
   */
  proto.removeItem = function removeItem(key) {
    var fullKey = key2FullKey.call(this,key);
    delete this.storage[fullKey];
  };
  /**
   * @name truncate
   * @memberOf NamespacedWebStorage
   * @function
   *
   * @param {number} number 残す個数
   * @param {number=} level namespace階層。デフォルト値は1
   * @description 指定したnamespace階層配下にて、記録日時が新しい順にnumber個のnamespaceを残して残りを削除する。
   */
  proto.truncate = function truncate(number,level) {
    level = level !== undefined ? level : 1;
    var keyPrefix = this.namespaces.slice(0,level).join('.') + '.';
    var storage = this.storage;
    var keys = Object.keys(storage).filter(function(key){
      return key.indexOf(keyPrefix) === 0;
    });
    var namespace2keys = Object.create(null);
    keys.forEach(function(key){
      var nextLevelNamespace = key.slice(keyPrefix.length).match(/^[^.]+/)[0];
      if (!namespace2keys[nextLevelNamespace]) {
        namespace2keys[nextLevelNamespace] = [];
      }
      namespace2keys[nextLevelNamespace].push(key);
    });
    var namespaces = Object.keys(namespace2keys);
    var namespace2latestTimestamp = Object.create(null);
    namespaces.forEach(function(namespace){
      var timestamps = namespace2keys[namespace].map(function(key){
        return JSON.parse(storage[key]).timestamp;
      });
      timestamps.push(0);
      timestamps.push(0);
      namespace2latestTimestamp[namespace] = Math.max.apply(Math,timestamps);
    });
    namespaces.sort(function(namespace1,namespace2){
      var table = namespace2latestTimestamp;
      return table[namespace2] - table[namespace1];
    });
    var namespaces4truncate = namespaces.slice(number);
    namespaces4truncate.forEach(function(namespace){
      namespace2keys[namespace].forEach(function(key){
        delete this.storage[key];
      });
    });
  };
  return NamespacedWebStorage;
});