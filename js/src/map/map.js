
GSIBV.Map = class extends MA.Class.Base {


  constructor(container, options) {
    super();
    this._container = container;
    this._layerList = new GSIBV.Map.LayerList(this);
    this._layerList.on("change", MA.bind(this._onLayerListChange, this));
    this._layerList.on("order", MA.bind(this._onLayerOrderChange, this));
    
    this._controlLayerList = new GSIBV.Map.LayerList(this);


    
    this._drawManager = new GSIBV.Map.Draw.Manager(this);
    this._drawManager.on("listchange", MA.bind(this._onDrawManagerLayerListChange, this));
    this._drawManager.enable();


    this._compassVisible = true;

    this._momoryPointsNum = 1;
    this._startUp = {
      zoom: 7,
      center: [140.084556, 36.104611]
    };

    if (options) {
      if (options.zoom || options.zoom == 0) this._startUp.zoom = options.zoom;
      if (options.center) this._startUp.center = options.center;
      if (options.spriteList) this._spriteList = options.spriteList;
      if (options.localFont) this._localFont = options.localFont;


    }
    if (!this._spriteList) this._spriteList = GSIBV.CONFIG.Sprite.list;
    this._refreshBackground();
  }


  get map() { return this._map; }
  get layerList() { return this._layerList; }
  get ccontrolLayerList() { return this._controlLayerList; }
  get drawManager() { return this._drawManager; }
  get areaSelector() { return this._areaSelector; }

  set printMode( value) {
    if ( value ) {
      this._normalModeState = {
        center:this._map.getCenter(),
        pitch:this._map.getPitch(),
        bearing:this._map.getBearing(),
        centerCrossVisible : this.centerCrossVisible,
        compassVisible : this.compassVisible
      };

      if(this._compassControl2) {
        this._map.removeControl(this._compassControl2 );
      }
      if(!this._compassControl) {
        this._compassControl = new GSIBV.Map.Control.CompassControl(this._map);
      }
      this._map.addControl(this._compassControl, 'bottom-right');
      this._map.removeControl(this._navigationControl );
      this._map.removeControl(this._resetPitchRotateControl );
      this._map.removeControl(this._leftPanelToggleControl );
      if ( this._gpsControl ) this._map.removeControl(this._gpsControl );
      if ( this.centerCrossVisible ) {
        this._centerCross.visible = false;
      }
    } else { 

      if ( this._gpsControl ) this._map.addControl(this._gpsControl, 'bottom-right' );
      this._map.addControl(this._navigationControl, 'bottom-right');
      this._map.addControl(this._resetPitchRotateControl, 'bottom-right');
      this._map.addControl(this._leftPanelToggleControl, 'top-left');
      
      if ( this._compassControl ) {
        this._map.removeControl(this._compassControl );
      }
      if(!this._compassControl2) {
        this._compassControl2 = new GSIBV.Map.Control.CompassControl(this._map);
      }
      this._map.addControl(this._compassControl2, 'top-right');
      this._compassControl2.visible = false;

      if ( this._normalModeState) {
        this._map.setCenter( this._normalModeState.center );
        this._map.setPitch(this._normalModeState.pitch);
        this._map.setBearing(this._normalModeState.bearing);
        
      
        if ( this._normalModeState.centerCrossVisible ) {
          this._centerCross.visible = true;
        }

        if ( this._normalModeState.compassVisible ) {
          this._compassControl2.visible = true;
        }
      }


    }
    this._printMode = value;
    this._map.resize();

    this.fire( "printmodechange",{mode:this._printMode});
  }

  invalidate() {
    this._map.resize();
  }

  initialize(params) {
    if (typeof this._container == "string") {
      this._container = MA.DOM.select(this._container)[0];
    }

    if (params) {
      if (params.center) this._startUp.center = params.center;
      if (params.zoom) this._startUp.zoom = params.zoom;
    }
    this._loadSprite();
    //this.initializeMap();
  }

  _loadSprite() {
    this._spriteManager = new GSIBV.Map.SpriteManager();
    this._spriteManager.on("load", MA.bind(this._onLoadSprite, this));

    for( var i=0; i<this._spriteList.length; i++ ) {
      var sprite = this._spriteList[i];
      this._spriteManager.add(sprite.id, sprite.title, sprite.url );
    }
  }
  _onLoadSprite() {
    
    for( var i=0; i<this._spriteList.length; i++ ) {
      if (!this._spriteManager.isLoaded( this._spriteList[i].id ) ) return;
    }
    
    this.initializeMap();
  }

  _getDefaultSpriteUrl() {


    var path = location.pathname;
    var spriteUrl = location.protocol + "//" + location.host + "/";
    var m = path.match(/\/([^.\/]+.html)$/i);
    if (m) {
      spriteUrl += path.replace(m[1], "/sprite/sprite");
    } else {
      if (path.match(/\/$/))
        spriteUrl += path + "sprite/sprite";
      else
        spriteUrl += path + "/sprite/sprite";
    }

    return spriteUrl;
  }

  setControlMarginTop(top) {
    this._leftPanelToggleControl.setMargin({top:top});
    this._compassControl2.setMargin({top:top});
  }

  initializeMap(options) {

    var mapOptions = {
      container: this._container, //
      style: {
        "version": 8,
        "layers": [],
        "sources": {},
        "glyphs": "https://maps.gsi.go.jp/xyz/noto-jp/{fontstack}/{range}.pbf"

      },
      zoom: this._startUp.zoom,
      minZoom: 4,
      maxZoom: 17,
      center: this._startUp.center,
      boxZoom: false,
      crossSourceCollisions: false,
      preserveDrawingBuffer : GSIBV.CONFIG.MOBILE ? false : true,//GSIBV.Config.usePreserveDrawingBuffer, // Mac Safariの印刷対応
      pitchWithRotate: true, // pitch可
      touchZoomRotate : true,
      transformRequest : MA.bind(this._onTransformRequest,this)
    };
    if (this._localFont) {
      mapOptions["localIdeographFontFamily"] = this._localFont;

    } else {
      mapOptions["localIdeographFontFamily"] = false;
    }

    var map = new mapboxgl.Map(mapOptions);

    map.on("data", function (e) {
      //console.log(e);
    });
    GSIBV.Map.HatchImageManager.create(map);

    GSIBV.Map.ImageManager.create(map);

    // スケールコントロール
    var scale = new mapboxgl.ScaleControl({
      maxWidth: 80,
      unit: 'metric'
    });
    map.addControl(scale, 'bottom-right');
    this._scaleControl = scale;

    // GPSコントロール
    if ( GSIBV.CONFIG.MOBILE ) {
      this._gpsControl = new GSIBV.Map.Control.GPSControl( map );
      map.addControl(this._gpsControl, 'bottom-right');
    }
    // ズームコントロール
    var nav = new mapboxgl.NavigationControl({ showCompass: false });
    map.addControl(nav, 'bottom-right');
    this._navigationControl = nav;
    

    // 回転リセットコントロール
    var resetPitchRotate = new GSIBV.Map.Control.ResetPitchRotateControl({});
    map.addControl(resetPitchRotate, 'bottom-right');
    this._resetPitchRotateControl = resetPitchRotate;

    // 方位記号コントロール
    this._compassControl2 = new GSIBV.Map.Control.CompassControl(map, {"bottomLeft":true});
    map.addControl(this._compassControl2, 'top-right');
    if ( !this._compassVisible ) {
      this._compassControl2.visible = false;
    }
    // 左パネル表示コントロール
    var leftPanelToggle = new GSIBV.Map.Control.LeftPanelControl({});
    map.addControl(leftPanelToggle, 'top-left');

    leftPanelToggle.on("click",MA.bind(function(){
      this.fire("showleftpanel");
    },this));
    this._leftPanelToggleControl = leftPanelToggle;

    map.on("load", MA.bind(this._onLoad, this));
    map.on("move", MA.bind(this._onMove, this));
    map.on("moveend", MA.bind(this._onMoveEnd, this));
    map.on("click", MA.bind(this._onClick, this));
    map.on("contextmenu", MA.bind(this._onContextMenu, this));
    map.on("data", MA.bind(this._onDataLoad, this));

   
    /*
    var debug = function() {
        var center = map.getCenter();
        var z = map.getZoom();
        MA.DOM.select("#debug .pos")[0].innerHTML = 
            ( Math.round( center.lat *1000000 ) / 1000000 ) + "," + 
            ( Math.round( center.lng *1000000 ) / 1000000 ) + "," + 
            ( Math.round( z *1000 ) / 1000 );

    };
    debug();
    map.on("move",debug);
    */

    this._map = map;
    
    this._hanreiLoader = new GSIBV.Map.HanreiLoader( this, GSIBV.CONFIG.HANREILIST);



    this._fireMoveEvent("move");
  }


  set compassControlVisible(value) {
    if ( !this._compassControl)return;
    this._compassControl.visible = value;
  }

  _onTransformRequest(url, resourceType) {
    //if ( resourceType !== "Tile" ) return;


    return;

    //"https://maps.gsi.go.jp/xyz/mapboxtestdata1005/17/116552/51671.pbf";
    var regex = /^http[s]*:\/\/maps.gsi.go.jp\/xyz\/mapboxtestdata1005\/([0-9]+)\/([0-9]+)\/([0-9]+)\.pbf$/i;
    var m = url.match( regex);

    if ( m ) {
      var zoomList = [5,7,9,12,15,18]
      var zoom = parseInt(m[1]);
      for( var i=0; i<zoomList.length; i++) {
        if ( zoomList[i] == zoom ) return;
      }
      return {"url":"about:blank"};
      
    } else {
      
    }
      
  }

  get center() {
    return this._map.getCenter();
  }
  get zoom() {
    return this._map.getZoom();
  }

  get centerCrossVisible() {
    return this._centerCrossVisible;
  }
  get compassVisible() {
    return this._compassVisible;
  }

  get searchResultLayer() {
    return this._searchResultLayer;
  }
  get mousePositionControl() {
    return this._mousePositionControl;
  }
  get centerCrossControl() {
    return this._centerCross;
  }

  get spriteManager() {
    return this._spriteManager;
  }

  get drawManager() {
    return this._drawManager;
  }

  _onLoad() {

    var list = this._spriteManager.getList();

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      this._map.addImage(GSIBV.Map.SpriteManager.spriteId( item.id, item.info.id ), 
          item.img, { pixelRatioany: 1 })
    }
    this._initializeMapControlLayers();
    this.fire("load");

    
    
  }
  _onDataLoad(e) {
  }
  _initializeMapControlLayers() {


    //this._createCenterCross();
    //this._createMousePosition();

    this._centerCross = new GSIBV.Map.CenterCross(this._map);
    this._centerCrossVisible = true;
    this._centerCross.visible = this._centerCrossVisible;
    this._zoomGuideVisible = true;
    document.getElementById("zoomGuideCheckbox").addEventListener('change', event => {
      var bol = document.getElementById("zoomGuideCheckbox").checked;
      this.setZoomGuide(!bol);
    });
    this._mousePositionControl = new GSIBV.Map.MousePosition(this._map);
    /*
    this._mousePositionLayer = new GSIBV.Map.ControlLayer.MousePosition();
    this.addControlLayer( this._mousePositionLayer );
    
    this._centerCrossLayer = new GSIBV.Map.ControlLayer.CenterCross();
    this.addControlLayer( this._centerCrossLayer );
    */
    this._searchResultLayer = new GSIBV.Map.ControlLayer.SearchResult();
    this.addControlLayer(this._searchResultLayer);
  }

  _fireMoveEvent(eventType) {
    this.fire(eventType, {
      center: this._map.getCenter(),
      zoom: this._map.getZoom()
    });
  }

  
  _onMove(e) {
    if ( this._popupContextMenu ) this._popupContextMenu.hide();
    this._fireMoveEvent("move");
  }
  _onMoveEnd(e) {
    this._fireMoveEvent("moveend");
  }

  _onContextMenu(e) {
    if ( this._printMode || this._drawManager.drawing)return;
    this.showPopupContextMenu(e.lngLat,{
      left:e.originalEvent.clientX, 
      top:e.originalEvent.clientY
    });
  }

  _addMemoryPoint( latlng, zoom ) {
    if ( !this._memoryPointList ) {
      this._memoryPointList = [];
    }

    while( this._memoryPointList.length >= this._momoryPointsNum ) {
      this._memoryPointList.shift();
    }

    var memoryPoint = {
      "latlng" : latlng,
      "zoom" :zoom,
      "title" : "[住所読み込み中]"
    };

    memoryPoint._addrLoader = new GSIBV.Map.Util.AddrLoader();
    memoryPoint._addrLoader.on("load", MA.bind(function (memoryPoint,e) {
      memoryPoint["title"] = (e.params.title ? e.params.title.replace(/[\s]/g,"") : "[不明な地点]");
    }, this, memoryPoint));

    memoryPoint._addrLoader.load(latlng);

    
    this._memoryPointList.push (memoryPoint );


  }


  showPopupContextMenu(latlng, pos) {

    var menuItems = [];

    var lang = GSIBV.application.lang;

    var langCaption = GSIBV.CONFIG.LANG[lang.toUpperCase()].UI.MAPPOPUP;
    var vectorTile = ( lang != "ja" ? GSIBV.CONFIG.LANG[lang.toUpperCase()].VECTORTILE : null );
    
    if ( !GSIBV.CONFIG.ReadOnly ) {
      var features = ( latlng ? GSIBV.Map.getPointFeatures( this._map, latlng,3 ) : [] );
      
      if ( features.length > 0 ) {
        if ( menuItems.length > 0 ) {
          menuItems.push( {"type":"separator"} );
        }


        var sakuzuFeatures = {};

        for( var i=0; i<features.length; i++ ) {
          
          var item = {
            "id" : "feature",
            "title" : langCaption["unknownobject"]
          };

          var feature = features[i];
          // 作図
          if ( feature.properties  && feature.properties["-sakuzu-id"]) {
            if ( sakuzuFeatures[ feature.properties["-sakuzu-id"]]) continue;
            sakuzuFeatures[ feature.properties["-sakuzu-id"]] = true;
            item.title = feature.properties["-sakuzu-title"];
            menuItems.push(item);
            continue;
          }
          //
          if (feature.layer.metadata ) {
            if ( feature.layer.metadata.path ) {
              
              if ( vectorTile) {
                var path = feature.layer.metadata.path;
                var pathParts = path.split( "-");

                for( var j=0; j<pathParts.length; j++ ) {
                  var langPath= vectorTile[pathParts[j]];
                  if ( langPath ) pathParts[j] = langPath;

                }
                item.title = pathParts.join("-") ;
              } else {
                item.title = feature.layer.metadata.path ;
              }
            } else if ( feature.layer.metadata.title) {
              item.title = feature.layer.metadata.title;
            }
            
            if ( feature.layer.metadata["layer-id"] ) {
              item["layer-id"] = feature.layer.metadata["layer-id"];
            }
          } else if ( feature.properties ) {
            //console.log(feature);
            if ( feature.properties["name"] ) {
              item.title = feature.properties["name"];
            }
          }
          
          if ( item.title == langCaption["unknownobject"] ) continue;
          menuItems.push(item);
        }
      }
    }

    if ( this._map.getPitch() != 0 || this._map.getBearing() != 0 ) {
      if ( menuItems.length > 0  ) menuItems.push( {"type":"separator"} );
      menuItems.push( 
        {"id":"resetpitchbearing","title": langCaption["resetrotation"]}
      );
    }
    
    if ( menuItems.length > 0  ) menuItems.push( {"type":"separator"} );

    var memoryTitle = langCaption["remember"] + ( this._momoryPointsNum > 1 ? " (" + langCaption["max"] + this._momoryPointsNum + ")" : "" );
    menuItems.push( 
      {"id":"memorypoint","title": memoryTitle, latlng:latlng, zoom: this._map.getZoom()}
    );
    if ( this._memoryPointList ) {
      for( var i =0; i<this._memoryPointList.length; i++ ) {
        var p = this._memoryPointList[i]
        menuItems.push( 
          {"id":"memorypoint-select","title": p.title + ( lang == "ja" ? "付近に移動" : "" ), latlng:p.latlng, zoom: p.zoom }
        );
      }
    }



    if ( menuItems.length <= 0 ) return;

    if (!this._popupContextMenu ) {
      this._popupContextMenu = new GSIBV.UI.Popup.Menu ();
      this._popupContextMenu.on("select",MA.bind(function(e){
        if ( e.params.item.id == "resetpitchbearing") {
          this.resetPitchBrearing();
        } else if ( e.params.item.id == "feature") {
          this.fire("requestlayeredit", {"layer-id" : e.params.item["layer-id"]})
        } else if ( e.params.item.id == "memorypoint" ) {
          this._addMemoryPoint( e.params.item.latlng, e.params.item.zoom );
        
        } else if ( e.params.item.id == "memorypoint-select" ) {
          this._map.flyTo( { center:e.params.item.latlng,zoom : e.params.item.zoom} );
        }
        //this._map.resetNorth({}, { "exec": "resetrotate" });
        
      },this));
    }

    this._popupContextMenu.items = menuItems;
    this._popupContextMenu.show(null, pos);

  }

  resetPitchBrearing() {
    this._map.easeTo({ pitch: 0, bearing : 0}, { "exec": "resetpitch" });
  }

  static getPointFeatures( map, latLng, around) {
    var point = map.project(latLng);

    var featuresAll = [];
    var layerIdHash = {};
    //around = 0;
    
    if ( around == undefined) around = 0;

    for (var x = point.x - around; x <= point.x + around; x++) {

      for (var y = point.y - around; y <= point.y + around; y++) {
        var features = map.queryRenderedFeatures(new mapboxgl.Point(x, y));
        
        for (var i = 0; i < features.length; i++) {
          var feature = features[i];
          if (feature.properties["-gsibv-control"]) continue;
          var id = feature.layer.id;
          if ( feature.layer.metadata && feature.layer.metadata["layer-id"])
            id = feature.layer.metadata["layer-id"];
          
          if (layerIdHash[id]) continue;
          featuresAll.push(feature);
          layerIdHash[id] = true;
        }
      }
    }
    return featuresAll;

  }

  _onClick(e) {

    if ( this._drawManager.drawing)return;

    var featuresAll = [];
    var layerIdHash = {};

    for (var x = e.point.x - 3; x <= e.point.x + 3; x++) {

      for (var y = e.point.y - 3; y <= e.point.y + 3; y++) {
        var features = this._map.queryRenderedFeatures(new mapboxgl.Point(x, y));
        for (var i = 0; i < features.length; i++) {
          var feature = features[i];
          if (layerIdHash[feature.layer.id] ) continue;// || (!feature.sourceLayer && !feature.properties["-gsibv-popupContent"])) continue;
          featuresAll.push(feature);
          layerIdHash[feature.layer.id] = true;
        }
      }
    }
    var latLng = e.lngLat;
    if (featuresAll.length > 0) {
      var html = '';
      var className = "-gisbv-popup-content";
      for (var i = 0; i < featuresAll.length; i++) {
        if ( i > 0) return;

        var curFeature = featuresAll[i];
        if (curFeature.properties["-gsibv-popupContent"]) {
          html = curFeature.properties["-gsibv-popupContent"];
          if (curFeature.properties["iconPosition"]) {
            var position = JSON.parse(curFeature.properties["iconPosition"]);
            latLng.lng = position._lng;
            latLng.lat = position._lat;
            var pos = this._map.project(latLng);
            var fixpos = {
              x: pos.x - 13,
              y: pos.y - 10
            }
            latLng = this._map.unproject(fixpos);
          }
          if (curFeature.properties["-gsibv-popupClassName"]) {
            className = curFeature.properties["-gsibv-popupClassName"];
          }
          break;
        }
      }
      if (html != '') {
        var popup = new mapboxgl.Popup({ "className": className })
          .setLngLat(latLng)
          .setHTML(html)
          .addTo(this._map);
      }
    }
  }

  flyTo(center, zoom) {
    if (!center || !zoom) return;

    if (center.lat)
      this._map.flyTo({ center: [center.lng, center.lat], zoom: zoom });
    else
      this._map.flyTo({ center: center, zoom: zoom });

  }

  setView(latlng) {
    if ((latlng.lat || latlng.lat == 0) && (latlng.lng || latlng.lng == 0)) {
      this._map.setCenter([latlng.lng, latlng.lat]);
    }
    if (latlng.z || latlng.z == 0) {
      this._map.setZoom(latlng.z);
    }
  }

  _onLayerListChange(e) {
    //this.fire("layerchange");

    this._refreshBackground();

    switch (e.params.type) {

      case "add":
        if (!this._layerChangeHandler)
          this._layerChangeHandler = MA.bind(this._onLayerChange, this);
        e.params.layer.on("change", this._layerChangeHandler);

        break;

      case "remove":
        e.params.layer.off("change", this._layerChangeHandler);
        break;
    }

    this.fire("layerchange");
  }

  _onLayerOrderChange() {
    if ( this._drawManager ) this._drawManager.layerList.refreshLayerOrder();
    this._controlLayerList.refreshLayerOrder();
    this.fire("layerchange");
  }

  _onLayerChange() {
    this.fire("layerchange");
  }

  _refreshBackground() {

    var noLayer = true;
    if (this._layerList) {
      for (var i = 0; i < this._layerList.length; i++) {
        if (this._layerList.get(i).visible) {
          noLayer = false;
          break;
        }
      }
    }

    if (noLayer) {

      this._container.style.background = "#555";
      this._container.style.backgroundImage = 'url(\'data:image/svg+xml,<svg height="8" fill="rgba(255,255,255,0.1)" viewBox="0 0 8 8" width="8" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="4" height="4" /><rect x="4" y="4" width="4" height="4" /></svg>\')';
    }
    else {
      this._container.style.background = "#ffffff";
    }
  }


  _onDrawManagerLayerListChange() {
    this._controlLayerList.refreshLayerOrder();
  }

  addLayer(layer, index) {
    if (!this._vectorTileLoadHandler) {
      this._vectorTileLoadHandler = MA.bind(this._onVectorTileLoad, this);
    }
    layer.on("loading", this._vectorTileLoadHandler);
    layer.on("load", this._vectorTileLoadHandler);
    layer.on("breakpoint", this._vectorTileLoadHandler);
    layer.on("finish", this._vectorTileLoadHandler);

    var result = this._layerList.add(layer, index);

    //this._drawManager.layerList.refreshLayerOrder();
    //this._controlLayerList.refreshLayerOrder();
    return result;
  }

  removeLayer(layer) {
    layer = this._layerList.remove(layer);


    if ( layer) {
      layer.off("loading", this._vectorTileLoadHandler);
      layer.off("load", this._vectorTileLoadHandler);
      layer.off("breakpoint", this._vectorTileLoadHandler);
      layer.off("finish", this._vectorTileLoadHandler);
    }
    //this._drawManager.layerList.refreshLayerOrder();
    //this._controlLayerList.refreshLayerOrder();
  }


  addControlLayer(layer) {
    var result = this._controlLayerList.add(layer);
    return result;
  }

  removeControlLayer(layer) {
    this._controlLayerList.remove(layer);
  }


  clearLayers() {
    this._layerList.clear();


  }

  moveLayer(layer, inc) {
    if (inc < 0)
      this._layerList.up(layer, Math.abs(inc));
    else if (inc > 0)
      this._layerList.down(layer, Math.abs(inc));


    if ( this._drawManager ) this._drawManager.layerList.refreshLayerOrder();
    this._controlLayerList.refreshLayerOrder();
  }

  get layers() {
    var result = [];
    for (var i = 0; i < this._layerList.length; i++) {
      result.push(this._layerList.get(i));
    }

    return result;
  }

  _onVectorTileLoad(e) {
    if (!this._loadingVectorTileList)
      this._loadingVectorTileList = [];

    switch (e.type) {
      case "loading":
        this._loadingVectorTileList.push({ "layer": e.from, "state": e.type });
        break;
      case "load":
        for (var i = 0; i < this._loadingVectorTileList.length; i++) {
          if (this._loadingVectorTileList[i].layer == e.from) {
            this._loadingVectorTileList[i].state = e.type;
            break;
          }
        }
        break;
      
      case "breakpoint":
        for (var i = 0; i < this._loadingVectorTileList.length; i++) {
          if (this._loadingVectorTileList[i].layer == e.from) {
            this._loadingVectorTileList[i].state=e.type;
            break;
          }
        }
        break;
      case "finish":
        for (var i = 0; i < this._loadingVectorTileList.length; i++) {
          if (this._loadingVectorTileList[i].layer == e.from) {
            this._loadingVectorTileList.splice(i, 1);
            break;
          }
        }
        break;
    }
    this.fire("vectortile", { "list": this._loadingVectorTileList });

  }

  centercrosschange(){
    this._centerCrossVisible = !this._centerCrossVisible;
    this._centerCross.visible=this._centerCrossVisible;
    //this.fire("layerchange");
  }

  zoomguidechange(){
    this._zoomGuideVisible = !this._zoomGuideVisible;
  }

  setZoomGuide(bol){
    this._zoomGuideVisible = bol;
  }

  getZoomGuide(){
    return this._zoomGuideVisible;
  }
  onZoomCheck(item){
    var zoom = this.zoom;
    if (item.maxzoom && zoom > item.maxzoom){
      return true;
    }
    if (item.minzoom && zoom < item.minzoom){
      return true;
    }
    return false;
  }
  compassChange(){
    this._compassVisible = !this._compassVisible;
    this._compassControl2.visible=this._compassVisible;
    //this.fire("layerchange");
  }


  makeWorldFileText (data) {

    const mapCanvas = this._map.getCanvas();
    const width = mapCanvas.clientWidth;
    const height = mapCanvas.clientHeight;

    //var size = (this.options.pixelBounds ? this.options.pixelBounds.getSize() : this._map.getSize());

    var bounds = this._map.getBounds();


    //var bounds = (this.options.pixelBounds ? this.options.latLngBounds : this._map.getBounds());

    var project = function (latlng) { // (LatLng) -> Point
      console.log( latlng );
      var MAX_LATITUDE = 85.0511287798;
      var DEG_TO_RAD = Math.PI / 180;

      var d = DEG_TO_RAD,
        max = MAX_LATITUDE,
        lat = Math.max(Math.min(max, latlng.lat), -max),
        x = latlng.lng * d,
        y = lat * d;

      y = Math.log(Math.tan((Math.PI / 4) + (y / 2)));

      return { x:x, y:y};
    };

    var northWest = project(
      data ? data.northWest : bounds.getNorthWest()
    );
    var southEast = project(
      data ? data.southEast : bounds.getSouthEast()
    );


    var lt = {
      lng: northWest.x * 6378137.0,
      lat: northWest.y * 6378137.0
    };
    var rb = {
      lng: southEast.x * 6378137.0,
      lat: southEast.y * 6378137.0
    };
    var txt = "";
    txt += ((rb.lng - lt.lng) / width) + "\n";
    txt += "0\n";
    txt += "0\n";
    txt += -((rb.lng - lt.lng) / width) + "\n";
    txt += lt.lng + "\n";
    txt += lt.lat;
    return txt;
  }

  makeImageCanvas(callback, options) {


    const mapCanvas = this._map.getCanvas();
    const mapImage = new Image();

    const width = mapCanvas.clientWidth;
    const height = mapCanvas.clientHeight;
    
    const canvas = MA.DOM.create("canvas");


    if ( options.data ) {
      canvas.width = options.data.width;
      canvas.height = options.data.height;
    } else {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "rgb(255,255,255)";
    ctx.fillRect(0,0,width,height);

    mapImage.onload = () => {

      // 切り取る等の加工

      if ( options.data ) {
        console.log( options.data );
        ctx.drawImage(mapImage,
          options.data.left, options.data.top, options.data.width, options.data.height, 
          0,0, options.data.width, options.data.height );
      } else {
        ctx.drawImage(mapImage, 0, 0);
      }

      // 地理院地図ロゴ
      if (options && options.credit) {
        var text = "地理院地図";
        ctx.font = "normal 25px 'メイリオ','ヒラギノ角ゴ Pro W3'";

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';

        const textPos = {x:width-6,y:height-6};
        if ( options.data ) {
          textPos.x = options.data.width-6;
          textPos.y = options.data.height-6;
        }
        ctx.globalAlpha = 0.8;
        ctx.strokeText(text, textPos.x, textPos.y);
        ctx.globalAlpha = 1;
        ctx.fillText(text, textPos.x, textPos.y);
      }
      // スケールバーロゴ
      if (options && options.checkZoom) {
        var area = document.querySelector('.mapboxgl-ctrl.mapboxgl-ctrl-scale');
        var text = area.innerText;
        var barHeight = height
        if ( options.data ) {
          barHeight = options.data.height;
        }
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
  
        ctx.beginPath();
        ctx.moveTo(6, barHeight - 26);
        ctx.lineTo(6, barHeight - 6);
        ctx.lineTo(6 + area.clientWidth+2, barHeight - 6);
        ctx.lineTo(6 + area.clientWidth+2, barHeight - 26);
        ctx.stroke();
  
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = "#fff";
        ctx.fillRect(7, barHeight -26, area.clientWidth, 19);
  
        ctx.font = "normal 11px 'メイリオ','ヒラギノ角ゴ Pro W3'";
        ctx.fillStyle = "#333";
        ctx.globalAlpha = 1;
        ctx.lineWidth = 0.5;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(text, 11, barHeight - 12);
      }
      if ( callback ) {
        callback(canvas);
      }
    };
    mapImage.onerror = () => {
      if ( callback ) {
        callback(undefined);
      }
    };
    mapImage.src = mapCanvas.toDataURL('image/png');
    return canvas;
  }


  startAreaSelect(mode) {
    if ( !this._areaSelector ) {
      this._areaSelector = new GSIBV.Map.AreaSelector(this._map);
      this._areaSelector.on("change", (e) => {
        this.fire("areaselectorchange",e.params);
      });
      this._areaSelector.on("move", (e) => {
        this.fire("areaselectorchange",e.params);
      });
      this._areaSelector.on("valid", (e) => {
        this.fire("areaselectorvalid",e.params);
      });
      this._areaSelector.on("invalid", (e) => {
        this.fire("areaselectorinvalid", e.params);
      });
    }

    this._areaSelector.start(mode);
  }


  stopAreaSelect() {
    if ( !this._areaSelector ) return;
    this._areaSelector.destroy();
    this._areaSelector = undefined;
  }

}



