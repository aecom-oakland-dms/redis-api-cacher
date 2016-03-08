'use strict';

let redis = require('redis')
, bluebird = require('bluebird')
, _ = require('lodash')
, defaultDBIndex = 1
, defaultTTL = 60 * 60 // 1 hour
;

// pass in redis so prototype can be extended with LUA script to delete by pattern
require('redis-delete-wildcard')(redis);

// Async promises with bluebird
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

class Client{
  /**
   * [constructor description]
   * @param  {[object]} options [
   *  options object to instantiate the client with
   *  @param {[integer]} db [ redis db to select ]
   *  @param {[integer || false/null ]} ttl [ ttl value to expire after (in seconds).  null, false, and 0 will be interpreted as no expiration/ttl ]
   * ]
   * @return {[Client]}       
   */
  constructor(options){
    this.client = redis.createClient(null, null, { detect_buffers: true });
    // this.client = redis.createClient(null, null, { detect_buffers: true , 'return_buffers': true});
    this._keys = [];
    this.ttl = typeof options.ttl !== 'undefined' ? options.ttl : defaultTTL
    this.setDB(options.db || defaultDBIndex)
  }

  setDB(db){
    this._dbIndex = db
    this.client.select(db, (err, msg)=>console.log(`\n\n cache_client is connected to ${this._dbIndex}. errors: ${err}.  messages: ${msg} \n\n` ))
    return this
  }

  get cachedKeys(){
    return this._keys || []
  }

  set cachedKeys(keys){
    this._keys
  }

  addCachedKey(key){
    this.cachedKeys = this._keys.push(key)
    return this
  }

  removeCachedKey(key){
    _.pull(this.cachedKeys, key)
    return this
  }

  set ttl(ttl){
    this._ttl = ttl
  }

  get ttl(){
    // set the default ttl property to be used with
    // EXPIRE
    // http://redis.io/commands/expire
    // Set a key to expire after `n` seconds
    return this._ttl
  }

  set(key, val, timeout){
    this.client.set(key, val);

    let ttl = typeof timeout !== 'undefined' ? timeout : this.ttl;

    // only set key to expire if Client has a ttl value set
    if(this.ttl)
      this.expire(key, ttl);

    // store the key
    // for easy deletion later
    this.addCachedKey(key);

    // console.log(`the cache_client now has ${this.cachedKeys.length} keys`)
    // this.numkeys.then(num=>console.log(`redis now has ${num} keys`))
    
    return this
  }

  get numkeys(){
    return new Promise((resolve, reject)=>{
      this.client.keys('*', (err, keys)=> resolve(err ? 'error': keys.length ) )
    })
  }

  /**
   * [get description]
   * @param  {[string]} key [key string to search for]
   * @return {[Promise]}     [Promise resolved to found value]
   */
  get(key){
    return new Promise((resolve, reject)=>{
      this.client.getAsync(key)
        .catch(err=>{
          console.log(err)
          resolve()
        })
        .then( data=>{
          // console.log(`data found with key: ${key} - ${data}`);
          // console.log('typeof found data is:', typeof data);
          // console.log('data is an Array:', data instanceof Array);

          // parse the data back to JSON if it's a json object
          // could either be the result of:
          //  JSON.stringify(Array) 
          //  or 
          //  JSON.stringify(Object) 
          try{
            data = typeof data == 'string' ? (/\{.+\}/.test(data) || /\[.+\]/.test(data)) ? JSON.parse(data) : data : data;
          }catch(err){
            console.log(`error trying to parse cached string back to JSON for key: ${key}, data: ${data}`, err)
          }
          // console.log('resolved', key)
          resolve(data)
        })
    })
  }

  expire(key, ttl){
    this.client.expire(key, ttl)
    return this
  }

  flushKeys(keys){
    if(keys instanceof Array){
      for(let key of keys){
        this.removeCachedKey(key)
          .client.del(key)
      }
    }

    return this
  }

  flushCachedKeys(){
    return this.flushKeys(this.cachedKeys)
  }

  flushAllDBKeys(){
    this.client.keys('*', (err,keys)=>this.flushKeys(keys))
    return this
  }

  flushKeysLike(pattern){
    // https://www.npmjs.com/package/redis-delete-wildcard
    // this.client.delwild('pattern:*', function(error, numberDeletedKeys) {
    return new Promise((resolve, reject)=>{
      this.client.delwild(pattern, function(err, numberDeletedKeys) {
        if(err)
          return reject(err)
        return resolve(numberDeletedKeys)
      })
    })
  }

  buildCache(){
    console.log('cache_client building cache');
    // TODO - create this method
    console.log('cache_client - buildCache not active yet');s
  }

}

module.exports  = options => new Client( options ) 