define('NamespacedWebStorage',
[],
function () {

  var internalProperty = 'NamespacedWebStorage:Internal';
  /**
   * @name NamespacedWebStorage
   * @param {string} primaryNamespace
   * @param {Array.<string>=} restNamespaces
   * @param {Storage=} storage 保存先のStorage。デフォルトはlocalStorage
   * @constructor
   *
   * @version 0.0.3
   * @author monjudoh
   * @copyright <pre>(c) 2013 monjudoh
   * Dual licensed under the MIT (MIT-LICENSE.txt)
   * and GPL (GPL-LICENSE.txt) licenses.</pre>
   * @see https://github.com/monjudoh/NamespacedWebStorage.js
   */
  function NamespacedWebStorage(primaryNamespace,restNamespaces,storage){
    var namespaces = (restNamespaces || []).slice();
    namespaces.unshift(primaryNamespace);
    Object.defineProperty(this,internalProperty,{
      enumerable:false,
      configurable:true,
      writable:false,
      value:Object.create(null)
    });
    this.namespaces = namespaces;
    this.storage = storage || localStorage;
  }

  /**
   * @name NamespacedWebStorage:Internal
   * @memberOf NamespacedWebStorage#
   * @type {Object}
   * @private
   */
  var proto = NamespacedWebStorage.prototype;
  function key2FullKey(key){
    return this.namespaces.join('.') + '.' + key;
  }
  function fullKey2key(fullKey) {
    var namespacePart = this.namespaces.join('.') + '.';
    if (fullKey.indexOf(namespacePart) === 0) {
      return fullKey.replace(namespacePart, '');
    } else {
      return null;
    }
  }
  /**
   * @function hasItem
   * @memberOf NamespacedWebStorage#
   *
   * @param {string} key
   * @returns {boolean} 値が存在すればtrue
   * @description <pre>インスタンスのnamespace階層配下にてkeyに対応する値が存在するか調べる。
   * Storageには存在しないmethodでkey in storageに相当する。
   * backendのstorageが
   * Storageの場合は実装としてkey in storageを使う。
   * Storageでない場合は同様のhasItem methodがあるものとしてその結果を使う。
   * </pre>
   */
  proto.hasItem = function hasItem(key){
    var fullKey = key2FullKey.call(this,key);
    if (this.storage instanceof Storage) {
      return fullKey in this.storage;
    } else {
      return this.storage.hasItem(fullKey);
    }
  };
  /**
   * @function getItem
   * @memberOf NamespacedWebStorage#
   *
   * @param {string} key
   * @returns {*}
   * @description インスタンスのnamespace階層配下にてkeyに対応する値を取得する
   */
  proto.getItem = function getItem(key){
    var fullKey = key2FullKey.call(this,key);
    return JSON.parse((this.storage[fullKey] || '{}')).value;
  };
  /**
   * @function setItem
   * @memberOf NamespacedWebStorage#
   *
   * @param {string} key
   * @param {*} data JSON化可能な任意の型のデータ
   * @description インスタンスのnamespace階層配下にてkeyに対応する値を設定する。生のWebStorageと違い文字列型以外も扱える。
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
   * @function removeItem
   * @memberOf NamespacedWebStorage#
   *
   * @param {string} key
   * @description インスタンスのnamespace階層配下にてkeyに対応する値を削除する。
   */
  proto.removeItem = function removeItem(key) {
    var fullKey = key2FullKey.call(this,key);
    delete this.storage[fullKey];
  };
  /**
   * @function truncate
   * @memberOf NamespacedWebStorage#
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
        delete storage[key];
      });
    });
  };

  /**
   * @callback NamespacedWebStorage~onstorageCallback
   * @param key {string} NamespacedWebStorageのkey
   * @param ev {StorageEvent} originalのStorageEvent
   */
  /**
   * @name onstorage
   * @memberOf NamespacedWebStorage#
   * @type NamespacedWebStorage~onstorageCallback=
   * @description Storageに値が設定されNamespacedWebStorageの値が変わった際に通知する対象のcallbackを設定する
   */
  (function () {
    var storages = [];
    storages.includes = function includes(obj) {
      return this.indexOf(obj) !== -1;
    };
    function evHandler(ev){
      storages.forEach(function(storage){
        var key = fullKey2key.call(storage,ev.key);
        if (key !== null && ev.storageArea === storage.storage) {
          (storage[internalProperty].onstorage).call(storage,key,ev);
        }
      });
    }
    function addRemoveEventListener(){
      if (storages.length > 0) {
        window.addEventListener('storage', evHandler, false);
      } else {
        window.removeEventListener('storage', evHandler, false);
      }
    }

    Object.defineProperty(proto,'onstorage',{
      get:function () {
        return this[internalProperty].onstorage
      },
      set:function(handler) {
        if (typeof handler === 'function') {
          if (!storages.includes(this)) {
            storages.push(this);
          }
          this[internalProperty].onstorage = handler;
        } else if (handler === null || handler === undefined) {
          if (storages.includes(this)) {
            storages.splice(storages.indexOf(this),1);
          }
          this[internalProperty].onstorage = null;
        }
        addRemoveEventListener();
      }
    });
  })();

  return NamespacedWebStorage;
});