class AssetSync {
  constructor(url, scene) {
    this.url = url;
    this.scene = scene;
    this.container = null;
    this.numberOfInstances = 0;
    this.info = null;
  }
  load(callback,failure) {
    console.log('loading '+this.url);
    //await this.loadSync(callback,failure);
    this.loadAsset(callback,failure);
    console.log('loaded '+this.url+" "+this.numberOfInstances);
  }
  async loadAsset(callback,failure) {
    if ( this.promise ) {
      await this.promise;
      this.numberOfInstances++;
      this.instantiate(callback);
      return;
    }
    this.promise = new Promise( (resolve, reject) => {
      if ( this.container ) {
        resolve();
      } else {
        this.numberOfInstances++;
        console.log('loading sync '+this.url+" "+this.numberOfInstances);
        // load
        var pos = this.url.lastIndexOf('/');
        var path = this.url.substring(0,pos+1);
        var file = this.url.substring(pos+1);
        var plugin = BABYLON.SceneLoader.LoadAssetContainer(path, file, this.scene, (container) =>
          {
            console.log("Loaded asset "+this.url);
            //var root = container.createRootMesh();
            this.container = container;
            container.addAllToScene();
            callback(container, this.info);

            resolve();
          }, null, (scene, message, exception)=>{
            if ( failure ) {
              failure(exception);
            } else {
              console.log(message, exception);
            }
            reject();
          }
        );
        plugin.onParsedObservable.add(gltfBabylon => {
            var manifest = gltfBabylon.json;
            this.info = manifest.asset.extras;
            console.log(this.info);
        });
      }
    });
    return this.promise;
    
  }
  instantiate(callback) {
    console.log('instantiating '+this.numberOfInstances+" of "+this.url);
    // instantiate
    var instances = this.container.instantiateModelsToScene();
    console.log("Instantiated "+this.numberOfInstances+" of "+this.url);
    callback(this.container, this.info, instances);
  }
}

/** 
Loads assets from GLTF files and keeps references, creates clones of already loaded assets.
 */
export class AssetLoader {
  constructor(scene) {
    this.scene=scene;
    // contains asset containers - name and number of used instances
    this.containers={};
    this.debug=true;
  }
  async loadAsset( url, callback, failure ) {
    await this.createAsset(url);
    this.containers[url].load(callback, failure);
  }
  async createAsset(url) {
    if ( !this.containers[url] ) {
      console.log("Creating asset "+url);
      this.containers[url] = new AssetSync(url, this.scene);
    }
  }
  /**
  Load or instantiate mesh of a VRObject.
  @param obj VRObject to load
  @param callback function executed on success
  @param failure function executed on failure
   */
  loadObject(obj, callback, failure) {
    this.loadAsset(
      obj.mesh, 
      (container, info, instantiatedEntries) => {
        if ( instantiatedEntries ) {
          obj.instantiatedEntries = instantiatedEntries;
    
          // Adds all elements to the scene
          var mesh = obj.instantiatedEntries.rootNodes[0];
          mesh.VRObject = obj;
          mesh.name = obj.mesh;
          mesh.scaling = new BABYLON.Vector3(1,1,1);
          mesh.refreshBoundingInfo();
          mesh.id = obj.className+" "+obj.id;
    
          console.log("Instantiated "+this.numberOfInstances+" of "+obj.mesh, obj);
    
          callback(mesh);
    
        } else {
          var mesh = container.createRootMesh();
          
          // Adds all elements to the scene
          mesh.VRObject = obj;
          mesh.name = obj.mesh;
          mesh.id = obj.className+" "+obj.id;
          
          obj.container = container;
          
          console.log("Loaded "+obj.mesh);
          
          callback(mesh);
        }
      }, 
      failure 
    );
  }
  
  /**
  Remove a loaded VRObject from the scene.
  @param obj VRObject to remove
  @returns number of remaining instances
   */
  unloadObject(obj) {
    if ( this.containers[obj.mesh] ) {
      // loaded by asset loader
      console.log("Unloading object ",obj);
      var container = this.containers[obj.mesh];
      this.unloadAsset(obj.mesh, obj.instantiatedEntries);
      return container.numberOfInstances;
    } else if ( obj.container ) {
      // TODO remove after refactoring
      // legacy, loaded by some other component (avatar.js)
      console.log("FIXME: disposing of "+obj.id);
      obj.container.dispose();
      return 0;
    }
  }
  unloadAsset(url, instantiatedEntries) {
    if ( this.containers[url] ) {
      // loaded by asset loader
      var asset = this.containers[url];
      var container = this.containers[url].container;
      asset.numberOfInstances--;
      if ( instantiatedEntries ) {
        console.log("Removing an instance of "+url+", "+asset.numberOfInstances+" remaining");
        instantiatedEntries.rootNodes.forEach( node => node.dispose() );
        instantiatedEntries.skeletons.forEach( node => node.dispose() );
        instantiatedEntries.animationGroups.forEach( node => node.dispose() );
      } else {
        console.log("Disabling main instance of "+url+", "+asset.numberOfInstances+" remaining");
      // well we can't dispose of container just like that
        container.meshes[0].setEnabled(false);
      }
      if ( asset.numberOfInstances == 0 ) {
        console.log("Unloaded "+url);
        container.dispose();
        delete this.containers[url];
      }
    }
    // TODO else error
  }
}