GSIBV.Map.AutoPan = class extends MA.Class.Base {

  constructor(map) {
    super();
    this._map = map;
  }

  stop() {
    this.destroy();
  }

  _destroyTimer() {
    if ( this._timer ) {
      clearInterval( this._timer);
      this._timer = undefined;
    }
  }

  destroy() {
    this._destroyTimer();

    if ( this._mouseMoveHandler ) {
      MA.DOM.off(this._map.getCanvasContainer(), "mousemove", this._mouseMoveHandler );
      this._mouseMoveHandler = undefined;
    }
    if ( this._mouseOutHandler ) {
      MA.DOM.off(this._map.getCanvasContainer(), "mouseleave", this._mouseOutHandler );
      this._mouseOutHandler = undefined;
    }
    if ( this._mapMoveHandler ) {
      this._map.off( "move", this._mapMoveHandler );
      this._mapMoveHandler = undefined;
    }
  }

  start() {
    if ( !this._mouseMoveHandler ) {
      this._mouseMoveHandler = MA.bind( this._onMouseMove, this );
      MA.DOM.on(this._map.getCanvasContainer(), "mousemove", this._mouseMoveHandler );
    }
    if ( !this._mouseOutHandler ) {
      this._mouseOutHandler = MA.bind( this._onMouseOut, this );
      MA.DOM.on(this._map.getCanvasContainer(), "mouseleave", this._mouseOutHandler );
    }
    
    if ( !this._mapMoveHandler ) {
      this._mapMoveHandler = MA.bind( this._onMapMove, this );
      this._map.on( "move", this._mapMoveHandler );
    }
  }

  _onMouseOut() {
    this._prevMousePos = undefined;
    this._panInfo = undefined;
    this._destroyTimer();
  }

  _onMouseMove(e) {
    var map = this._map;
    var offset = MA.DOM.offset(map.getContainer() );
    var size = MA.DOM.size(map.getContainer() );

    if ( offset.left > e.pageX || offset.left + size.width < e.pageX
        || offset.top > e.pageY || offset.top + size.height < e.pageY ) {
      this._panInfo = undefined;
      this._destroyTimer();
      this._prevMousePos = {
        x : e.pageX,
        y : e.pageY
      };
      return;
    }

    if ( this._prevMousePos ){
      var panBy = {
        x:0,
        y:0
      };

      if (this._panInfo && this._prevMousePos.x == e.pageX ) {
        panBy.x = this._panInfo.x;
      }
      if (this._panInfo && this._prevMousePos.y == e.pageY ) {
        panBy.y = this._panInfo.y;
      }

      
      if ( e.pageX < 50 && this._prevMousePos.x > e.pageX){ 
        panBy.x = -128;
      } else if ( e.pageX > offset.left+size.width - 50 && this._prevMousePos.x < e.pageX ) {
        panBy.x = 128;
      }
      
      if ( e.pageY < 50 && this._prevMousePos.y > e.pageY){ 
        panBy.y = -128;
      } else if ( e.pageY > offset.top+size.height - 50 && this._prevMousePos.y < e.pageY ) {
        panBy.y = 128;
      }


      if ( panBy.x != 0 || panBy.y != 0) {
        this._panInfo = panBy;
        if ( !this._timer) {
          this._pan();
          this._timer = setInterval( MA.bind(this._pan,this) , 500);
        }
      } else {
        this._panInfo = undefined;
        this._destroyTimer();
      }
    }

    this._prevMousePos = {
      x : e.pageX,
      y : e.pageY
    };
  }


  _pan() {
    if ( !this._panInfo ) return;
    this._map.panBy( new mapboxgl.Point(this._panInfo.x,this._panInfo.y),undefined, {"from":"-auto-pan"});

  }

  _onMapMove(evt) {
    if ( evt.from == "-auto-pan") {
      this.fire("move");
    }
  }


};
