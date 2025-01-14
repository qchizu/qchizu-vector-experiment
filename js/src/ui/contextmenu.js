/***************************************
    GSIBV.UI.ContextMenu
    ContextMenu管理
***************************************/
GSIBV.UI.ContextMenu = class extends GSIBV.UI.Base {


  constructor(options) {
    super(options);
    this._options = options;
    this._mode = 'mapcenter';
    this._dispAddrMode = 0;
    this._seamlessVisible = false;
  }

  get seamlessphotoVisible () {
    return this._seamlessVisible;
  }

  get height() {
    if (!MA.DOM.hasClass(this._container, "-ma-expand")) {
      return 0;
    }

    var size = MA.DOM.size(MA.DOM.find(this._container, ".context-menu-content")[0]);
    return size.height;
  }

  get buttonHeight() {
    if (MA.DOM.hasClass(this._container, "-ma-expand")) {
      return 0;
    }

    var size = MA.DOM.size(this._toggleButton);
    return size.height;

  }

  _onLangChange() {

    var lang = GSIBV.application.lang;
    var contextMenuLang = GSIBV.CONFIG.LANG[lang.toUpperCase()].UI.CONTEXTMENU;

    for( var key in contextMenuLang) {
      var elem = MA.DOM.find( this._container, key );
      if ( elem.length <= 0 ) continue;
      elem[0].innerHTML = contextMenuLang[key];
    }
    this._stop();
    this._start();
  }

  initialize(visible) {

    GSIBV.application.on("langchange", MA.bind( this._onLangChange, this ) );

    if (typeof this._options.container == "string") {
      this._container = MA.DOM.select(this._options.container)[0];
    } else {
      this._container = this._options.container;
    }
    MA.DOM.find( this._container,".controls")[0].style.display = 'block';

    this._layerInfoView = MA.DOM.select(".context-menu-layer-info")[0];
    this._layerInfoView.style.display = 'none';
    MA.DOM.on(MA.DOM.find(this._layerInfoView, ".close-button")[0], "click", MA.bind(this._hideLayerInfoView, this));


    try {
      this._layerInfoViewScrollbar = new PerfectScrollbar(MA.DOM.find(this._layerInfoView, ".scroll-frame")[0]);

      var textareaList = MA.DOM.find(this._layerInfoView, "textarea");

      for (var i = 0; i < textareaList.length; i++) {
        MA.DOM.on(textareaList[i], "transitionend", MA.bind(function () {
          if (this._layerInfoViewScrollbar) this._layerInfoViewScrollbar.update();
        }, this));
      }
    } catch (e) { }

    this._featuresFrame = MA.DOM.find(this._container, ".features-frame")[0];
    this._featuresFrame.style.display = 'none';


    this._toggleButton = MA.DOM.find(this._container, ".toggle-button")[0];

    this._centerModeButton = MA.DOM.find(this._container, ".button.center")[0];
    this._clickModeButton = MA.DOM.find(this._container, ".button.click")[0];

    this._containerTable = MA.DOM.select(".context-menu-content table")[0];
    this._dispAddrButton = MA.DOM.find(this._containerTable, ".button.addr")[0];
    this._valueAddr = MA.DOM.find(this._containerTable, ".value.addr")[0];

    MA.DOM.on(this._centerModeButton, "click", MA.bind(this._onCenterModeClick, this));
    MA.DOM.on(this._clickModeButton, "click", MA.bind(this._onClickModeClick, this));
    MA.DOM.on(this._dispAddrButton, "click", MA.bind(this._onaddrdispClick, this));
    MA.DOM.on(this._valueAddr, "click", MA.bind(this._onaddrdispClick, this));
    
    MA.DOM.on(this._toggleButton, "click", MA.bind(this._onToggleClick, this));
    //var resetRotate = new ButtonControl();
    //map.addControl(resetRotate, 'bottom-right');
    this._onLangChange();
    if (visible) this.show();
    this._updateHint();
  }

  _onaddrdispClick(){
    if (this._dispAddrMode == 0){
      this._dispAddrMode = 1;
    }
    else{
      this._dispAddrMode = 0;
    }

    if (this._mode == "mapcenter"){
      this._getPointInfo(this._map.map.getCenter());
    }
    else{
      this._getPointInfo(this._map.mousePositionControl._latlng);
    }
  }

  _onCenterModeClick() {
    MA.DOM.removeClass(this._clickModeButton, "active");
    MA.DOM.addClass(this._centerModeButton, "active");
    this._mode = 'mapcenter';
    this._stop();
    this._start();
  }

  _onClickModeClick() {

    MA.DOM.removeClass(this._centerModeButton, "active");
    MA.DOM.addClass(this._clickModeButton, "active");
    this._mode = 'click';
    this._stop();
    this._start();
  }

  set map(map) {
    this._map = map;
    this._layerList = this._map.layerList;
    this._layerList.on("change", MA.bind(this._onLayerListChange, this));
  }

  _onLayerListChange() {
    const hasSeamless = this._layerList.contains({id:"seamlessphoto"});
    if ( hasSeamless !== this._seamlessVisible ) {
      this._seamlessVisible = hasSeamless;
      
      if (MA.DOM.hasClass(this._container, "-ma-expand-full")) {
        this.show(true);
      } else if (MA.DOM.hasClass(this._container, "-ma-expand")) {
        this.show();
      } else {
       this.hide();
      }

      if ( this._seamlessVisible) {
        if (this._mode == "mapcenter"){
          this._getPointInfo(this._map.map.getCenter());
        } else{
          this._getPointInfo(this._map.mousePositionControl._latlng);
        }
      }
    }

    const lakeDepthLayer = this._layerList.find({id:"lakedata"});
    const lakeDepthVisible = lakeDepthLayer /*&& lakeDepthLayer.visible*/ ? true : false;
    if(lakeDepthVisible !== this._lakeDepthVisible) this._updateLakeDepthVisible(lakeDepthVisible);
  }

  _start() {
    if ( !this._map) return;
    if (this._mode == "mapcenter") {

      this._removeMapCanvasClass();
      this._map.mousePositionControl.visible = false;
      //this._map.centerCrossControl.visible = true;
      if (this._mapClickhandler) {
        this._map.off("click", this._mapClickhandler);
        this._mapClickhandler = null;
      }

      if (this._moveEndHandler) return;

      this._moveEndHandler = MA.bind(this._onMapMoveEnd, this);
      this._map.on("moveend", this._moveEndHandler);
      this._onMapMoveEnd();

      this._elevationLoader = new GSIBV.Map.Util.FooterElevationLoader();
      this._elevationLoader.on("start", MA.bind(function (e) {
        this._setView({ "elevation": "" });
      }, this));
      this._elevationLoader.on("finish", MA.bind(function (e) {
        if (e.params.h != undefined) {
          this._setView({
            "elevation": Math.round(e.params.h * 10) / 10 + "m",
            "elevationTarget": e.params.title
          });
        } else {
          this._setView({ "elevation": "" });
        }
      }, this));
      this._elevationLoader.start(this._map.map);

      this._lakedepthLoader = new GSIBV.Map.Util.LakeDepthLoader({"visibility": this._lakeDepthVisible});
      this._lakedepthLoader.on("start", MA.bind(function (e) {
        this._setLakeDepthView(this._lakedepthLoader.typename, null);
      }, this));
      this._lakedepthLoader.on("finish", MA.bind(function (e) {
        let h = e.params.h !== undefined ? Math.round(e.params.h * 10) / 10 : null;
        this._setLakeDepthView(this._lakedepthLoader.typename, h);
      }, this));
      this._lakedepthLoader.start(this._map.map);

      this._lakeStdHeightLoader = new GSIBV.Map.Util.LakeStdHeightLoader({"visibility": this._lakeDepthVisible});
      this._lakeStdHeightLoader.on("start", MA.bind(function (e) {
        this._setLakeDepthView(this._lakeStdHeightLoader.typename, null);
      }, this));
      this._lakeStdHeightLoader.on("finish", MA.bind(function (e) {
        let h = e.params.h !== undefined ? Math.round(e.params.h * 10) / 10 : null;
        this._setLakeDepthView(this._lakeStdHeightLoader.typename, h);
      }, this));
      this._lakeStdHeightLoader.start(this._map.map);
    } else {
      if (this._moveEndHandler) {
        this._map.off("moveend", this._moveEndHandler);
        this._moveEndHandler = null;
      }

      this._setLakeDepthView("lakedepth", null);
      this._setLakeDepthView("lakestdheight", null);
      this._setView({ "elevation": "", "seamlessphoto":"", "addr": "", "utmPoint": "", "lat": "", "lng": "" });
      this._map.mousePositionControl.visible = true;

      if (!this._mapClickhandler) {
        this._mapClickhandler = MA.bind(this._onMapClick, this);
        this._map.map.on("click", this._mapClickhandler);
      }

      this._addMapCanvasClass();
    }
  }

  _addMapCanvasClass() {
    var canvasList = MA.DOM.find(this._map.map.getContainer(), "canvas");

    for (var i = 0; i < canvasList.length; i++) {
      MA.DOM.addClass(canvasList[i], "-gsibv-mousepoint-mode");
    }
  }

  _removeMapCanvasClass() {

    var canvasList = MA.DOM.find(this._map.map.getContainer(), "canvas");

    for (var i = 0; i < canvasList.length; i++) {
      MA.DOM.removeClass(canvasList[i], "-gsibv-mousepoint-mode");
    }
  }

  _stop() {
    if ( !this._map)return;

    this._removeMapCanvasClass();

    this._featuresFrame.style.display = 'none';
    //this._map.centerCrossControl.visible = true;
    this._map.mousePositionControl.visible = false;
    if (this._moveEndHandler) {
      this._map.off("moveend", this._moveEndHandler);
      this._moveEndHandler = null;
    }
    if (this._mapClickhandler) {
      this._map.map.off("click", this._mapClickhandler);
      this._mapClickhandler = null;
    }

    if (this._elevationLoader) {
      this._elevationLoader.destroy();
      this._elevationLoader = null;
    }

    if (this._addrLoader) {
      this._addrLoader.destroy();
      this._addrLoader = null;
    }

    if (this._seamlessPhotoInfoLoader) {
      this._seamlessPhotoInfoLoader.destroy();
      this._seamlessPhotoInfoLoader = null;
    }

    if (this._lakedepthLoader) {
      this._lakedepthLoader.destroy();
      this._lakedepthLoader = null;
    }

    if (this._lakeStdHeightLoader) {
      this._lakeStdHeightLoader.destroy();
      this._lakeStdHeightLoader = null;
    }
  }

  _onMapClick(e) {
    var map = this._map.map;
    var pos = map.unproject(e.point);
    this._getPointInfo(pos, map.getZoom());

    if (!this._elevationLoader) {
      this._elevationLoader = new GSIBV.Map.Util.FooterElevationLoader();
      this._elevationLoader.on("start", MA.bind(function (e) {
        this._setView({ "elevation": "" });
      }, this));
      this._elevationLoader.on("finish", MA.bind(function (e) {
        if (e.params.h != undefined) {
          this._setView({
            "elevation": Math.round(e.params.h * 10) / 10 + "m",
            "elevationTarget": e.params.title
          });
        } else {
          this._setView({ "elevation": "" });
        }
      }, this));
    }
    this._elevationLoader.load(this._map.map, pos);

    if(!this._lakedepthLoader) {
      this._lakedepthLoader = new GSIBV.Map.Util.LakeDepthLoader({"visibility": this._lakeDepthVisible});
      this._lakedepthLoader.on("start", MA.bind(function (e) {
        this._setLakeDepthView(this._lakedepthLoader.typename, null);
      }, this));
      this._lakedepthLoader.on("finish", MA.bind(function (e) {
        let h = e.params.h !== undefined ? Math.round(e.params.h * 10) / 10 : null;
        this._setLakeDepthView(this._lakedepthLoader.typename, h);
      }, this));
    }
    
    if(!this._lakeStdHeightLoader){
      this._lakeStdHeightLoader = new GSIBV.Map.Util.LakeStdHeightLoader({"visibility": this._lakeDepthVisible});
      this._lakeStdHeightLoader.on("start", MA.bind(function (e) {
        this._setLakeDepthView(this._lakeStdHeightLoader.typename, null);
      }, this));
      this._lakeStdHeightLoader.on("finish", MA.bind(function (e) {
        let h = e.params.h !== undefined ? Math.round(e.params.h * 10) / 10 : null;
        this._setLakeDepthView(this._lakeStdHeightLoader.typename, h);
      }, this));
    }

    if(this._lakeDepthVisible)
    {
      this._lakedepthLoader.load(this._map.map, pos);
      this._lakeStdHeightLoader.load(this._map.map, pos);
    }

    this._map.mousePositionControl.latlng = pos;
  }

  _onMapMoveEnd() {
    this._getPointInfo(this._map.map.getCenter(), this._map.map.getZoom());
  }

  _getPointInfo(pos) {
    var map = this._map.map;

    var data = {};

    if (!this._addrLoader) {
      this._addrLoader = new GSIBV.Map.Util.AddrLoader();
      this._addrLoader.on("load", MA.bind(function (e) {
        var data = {};
        data["addr"] = (e.params.title ? e.params.title : "");
        data["addrYomi"] = (e.params.titleYomi ? e.params.titleYomi : "");
        /*
        if ( GSIBV.application.lang == "ja")
          data["addr"] = (e.params.title ? e.params.title : "");
        else
          data["addr"] = (e.params.titleEng ? e.params.titleEng : "");
        */
        this._setView(data);

      }, this));
    }

    this._addrLoader.load(pos);
    var utmPoint = GSIBV.Map.Util.UTM.latlng2PointName(pos.lat, pos.lng);
    var dms = GSIBV.Map.Util.latLngToDMS(pos, GSIBV.application.lang != "ja");

    if (utmPoint) data["utmPoint"] = utmPoint;
    if (dms) data["dms"] = dms;
    data["lat"] = (Math.round(pos.lat * 1000000) / 1000000).toFixed(6);
    data["lng"] = (Math.round(pos.lng * 1000000) / 1000000).toFixed(6);
    data["zoom"] = (Math.round(map.getZoom() * 100) / 100).toFixed(2);

    if (!this._seamlessPhotoInfoLoader) {  
      this._seamlessPhotoInfoLoader = new GSIBV.Map.Util.SeamlessPhotoInfoLoader();
      this._seamlessPhotoInfoLoader.on("load", MA.bind(function (e) {
        this._setView({"seamlessphoto":e.params["撮影年月"]});
      },this ));
    }

    const zoom = map.getZoom();

    if ( this.seamlessphotoVisible && zoom >= 13 ) {
      this._seamlessPhotoInfoLoader.load({lat:pos.lat,lng:pos.lng});
    }
    data["seamlessphoto"] = "";

    this._setView(data);

    this._setFeatrues(this._getFeatures(pos));
  }

  _curMode(){
    if (MA.DOM.hasClass(this._container, "-ma-expand-full")) return "full";
    if (MA.DOM.hasClass(this._container, "-ma-expand")) return "mid";
    return 'min';
  }

  _updateLakeDepthVisible(enabled){
    this._lakeDepthVisible = enabled;
    if(this._lakedepthLoader) this._lakedepthLoader.visibility = enabled;
    if(this._lakeStdHeightLoader) this._lakeStdHeightLoader.visibility = enabled;

    let lakeDepthContainer = MA.DOM.find(this._container, ".lakedepth")[0];
    if(lakeDepthContainer) lakeDepthContainer.style.display = this._curMode() == 'full'  && enabled? 'block':'none';

    this._refresh();
  }

  _setLakeDepthView(typename, h){
    if(!["lakedepth", "lakestdheight"].includes(typename) || h === undefined) return;

    h = h!==null?h.toFixed(1):undefined;
    if(typename == "lakedepth"){
      this._lakeDepth = h;
    } else {
      this._lakeStdHeight = h;
    }

    const strNoData = '------';
    let strDisplay = ": <lakedepth> (湖底標高: <lakebtmheight>　基準水面標高: <lakestdheight>) "

    strDisplay = strDisplay.replace('<lakedepth>', this._lakeDepth!== undefined?this._lakeDepth + 'm':strNoData);
    strDisplay = strDisplay.replace('<lakestdheight>', this._lakeStdHeight!== undefined?this._lakeStdHeight + 'm':strNoData);

    this._lakeBtmHeight = undefined;
    if(this._lakeDepth !== undefined && this._lakeStdHeight !== undefined){
      try{
        this._lakeBtmHeight = (parseFloat(this._lakeStdHeight) - parseFloat(this._lakeDepth)).toFixed(1);
      } catch {}
    }
    strDisplay = strDisplay.replace('<lakebtmheight>', this._lakeBtmHeight!== undefined?this._lakeBtmHeight + 'm':strNoData);

    var elem = MA.DOM.find(this._container, ".lakedepth.value")[0];
    if(elem) elem.innerHTML = strDisplay;

    this._refresh();
  }

  _setView(data) {
    if (data["lat"] != undefined && data["lng"] != undefined) {
      if (data["lat"] == "") {

        var elem = MA.DOM.find(this._container, ".latlng.value")[0];
        elem.innerHTML = "------";
        elem = MA.DOM.find(this._container, ".dms.value")[0];
        elem.innerHTML = "------";
        elem = MA.DOM.find(this._container, ".zoom.value")[0];
        elem.innerHTML = "------";
      } else {

        var elem = MA.DOM.find(this._container, ".latlng.value")[0];
        elem.innerHTML = data["lat"] + "," + data["lng"];

        elem = MA.DOM.find(this._container, ".dms.value")[0];
        elem.innerHTML = data["dms"]["lat"]["text"] + " " + data["dms"]["lng"]["text"];


        elem = MA.DOM.find(this._container, ".zoom.value")[0];
        elem.innerHTML = data["zoom"];
      }
    }


    if (data["utmPoint"] != undefined) {
      var elem = MA.DOM.find(this._container, ".utmpoint.value")[0];
      if (data["utmPoint"] != "") {
        elem.innerHTML = data["utmPoint"];
      } else {
        elem.innerHTML = "------";
      }
    }

    if (data["elevation"] != undefined) {
      var elem = MA.DOM.find(this._container, ".elevation.value")[0];
      if (data["elevation"] == "") {
        elem.innerHTML = "------";
      } else {
        if ( GSIBV.application.lang == "ja") {
          elem.innerHTML = data["elevation"] + " (データソース" + data["elevationTarget"] + ")";
        } else {
          elem.innerHTML = data["elevation"] + " (Source:" + data["elevationTarget"] + ")";
        }
      }
    }

    if ( data["seamlessphoto"] != undefined ) {
      var elem = MA.DOM.find(this._container, ".seamlessphoto.value")[0];
      // 20211215
      if ( elem ) {
        if (data["seamlessphoto"] == "") {
          elem.innerHTML = "------";
        } else {
          elem.innerHTML = data["seamlessphoto"];
        }
      }

    }

    if (data["addr"] != undefined) {
      var tog = MA.DOM.find(this._containerTable, ".button.addr")[0];
      var elem = MA.DOM.find(this._container, ".addr.value")[0];
      if (this._dispAddrMode == 0){
        tog.innerHTML = "あ";
        elem.innerHTML = data["addr"];
      }
      else{
        tog.innerHTML = "漢";
        if (!data["addrYomi"]){
          elem.innerHTML = "------";
        }
        else{
          elem.innerHTML = data["addrYomi"];
        }
      }
    }

    this._refresh();
  }

  _refresh() {
    var size = MA.DOM.size(MA.DOM.find(this._container, ".context-menu-content")[0]);

    if (MA.DOM.hasClass(this._container, "-ma-expand")) {
      this._container.style.height = size.height + "px";
      var control = MA.DOM.select(".mapboxgl-ctrl-bottom-right")[0];
      control.style.bottom = size.height + "px";
      this.fire( "refresh", {height:size.height, buttonHeight:0});
    } else {
      this._container.style.marginBottom = '-' + size.height + 'px';
      this._container.style.height = size.height + "px";
      
      size = MA.DOM.size(this._toggleButton);
      this.fire( "refresh", {height:0, buttonHeight:size.height});
    }
  }

  set left(left) {
    this._container.style.transition = 'left 300ms';
    this._container.style.left = left + 'px';
    var handler = MA.bind(function (e) {
      this._container.removeEventListener('transitionend', handler);
      this._refresh();
    }, this);
    this._container.addEventListener('transitionend', handler);

  }

  _updateHint() {
    try {
      var HINT = GSIBV.CONFIG.LANG.JA.UI.CONTEXTMENU_HINT;
      if (MA.DOM.hasClass(this._container, "-ma-expand-full")) {
        this._toggleButton.setAttribute("title", HINT["expand-full"] );
      } else if (MA.DOM.hasClass(this._container, "-ma-expand")) {
        this._toggleButton.setAttribute("title", HINT["expand"] );
      } else {
        this._toggleButton.setAttribute("title", HINT["close"] );
      }
    } catch(ex) {}
  }

  _onToggleClick() {
    this._featuresFrame.style.visibility = 'hidden';
    if (!MA.DOM.hasClass(this._container, "-ma-expand")) {
      this.show();
    } else if (!MA.DOM.hasClass(this._container, "-ma-expand-full")) {
      this._featuresFrame.style.visibility = 'visible';
      this.show(true);
    } else {
      this.hide();
    }
  }

  show(full) {
    this._start();

    if ( full ) {
      MA.DOM.addClass(this._container, "-ma-expand-full");

      if ( !GSIBV.CONFIG.MOBILE )　MA.DOM.find( this._container,".controls")[0].style.display = 'block';
      var trList = MA.DOM.find(this._container, "tr.row");
      for( var i=0; i< trList.length; i++) {
        trList[i].style.display = 'block';
        if ( MA.DOM.hasClass(trList[i],"seamlessphoto") && !this.seamlessphotoVisible) {
          trList[i].style.display = 'none';
        } else if(!this._lakeDepthVisible && MA.DOM.hasClass(trList[i],"lakedepth")) {
          trList[i].style.display = 'none';
        }
      }
    } else {
      MA.DOM.removeClass(this._container, "-ma-expand-full");
      MA.DOM.find( this._container,".controls")[0].style.display = 'none';
      var trList = MA.DOM.find(this._container, "tr.row");
      for( var i=0; i< trList.length; i++) {
        if ( MA.DOM.hasClass(trList[i],"elevation"))
          trList[i].style.display = 'block';
        else if ( MA.DOM.hasClass(trList[i],"seamlessphoto") && this.seamlessphotoVisible)
          trList[i].style.display = 'block';
        else {
          trList[i].style.display = 'none';
        }
      }
    }
    
    var size = MA.DOM.size(MA.DOM.find(this._container, ".context-menu-content")[0]);
    this._container.style.marginBottom = '-' + size.height + 'px';
    this._container.style.height = size.height + "px";

    MA.DOM.addClass(this._container, "-ma-expand");
    this._container.style.transition = 'margin-bottom 300ms';
    this._container.style.marginBottom = '0px';

    var handler = MA.bind(function (e) {
      this._container.removeEventListener('transitionend', handler);
    }, this);
    this._container.addEventListener('transitionend', handler);

    this.fire("show", {height:size.height, buttonHeight:0});

    var control = MA.DOM.select(".mapboxgl-ctrl-bottom-right")[0];
    control.style.transition = "bottom 200ms";
    control.style.bottom = size.height + "px";
    this._updateHint();
  }

  hide() {
    this._stop();
    var size = MA.DOM.size(this._container);

    MA.DOM.removeClass(this._container, "-ma-expand-full");

    this._container.style.transition = 'margin-bottom 300ms';
    this._container.style.marginBottom = '-' + size.height + 'px';

    var elem = this._container;
    var handler = function (e) {
      MA.DOM.removeClass(elem, "-ma-expand");
      elem.removeEventListener('transitionend', handler);
    };
    this._container.addEventListener('transitionend', handler);

    MA.DOM.removeClass(this._container, "-ma-expand");

    var buttonSize = MA.DOM.size(this._toggleButton);

    this.fire("hide", {height:0, buttonHeight:buttonSize.height});

    var control = MA.DOM.select(".mapboxgl-ctrl-bottom-right")[0];
    control.style.transition = "bottom 200ms";
    control.style.bottom = 0;
    this._updateHint();
  }

  
  _getFeatures(latLng) {
    if (!this._map) return;
    return GSIBV.Map.getPointFeatures( this._map.map, latLng, 1 );

  }


  _setFeatrues(features) {
    this._featuresFrame.innerHTML = '';
    if (!features || features.length <= 0) {
      this._featuresFrame.style.display = 'none';
      return;
    }
    var frame = MA.DOM.create('div');
    MA.DOM.addClass(frame, "features");

    var ul = MA.DOM.create('ul');

    for (var i = 0; i < features.length; i++) {
      var feature = features[i];
      
      var feature = features[i];
      // 作図
      if ( feature.properties  && feature.properties["-sakuzu-id"]) {
        continue;
      }

      var li = this._makeFeatureRow(feature, frame);

      if (li) ul.appendChild(li);

    }


    frame.appendChild(ul);
    this._featuresFrame.appendChild(frame);


    this._featuresFrame.style.display = '';
    

    try {
      frame._scrollBar = new PerfectScrollbar(frame);
    } catch (e) { }
  }

  _makeFeatureRow(feature, frame) {
    
    var lang = GSIBV.application.lang;
    var contextMenuLang = GSIBV.CONFIG.LANG[lang.toUpperCase()].UI.CONTEXTMENU;
    var vectortileLang = GSIBV.CONFIG.LANG[lang.toUpperCase()].VECTORTILE;


    var li = MA.DOM.create('li');
    var a = MA.DOM.create('a');
    MA.DOM.addClass(a, "list-item");
    a.setAttribute('href', 'javascript:void(0);');
    var title = '[unknown]';

    var button = MA.DOM.create('a');
    if ( GSIBV.CONFIG.ReadOnly ) {
      button.style.display = 'none';
    }
    MA.DOM.addClass(button, "layer-button");
    MA.DOM.addClass(button, "button");
    button.setAttribute('href', 'javascript:void(0);');
    button.innerHTML = contextMenuLang["edit"];

    MA.DOM.on(button, "click", MA.bind(this._shwoLayerInfoView, this, button, feature));

    if (feature.layer.metadata && feature.layer.metadata.title) {

      title = feature.layer.metadata.path ;
      if ( lang != "ja")  {
        var pathParts = feature.layer.metadata.path.split("-");
        for( var i=0; i<pathParts.length; i++) {
          pathParts[i] = vectortileLang[pathParts[i]];
        }
        title = pathParts.join("-");
      }
    } else {
      return undefined;
    }
    a.innerHTML = title;
    li.appendChild(a);
    li.appendChild(button);


    
    var lang = GSIBV.application.lang;
    var propLang = undefined;
    
    try {
      propLang = GSIBV.CONFIG.LANG[lang.toUpperCase()].UI.CONTEXTMENU_PROPNAME;
    } catch(ex ) {}


    var div = MA.DOM.create('div');
    MA.DOM.addClass(div, "description");
    div.style.display = 'none';
    if (feature.properties) {
      var table = MA.DOM.create('table');
      var properties = feature.properties;
      for (var key in properties) {
        if ( GSIBV.CONFIG.ComtextMenuProps && GSIBV.CONFIG.ComtextMenuProps.indexOf(key) < 0 ) continue;
        var tr = MA.DOM.create('tr');
        var th = MA.DOM.create('th');
        var name = key;
        if ( propLang && propLang[key]) {
          name = propLang[key];
        }
        th.innerHTML = name;
        var td = MA.DOM.create('td');
        var value = properties[key];
        if ( GSIBV.CONFIG.ComtextMenuValues 
          && GSIBV.CONFIG.ComtextMenuValues[key] && GSIBV.CONFIG.ComtextMenuValues[key][value])
          value = GSIBV.CONFIG.ComtextMenuValues[key][value];
        td.innerHTML = value;

        tr.appendChild(th);
        tr.appendChild(td);
        table.appendChild(tr);
      }

      div.appendChild(table);
    }
    li.appendChild(div);


    MA.DOM.on(a, "click", MA.bind(function (a, div, frame) {
      if (MA.DOM.hasClass(a, "-ma-expand")) {
        MA.DOM.removeClass(a, "-ma-expand");


        var elem = div;
        var handler = function (e) {
          elem.style.display = 'none';
          elem.removeEventListener('transitionend', handler);
          if (frame._scrollBar) frame._scrollBar.update();

        };
        div.addEventListener('transitionend', handler);

        MA.DOM.removeClass(div, "-ma-expand");

      } else {
        MA.DOM.addClass(a, "-ma-expand");
        div.style.display = '';
        MA.DOM.addClass(div, "-ma-expand");
        frame._scrollBar.update();

      }

    }, this, a, div, frame));

    return li;

  }
  _hideLayerInfoView() {

    MA.DOM.removeClass(this._layerInfoView, "visible");
    MA.DOM.fadeOut(this._layerInfoView, 300);
    if (this._layerInfoViewBodyClickHandler) {
      MA.DOM.off(document.body, "mousedown", this._layerInfoViewBodyClickHandler);
      this._layerInfoViewBodyClickHandler = null;
    }
  }
  _shwoLayerInfoView(button, feature) {
    //alert("調整中（対象の編集画面を開く予定）");
    var layerId = feature["layer"]["metadata"]["layer-id"];

    this._map.fire("requestlayeredit", {"layer-id" : layerId});

  }
}
