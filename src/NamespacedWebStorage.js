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

  /**
   *
   * @constructor NamespacedWebStorage~SetLike
   * @description ES6 Setっぽいもの
   * @private
   */
  function SetLike() {
    var self = [];
    self.has = function includes(value) {
      return this.indexOf(value) !== -1;
    };
    self.add = function add(value) {
      if (!self.has(value)) {
        self.push(value);
      }
    };
    self.delete = function deleteMethod(value) {
      if (self.has(value)) {
        self.splice(self.indexOf(this),1);
      }
    };
    Object.defineProperty(self,'size',{
      get:function get(){
        return this.length;
      }
    });
    return self;
  }
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
  // このmoduleでwindowに設定されたstorage eventのリスナのSet
  var storageEventListenerSet = new SetLike();

  function notifyStorageEvent(storageArea,key,oldValue,newValue){
    if (storageEventListenerSet.size === 0) {
      return;
    }
    if (oldValue === undefined) {
      oldValue = null;
    }
    var ev = document.createEvent('StorageEvent');
    ev.initStorageEvent('storage',false,false,key,oldValue,newValue,location.href,storageArea);
    storageEventListenerSet.forEach(function(eventListener){
      eventListener.call(window,ev);
    })
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
    var storageArea = this.storage;
    var fullKey = key2FullKey.call(this,key);
    var json = JSON.stringify({
      value:data,
      timestamp:Date.now()
    });

    var oldValue;
    oldValue = storageArea.getItem(fullKey);
    storageArea.setItem(fullKey,json);
    notifyStorageEvent(storageArea,fullKey,oldValue,json);
  };
  /**
   * @function removeItem
   * @memberOf NamespacedWebStorage#
   *
   * @param {string} key
   * @description インスタンスのnamespace階層配下にてkeyに対応する値を削除する。
   */
  proto.removeItem = function removeItem(key) {
    var storageArea = this.storage;
    var fullKey = key2FullKey.call(this,key);
    var oldValue;
    oldValue = storageArea.getItem(fullKey);
    storageArea.removeItem(fullKey);
    notifyStorageEvent(storageArea,fullKey,oldValue,null);
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
   * @typedef NamespacedWebStorage~OnstorageCallback_Addition
   * @property {boolean} isRemoved 当該keyが削除されたらtrue
   */
  /**
   * @callback NamespacedWebStorage~onstorageCallback
   * @param key {string} NamespacedWebStorageのkey
   * @param addition {NamespacedWebStorage~OnstorageCallback_Addition}
   * @param ev {StorageEvent=} originalのStorageEvent。debug用。
   */
  /**
   * @name onstorage
   * @memberOf NamespacedWebStorage#
   * @type NamespacedWebStorage~onstorageCallback=
   * @description Storageに値が設定されNamespacedWebStorageの値が変わった際に通知する対象のcallbackを設定する
   */
  (function () {
    // onstorageが設定されたNamespacedWebStorageのSet
    var storages = new SetLike();
    function evHandler(ev,fromPreviousEventLoop){
      if (fromPreviousEventLoop === undefined) {
        fromPreviousEventLoop = false;
      }
      var isKeyEmpty = ev.key === null || ev.key === '';
      var storageArea = ev.storageArea;

      // IEで他windowでの変更によりStorageEventが発火した場合、storageAreaの当該keyのvalueが反映されていない。
      // ので次event loopに飛ばす。
      if (isKeyEmpty) {
      } else if (ev.newValue && ev.newValue === storageArea[ev.key]) {
      } else if (ev.newValue === null) {
      } else if (ev.newValue === '' &&  storageArea[ev.key] === undefined) {
      } else {
        if (!fromPreviousEventLoop) {
          setTimeout(evHandler.bind(this, ev, true), 0);
        }
        return;
      }
      var isRemoved = ev.newValue === null || (ev.newValue === '' && storageArea[ev.key] === undefined);
      var isCleared = isRemoved && (ev.oldValue === null || ev.oldValue === '') && isKeyEmpty;
      var isNoChange = !isRemoved && ev.newValue === ev.oldValue;
      // IEでは値の変更がなくてもStorageEventが発火するので変更がない場合はcallbackに渡さない
      if (isNoChange) {
        return;
      }
      if (!isCleared) {
        storages.forEach(function (storage) {
          var key = fullKey2key.call(storage, ev.key);
          if (key !== null && storageArea === storage.storage) {
            (storage[internalProperty].onstorage).call(storage, key, {isRemoved: isRemoved}, ev);
          }
        });
      }
    }
    function addRemoveEventListener(){
      if (storages.size > 0) {
        window.addEventListener('storage', evHandler, false);
        storageEventListenerSet.add(evHandler);
      } else {
        window.removeEventListener('storage', evHandler, false);
        storageEventListenerSet.delete(evHandler);
      }
    }

    Object.defineProperty(proto,'onstorage',{
      get:function () {
        return this[internalProperty].onstorage
      },
      set:function(handler) {
        if (typeof handler === 'function') {
          storages.add(this);
          this[internalProperty].onstorage = handler;
        } else if (handler === null || handler === undefined) {
          storages.remove(this);
          this[internalProperty].onstorage = null;
        }
        addRemoveEventListener();
      }
    });
  })();

  return NamespacedWebStorage;
});