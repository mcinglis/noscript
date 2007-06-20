/***** BEGIN LICENSE BLOCK *****

NoScript - a Firefox extension for whitelist driven safe JavaScript execution
Copyright (C) 2004-2007 Giorgio Maone - g.maone@informaction.com

Contributors: 
  Higmmer

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA

***** END LICENSE BLOCK *****/

const noscriptOverlay = {
  ns: noscriptUtil.service,

  getString: function(key,parms) {
    return noscriptUtil.getString(key, parms);
  }
,
  toggleCurrentPage: function(force) {
    const ns = this.ns;
    var level = ns.getPref("toolbarToggle", 3) || force;
    if(!level) return false;
    
    const url = ns.getQuickSite(this.srcDocument.documentURI, level);
    
    this.safeAllow(url, !ns.isJSEnabled(url), ns.getPref("toggle.temp"));
    return true;
  },
  
  isLoading: function() {   
    return getBrowser().selectedBrowser.webProgress.isLoadingDocument;
  },
  
  get currentPluginsCache() {
    return this.ns.pluginsCache.get(getBrowser().selectedBrowser);
  },

  
  getSites: function() {
    return this.ns.getSites(gBrowser.selectedBrowser);
  },
  
  
  
  fixLink: function(ev) { // TODO: cleanup this obsolete lookupmethod mess
    const ns = noscriptOverlay.ns;
   
    if(ns.jsEnabled) return;
    
    var fixLinks  = ns.getPref("fixLinks", true);
    if(!fixLinks) return;
    
    var noping = ns.getPref("noping", true);
    if(!noping)  return;
    
    const lm = ns.lookupMethod;
    var a = ev.originalTarget;
    
    var doc = lm(a, "ownerDocument")();
    if(!doc) return;
    
    var url = lm(doc, "documentURI")();
    if((!url) || ns.isJSEnabled(ns.getSite(url))) return;
    
    
    while(!(a instanceof HTMLAnchorElement || a instanceof HTMLMapElement)) {
      if(!(a = lm(a, "parentNode")())) return;
    }
    
    const getAttr = lm(a, "getAttribute");
    const setAttr = lm(a, "setAttribute");
    
    const href = getAttr("href");
    
    if(noping) {
      var ping = getAttr("ping");
      if(ping) {
        lm(a, "removeAttribute")("ping");
        setAttr("noping", ping);
      }
    }
    
    if(fixLinks) {
      var jsURL;
      if(href) {
        jsURL = href.toLowerCase().indexOf("javascript:") == 0;
        if(!(jsURL || href == "#")) return;
      } else {
        jsURL = false;
      }
      
      var onclick = getAttr("onclick");
      var fixedHref = fixedHref = (onclick && noscriptOverlay.extractLink(onclick)) || 
                       (jsURL && noscriptOverlay.extractLink(href)) || "";
      
      if(fixedHref) {
        setAttr("href", fixedHref);
        var title = getAttr("title");
        setAttr("title", title ? "[js] " + title : 
          (onclick || "") + " " + href
          );
      }
    }
  },
  extractLink: function(js) {
    var match = js.match(/['"]([\/\w-\?\.#%=&:@]+)/);
    return match && match[1];
  },
  
  get prompter() {
    return noscriptUtil.prompter;
  }
,
  uninstallAlert: function() {
    this.prompter.alert(window,this.getString("uninstall.alert.title"),
          this.getString("uninstall.alert.text",
            [this.getString("allowed." + (this.ns.jsEnabled ? "glb" : "no")) ]
            ));
  }
,
  prepareContextMenu: function(ev) {
    var menu = document.getElementById("noscript-context-menu");
    if(this.ns.uninstalling || !this.ns.getPref("ctxMenu", true)) {
      menu.setAttribute("hidden", true);
      return;
    }
    menu.removeAttribute("hidden");
    const status = document.getElementById("noscript-statusIcon");
    menu.setAttribute("image",status.getAttribute("src"));
    menu.setAttribute("tooltiptext", status.getAttribute("tooltiptext"));
  }
,
  toggleMenuOpt: function(node) {
    var val=node.getAttribute("checked")=="true";
    var k=node.id.lastIndexOf("-opt-");
    if(k>-1) {
      this.ns.setPref(node.id.substring(5+k),val);
    }
    return val;
  }
,

  prepareOptItems: function(popup) {
    const notifications = this.getNotificationBox();
    const opts = popup.getElementsByAttribute("type", "checkbox");
    var k, j, node, id;
    for(j = opts.length; j-- > 0;) {
      node = opts[j];
      var id = node.id;
      if((k = id.lastIndexOf("-opt-")) > -1) {
        if((!notifications) && id.indexOf("notification") - 1) {
          node.setAttribute("hidden", "true");
        } else {
          node.setAttribute("checked", this.ns.getPref(node.id.substring(5 + k)));
        }
      }
    }
  },
  
  
  prepareXssMenu: function(popup, invert) {
    this.prepareOptItems(this.populateXssMenu(popup, invert));
  },
  populateXssMenu: function(popup, invert) {
    var ref = document.getElementById("noscript-mi-xss-unsafe-reload");
    var parent = ref.parentNode;
    var inverse = parent.lastChild.id != "noscript-mi-xss-faq";
    invert = inverse && !invert;
    if(parent != popup) {
      while(parent.firstChild) {
        popup.appendChild(invert ? parent.lastChild : parent.firstChild);
      }
    } else if(invert) {
      for(var p, n = parent.lastChild; n; n = p) {
        p = n.previousSibling;
        parent.appendChild(n);
      }
    }
    
    return popup;
  },
  
  prepareMenu: function(popup) {
    const ns = this.ns;

    var j, k, node;
    
    const global = ns.jsEnabled;
    
    var allSeps = popup.getElementsByTagName("menuseparator");
   
    var seps = { insert: null, stop: null, global: null, untrusted: null };
    var sepName;
    for(j = allSeps.length; j-- > 0;) {
      sepName = (node = allSeps[j]).className;
      node.hidden = false;
      for(k in seps) {
        if(sepName.indexOf("-" + k) > -1) {
          seps[k] = node;
        }
      }
    }
    
    delete allSeps;

    const miGlobal = seps.global.nextSibling;
    
    if(global || ns.getPref("showGlobal")) {
      miGlobal.style.display = "";
      seps.global.style.display = "";
      miGlobal.setAttribute("label",this.getString((global ? "forbid" : "allow") + "Global"));
      miGlobal.setAttribute("oncommand","noscriptOverlay.menuAllow("+(!global)+")");
      miGlobal.setAttribute("tooltiptext", document.getElementById("noscript-statusIcon").getAttribute("tooltiptext"));
      miGlobal.setAttribute("image", this.getIcon(global ? "no" : "glb"));
      
      
    } else {
      miGlobal.style.display = "none";
      seps.global.style.display = "none";
    }
    
    node = miGlobal.nextSibling;
    const mainMenu = node.parentNode;
     
    var xssMenu = document.getElementById("noscript-xss-menu");
    
    if(xssMenu && node != xssMenu) {
      mainMenu.insertBefore(xssMenu, node);
    }
    this.populateXssMenu(xssMenu.firstChild);
    this.syncXssWidget(xssMenu);
    

    this.prepareOptItems(popup);
      
    var untrustedMenu = null;
    if(seps.untrusted) {
      node = document.getElementById("noscript-menu-untrusted");
      if(seps.untrusted.nextSibling != node) {
        seps.untrusted.parentNode.insertBefore(node, seps.untrusted.nextSibling);
      }
      
      untrustedMenu = node.firstChild;
      while(untrustedMenu.firstChild) {
        untrustedMenu.removeChild(untrustedMenu.firstChild);
      }
      untrustedMenu.appendCmd = untrustedMenu.appendChild;
      untrustedMenu.parentNode.setAttribute("image", this.getIcon("no", true));
    }
    
    node = seps.insert.nextSibling;
    
    var remNode;
    while(node && (node != seps.stop)) {
       remNode = node;
       node = node.nextSibling;
       if(remNode != untrustedMenu && remNode != xssMenu)
         mainMenu.removeChild(remNode);
    }

    mainMenu.appendCmd = function(n) { this.insertBefore(n, seps.stop); };

    const sites = this.getSites();
    var site, enabled, isTop, lev;
    var jsPSs = ns.jsPolicySites;
    var matchingSite;
    var menuSites, menuSite, scount;
    var domain, pos, lastPos, dp;
    var untrusted;
    var cssClass;
    
    
    var domainDupChecker = {
      domains: {},
      check: function(d) {
        return this.domains[d] || !(this.domains[d] = true);
      }
    };
    
    const showAddress = ns.getPref("showAddress", false);
    const showDomain = ns.getPref("showDomain", false);
    const showBase = ns.getPref("showBaseDomain", true);
    const showUntrusted = ns.getPref("showUntrusted", true);
    const showDistrust = ns.getPref("showDistrust", true);
    const showNothing = !(showAddress || showDomain || showBase || showUntrust);
    
    const showPermanent = ns.getPref("showPermanent", true);
    const showTemp = ns.getPref("showTemp", true);
    
    var parent, extraNode;
    for(j = sites.length; j-->0;) {
      site = sites[j];
      
      matchingSite = jsPSs.matches(site);
      enabled = !!matchingSite;
      isTop = site == sites.topURL;
      
      if(enabled) {
        if(domainDupChecker.check(matchingSite)) continue;
        menuSites = [matchingSite];
      } else {
        domain = ns.getDomain(site);
        menuSites = (showAddress || showNothing || !domain) ? [site] : [];
        if(domain && (showDomain || showBase)) {

          if(!(lastPos = ns.getTLDPos(domain))) {
            // IP or TLD or 2nd level domain
            if(!domainDupChecker.check(domain)) {
              menuSites[menuSites.length] = domain;
            }
          } else {
            dp = domain;
            for(pos = 0; (pos = domain.indexOf('.', pos)) > 0; dp = domain.substring(++pos)) {
              if(pos == lastPos) {
                if(menuSites.length > 0 && !showBase) continue;
              } else {
                if(!showDomain) continue;
              }
              if(!domainDupChecker.check(dp)) {
                menuSites[menuSites.length] = dp;
                if(pos == lastPos) break;
              }
            }
          }
        }
      }
      
      if(seps.stop.previousSibling.nodeName != "menuseparator") {
        mainMenu.appendCmd(document.createElement("menuseparator"));
      }
      
 
   
      for(scount = menuSites.length; scount-- > 0;) {
        menuSite = menuSites[scount];
        
        untrusted = (!enabled) && ns.isUntrusted(menuSite);
        parent = (untrusted && showUntrusted) ? untrustedMenu : mainMenu;
        if(!parent) continue;
        
        node = document.createElement("menuitem");
        cssClass = isTop ? "noscript-toplevel noscript-cmd" : "noscript-cmd";
        node.setAttribute("label", this.getString((enabled ? "forbidLocal" : "allowLocal"), [menuSite]));
        node.setAttribute("statustext", menuSite);
        node.setAttribute("oncommand", "noscriptOverlay.menuAllow(" + (!enabled) + ",this)");
        node.setAttribute("tooltiptext",
          this.getString("allowed." + (enabled ? "yes" : "no")));
        if(enabled && ns.isPermanent(menuSite)) {
          node.setAttribute("disabled", "true");
        } else {
          cssClass += " menuitem-iconic";
          node.setAttribute("image", this.getIcon(enabled ? "no" : "yes"));
          if(enabled && ns.isTemp(menuSite)) cssClass += " noscript-temp";
        }
        node.setAttribute("class", cssClass + (enabled ? " noscript-forbid" : " noscript-allow"));
        
        if(showPermanent || enabled) 
          parent.appendCmd(node);
        
        if(!enabled) {
          if(showTemp) {
            extraNode = document.createElement("menuitem");
            extraNode.setAttribute("label", this.getString("allowTemp", [menuSite]));
            extraNode.setAttribute("image", node.getAttribute("image"));
            extraNode.setAttribute("statustext", menuSite);
            extraNode.setAttribute("oncommand", "noscriptOverlay.menuAllow(true,this,true)");
            extraNode.setAttribute("class", cssClass + " noscript-temp noscript-allow");
            extraNode.setAttribute("tooltiptext", node.getAttribute("tooltiptext"));
            parent.appendCmd(extraNode);
          }
          if(((showUntrusted && untrustedMenu) || showDistrust) && !untrusted) {
            extraNode = document.createElement("menuitem");
            extraNode.setAttribute("label", this.getString("distrust", [menuSite]));
            extraNode.setAttribute("image", this.getIcon("no", true));
            extraNode.setAttribute("statustext", menuSite);
            extraNode.setAttribute("class", cssClass + " noscript-distrust");
            extraNode.setAttribute("oncommand", "noscriptOverlay.menuAllow(false, this, false)");
            extraNode.setAttribute("tooltiptext", node.getAttribute("tooltiptext"));
            (showUntrusted ? untrustedMenu : mainMenu).appendCmd(extraNode);
          }
        }
      }
      if(untrustedMenu && untrustedMenu.firstChild) {
        untrustedMenu.appendCmd(document.createElement("menuseparator"));
      }
    }
    this.normalizeMenu(untrustedMenu, true);
    this.normalizeMenu(mainMenu, false);
    
    if(mainMenu.id == "noscript-tbb-popup") { 
      // this one can go away, better take our stuff back when done
      mainMenu.addEventListener("popuphidden", function(ev) {
        if(ev.target != ev.currentTarget) return;
        ev.currentTarget.removeEventListener(ev.name, arguments.callee, false);
        noscriptOverlay.prepareMenu(document.getElementById("noscript-status-popup"));
      }, false);
    }
    
  },
  
  normalizeMenu: function(menu, hideParentIfEmpty) {
    if(!menu) return;
    var prev = null;
    var wasSep = false;
    var isSep, haveMenu = false;
    for(var i = menu.firstChild; i; i = i.nextSibling) {
      if(!i.hidden) {
        isSep = i.nodeName == "menuseparator";
        if(isSep && (wasSep || !prev)) {
          i.hidden = true;
        } else {
          prev = i;
          wasSep = isSep;
          haveMenu = haveMenu || !isSep;
        }
      }
    }
    
    if(prev && wasSep) {
      prev.hidden = true;
    }
    if(hideParentIfEmpty && menu.parentNode) {
      menu.parentNode.hidden = !haveMenu;
    }
  }
,
  get srcWindow() {
    return window.content;
  }
,
  get srcDocument() {
    return window.content.document;
  }
,
  getBrowserDoc: function(browser) {
    return browser && browser.contentWindow && browser.contentWindow.document || null;
  }
,
  menuAllow: function(enabled, menuItem, temp) {
    var site = null;
    if(menuItem) { // local 
      site = menuItem.getAttribute("statustext");
      if(!site) return;
      if(menuItem.getAttribute("class").indexOf("-distrust") > -1) {
        this.ns.setUntrusted(site, true);
      }
    } else { // global
      if(enabled && this.ns.getPref("globalwarning", true) &&
          !this.prompter.confirm(window, this.getString("global.warning.title"),
                                this.getString("global.warning.text"))
         ) return;
    }
    this.safeAllow(site, enabled, temp);
  }
,
  safeAllow: function(site, enabled, temp) {
    const overlay = this;
    const ns = this.ns;
    ns.safeCapsOp(function() {
      if(site) {
        ns.setTemp(site, enabled && temp);
        ns.setJSEnabled(site, enabled);
      } else {
        ns.jsEnabled = enabled;
      }
      overlay.syncUI();
    });
  }
,
  _iconURL: null,
  getIcon: function(lev, inactive) {
    if(!this._iconURL) this._iconURL=document.getElementById("noscript-statusIcon").src;
    return this._iconURL.replace(/[^\/]*(yes|no|glb|prt)(\d+\.)/,(inactive ? "inactive-" : "") + lev + "$2");
  }
,
  _syncTimeout: null,
  syncUI: function(w) {
    if(w) {
      if(w != window.content) return;
    } else {
      w = window.content;
    }
    
    if(this._syncTimeout) {
      window.clearTimeout(this._syncTimeout);
    }
    this._syncTimeout = window.setTimeout(function() {
      if(w != window.content) return;
      noscriptOverlay._syncUINow();
    }, 400);
  },
  
  syncXssWidget: function(widget) {
    if(!widget) widget = document.getElementById("noscript-statusXss");
    const ns = this.ns;
    var unsafeRequest = ns.requestWatchdog.getUnsafeRequest(gBrowser.selectedBrowser);
    if(unsafeRequest) {
      widget.removeAttribute("hidden");
      widget.setAttribute("tooltiptext", "XSS [" +
                  ns.getSite(unsafeRequest.origin) + "]->[" + 
                  ns.getSite(unsafeRequest.URI.spec) + "]");
    } else {
      widget.setAttribute("hidden", "true");
    }
  },
  
  syncRedirectWidget: function() {
    var widget = document.getElementById("noscript-statusRedirect");
    var info = this.getMetaRefreshInfo();
    if(!info) {
      widget.setAttribute("hidden", true);
      return;
    }
    widget.removeAttribute("hidden");
    widget.setAttribute("tooltiptext",
        this.getString("metaRefresh.notify.follow") + " [" + info.uri + "]"); 
  },
  
  showUI: function() {
    var statusIcon = document.getElementById("noscript-statusIcon");
    var popup = document.getElementById("noscript-status-popup");
    if(statusIcon.hidden || statusIcon.parentNode.hidden) {
      var tbb = document.getElementById("noscript-tbb");
      if(tbb) {
        tbb.open = true;
        return;
      }
      if(statusIcon.parentNode.hidden) {
        window.setTimeout(function() {
          var popup = document.getElementById("noscript-notify-popup");
          var ref = document.getElementById("appcontent");
          popup.showPopup(ref, ref.boxObject.screenX, ref.boxObject.screenY);
        }, 0);
        return;
      } else {
        popup.addEventListener("popuphidden", function(ev) {
            if(ev.currentTarget != ev.target) return;
            ev.target.removeEventListener("popuphidden", arguments.callee, false);
            ev.target.parentNode.hidden = !noscriptOverlay.ns.getPref("statusIcon", true);
        }, false);
        statusIcon.hidden = false;
      }
    }
    popup.showPopup();
  }
,
  get notificationPos() {
    return this.ns.getPref("notify.bottom", false) ? "bottom" : "top";
  },
  get altNotificationPos() {
    return this.notificationPos == "top" ? "bottom" : "top";
  }
, 
  getNotificationBox: function(pos, browser) {
    var gb = getBrowser();
    browser = browser || gb.selectedBrowser;
    if(!pos) pos = this.notificationPos
    
    if(gb.getMessageForBrowser) return gb.getMessageForBrowser(browser, pos); // Fx <= 1.5 
    if(!gb.getNotificationBox) return null; // SeaMonkey

    var nb = gb.getNotificationBox(browser);
    gb = browser = null;
    
    if(pos == "bottom") {
      if(!nb._bottomStack) {
        var stacks =  nb.getElementsByTagName("stack");
        var stack = null;
        for(var j = stacks.length; j-- > 0;) {
          if(stacks[j].getAttribute("class") ==  "noscript-bottom-notify") {
            stack = stacks[j];
            break;
          }
        }
        if(!stack) {
         stack = nb.ownerDocument.createElement("stack");
         stack.setAttribute("class", "noscript-bottom-notify");
         nb.appendChild(stack);
        }
        nb._bottomStack = stack;
        nb._dom_removeChild = nb.removeChild;
        nb.removeChild = function(n) {
          return (n.parentNode == this) ? this._dom_removeChild(n) : n.parentNode.removeChild(n); 
        }
        nb._dom_insertBefore = nb.insertBefore;
        nb.insertBefore = function(n, ref) {
          if(n.localName == "notification" && n.getAttribute("value") == "noscript"
            && noscriptOverlay.notificationPos == "bottom") {
            while(this._bottomStack.firstChild) this._bottomStack.removeChild(this._bottomStack.firstChild);
            this._bottomStack.appendChild(n);
            var hbox = n.ownerDocument.getAnonymousElementByAttribute(n, "class", "notification-inner outset");
            if(hbox) {
              var style = hbox.ownerDocument.defaultView.getComputedStyle(hbox, null);
              var borderProps = ['color', 'style', 'width'];
              var cssProp, jsProp, tmpVal;
              for(var p = borderProps.length; p-- > 0;) {
                cssProp = borderProps[p];
                jsProp = cssProp[0].toUpperCase() + cssProp.substring(1);
                tmpVal = style.getPropertyValue("border-bottom-" + cssProp);
                hbox.style["borderBottom" + jsProp] = style.getPropertyValue("border-top-" + cssProp);
                hbox.style["borderTop" + jsProp] = tmpVal;
              }
            }
            return n;
          }
          return this._dom_insertBefore(n, ref);
        }
      }
    }
   
    return nb;
  },
  getNsNotification: function(widget) {
    if(widget == null) return null;
    if(widget.localName == "notificationbox") return widget.getNotificationWithValue("noscript");
    return this.isNsNotification(widget) && widget || null;
  },
  isNsNotification: function(widget) {
    return widget && widget.getAttribute("value") == "noscript" || widget.popup == "noscript-notify-popup";
  },
  
  
  notificationShow: function(label, icon, canAppend) {
    var box = this.getNotificationBox();
    if(box == null) return false;
    var pos = this.notificationPos;
    
    const gb = getBrowser();
    const browser = gb.selectedBrowser;
    
    var widget = this.getNsNotification(box);
    if(widget) {
     if(widget.localName == "notification") {
       widget.label = label;
       widget.image = icon;
     } else {
       widget.text = label;
       widget.image = icon;
       if(canAppend) widget.removeAttribute("hidden");
     }
    
    } else {
     
      if(!canAppend) return false;
     
      var buttonLabel, buttonAccesskey;
      if(gb.getNotificationBox || /\baButtonAccesskey\b/i.test(gb.showMessage.toSource())) {
        const refWidget = document.getElementById("noscript-options-ctx-menuitem");
        buttonLabel = refWidget.getAttribute("label");
        buttonAccesskey = refWidget.getAttribute("accesskey");
      } else { // Fx < 1.5
        buttonLabel = "";
        buttonAccesskey = "";
      }
      const popup = "noscript-notify-popup";
      if(box.appendNotification) { // >= Fx 2.0
        widget =  box.appendNotification(label, "noscript", icon, box.PRIORITY_WARNING_MEDIUM,
                  [ {label: buttonLabel, accessKey: buttonAccesskey,  popup: popup } ]);
        
      } else if(gb.showMessage) { // Fx <= 1.5.x
        gb.showMessage(browser, icon, label, 
              buttonLabel, null,
              null, popup, pos, true,
              buttonAccesskey);
        widget = this.getNsNotification(box);
      }
     
    }
    if(!widget) return;
    
    const delay = (this.ns.getPref("notify.hide") && this.ns.getPref("notify.hideDelay", 5)) || 0;
    if(delay) {
     if(this.notifyHideTimeout) window.clearTimeout(this.notifyHideTimeout);
     this.notifyHideTimeout = window.setTimeout(
       function() {
         if(browser == gb.selectedBrowser) {
           noscriptOverlay.notificationHide(browser);
         }
       },
       1000 * delay);
    }
    return true;
  },
  
  getAltNotificationBox: function(browser, value, canAppend) {
    const box = this.getNotificationBox(this.altNotificationPos, browser);
    if(canAppend || (box && 
        box.getNotificationWithValue &&
        box.getNotificationWithValue(value))) return null;
    return box;
  },
  
  notifyXSSOnLoad: function(requestInfo) {
    requestInfo.browser.addEventListener("load", function(ev) {
      requestInfo.browser.removeEventListener("load", arguments.callee, true);
      noscriptOverlay.notifyXSS(requestInfo);
    }, true);
  },
  
  notifyXSS: function(requestInfo) {
    const notificationValue = "noscript-xss-notification"; 
    const box = this.getAltNotificationBox(requestInfo.browser, notificationValue);
    if(!box) return;

    var origin = this.ns.getSite(requestInfo.origin);
    origin = (origin && "[" + origin + "]") || this.getString("untrustedOrigin");
    var label = this.getString("xss.notify.generic", [origin]);
    var icon = this.getIcon("xss");
    
    const refWidget = document.getElementById("noscript-options-ctx-menuitem");
    var buttonLabel = refWidget.getAttribute("label");
    var buttonAccesskey = refWidget.getAttribute("accesskey");
    var popup = "noscript-xss-popup";
    
    const tabBrowser = getBrowser();
    if(tabBrowser.showMessage) { // Fx 1.5
      tabBrowser.showMessage(
          requestInfo.browser, 
          icon, label, 
          buttonLabel, null,
          null, popup, this.altNotificationPos, true,
          buttonAccesskey);
    } else { // Fx >= 2.0
      box.appendNotification(
        label, 
        notificationValue, 
        icon, 
        box.PRIORITY_WARNING_HIGH,
        [{
          label: buttonLabel,
          accessKey: buttonAccesskey,
          popup: popup
         }]
        );
    }
  },
  
  notifyMetaRefresh: function(info) {
    var browser = this.ns.domUtils.findBrowser(window, info.document.defaultView);
    if(!browser) return;
    
    const notificationValue = "noscript-metaRefresh-notification";
    const box = this.getAltNotificationBox(browser, notificationValue);
    var notification = null;
    
    if(box && this.ns.getPref("forbidMetaRefresh.notify", true)) {
      var label = this.getString("metaRefresh.notify", [info.uri, info.timeout])
      var icon = this.getIcon("redirect");
        
      if(box.appendNotification) { // Fx 2
      
        notification = box.appendNotification(
          label, 
          notificationValue, 
          icon, 
          box.PRIORITY_INFO_HIGH,
          [{
              label: this.getString("metaRefresh.notify.follow"),
              accessKey: this.getString("metaRefresh.notify.follow.accessKey"),
              callback: function(notification, buttonInfo) {
                noscriptOverlay.ns.doFollowMetaRefresh(info);
              }
           }]
          );
      }
      browser.addEventListener("beforeunload", function(ev) {
        if(ev.originalTarget == info.document || ev.originalTarget == browser) {
          browser.removeEventListener("beforeunload", arguments.callee, false);
          if(notification && notification == box.currentNotification) {
            box.removeCurrentNotification();
          } else {
            noscriptOverlay.ns.doBlockMetaRefresh(info);
          }
        }
      }, false);
    }
    
    this.setMetaRefreshInfo(info, browser);
  },
  
  setMetaRefreshInfo: function(value, browser) {
    return this.ns.setExpando(browser || gBrowser.selectedBrowser, "metaRefreshInfo", value);
  },
  getMetaRefreshInfo: function(browser) {
    return this.ns.getExpando(browser || gBrowser.selectedBrowser, "metaRefreshInfo");
  },
  followMetaRefresh: function(event) {
    this.ns.doFollowMetaRefresh(this.getMetaRefreshInfo(), event.shiftKey);
  },
  
  unsafeReload: function() {
    const browser = gBrowser.selectedBrowser;
    const ns = this.ns;
    const rw = ns.requestWatchdog;
    var req = rw.getUnsafeRequest(browser);
    var method;
    if(!req) {
      req = {
        URI: browser.webNavigation.currentURI,
        origin: rw.traceBackHistory(browser.webNavigation.sessionHistory, browser.contentWindow).join("@@@"),
      };
      method = "URL";
    } else {
      method = (req.postData ? "POST" : "GET");
    }
    var msg = noscriptUtil.getString("unsafeReload.warning",
      [ method, 
        ns.siteUtils.crop(req.URI.spec), 
        ns.siteUtils.crop(req.origin || req.referrer && req.referrer.spec || '?')
      ]);
    msg += noscriptUtil.getString("confirm");
    if(noscriptUtil.confirm(msg, "confirmUnsafeReload")) {
      try {
        getBrowser().getNotificationBox(browser).removeAllNotifications(true);
      } catch(e) {}
      rw.unsafeReload(browser, true);
    }
  },
  
  notificationHide: function(browser, immediate) { // Modified by Higmmer
    var box = this.getNotificationBox(null, browser);
    var widget = this.getNsNotification(box); // Modified by Higmmer
    if(widget) {
      if(widget.parentNode) {
        box = widget.parentNode.parentNode;
        if(box && box.removeNotification) {
          if(immediate && box.currentNotification == widget) {
            box.currentNotification = null;
          }
          box.removeNotification(widget);
        } else if(widget.close) {
          widget.close();
        } else {
          widget.setAttribute("hidden", "true");
        }
      }
      return true;
    }
    return false;
  }
,
  _disablePopup: function(id) {
    const popup=document.getElementById(id);
    if(popup) {
      popup.parentNode.setAttribute("onclick","noscriptOverlay.uninstallAlert()");
      popup.parentNode.removeChild(popup);
    }
  }
,
  uninstallCheck: function() {
    const ns = this.ns;
    if(ns.uninstalling) {
      if(!ns.uninstallAlerted) {
        window.setTimeout(function() { noscriptOverlay.uninstallAlert(); }, 10);
        ns.uninstallAlerted = true;
      }
      this._disablePopup("noscript-status-popup");
      this._disablePopup("noscript-tbb-popup");
    }
  },
  
  _syncUINow: function() {
    
    const ns = this.ns;
    const global = ns.jsEnabled;
    const jsPSs = ns.jsPolicySites;
    const untrustedSites = ns.untrustedSites;
    var lev;
    
    this.syncXssWidget();
    this.syncRedirectWidget();
    
    const sites = this.getSites();
    var totalScripts = sites.scriptCount;
    var totalPlugins = sites.pluginCount;
    var totalAnnoyances = totalScripts + totalPlugins;
    var notificationNeeded = false;
    if(global) {
      lev = "glb";
    } else {
      var allowed = 0;
      var s = sites.length;
      var total = s;
      var url, site;
      while(s-- > 0) {
        url = sites[s];
        site = jsPSs.matches(url);
        if(site) {
          if(ns.isPermanent(site)) {
            total--;
          } else {
            allowed++;
          }
        } else {
          notificationNeeded = notificationNeeded || url != "about:blank" && !untrustedSites.matches(url);
        }
      }
      lev = (allowed == total && sites.length > 0) ? "yes" : allowed == 0 ? "no" : "prt";
      notificationNeeded = notificationNeeded && totalAnnoyances > 0;
    }
    
    var message = this.getString("allowed." + lev)
        + " [<SCRIPT>: " + totalScripts + "] [<OBJECT> ";
    var shortMessage = message.replace(/JavaScript/g, "JS") + ": " + totalPlugins + "]";
    message += "(Java, Flash, Plugin): " + totalPlugins + "]";
    
    var icon = this.getIcon(lev, !totalAnnoyances);
    
    var widget = document.getElementById("noscript-tbb");
    if(widget) {
      widget.setAttribute("tooltiptext", shortMessage);
      widget.setAttribute("image", icon);  
    }
    
    widget = document.getElementById("noscript-statusIcon");
    widget.setAttribute("tooltiptext", shortMessage);
    widget.setAttribute("src", icon);

    if(notificationNeeded) { // notifications
      const doc = this.srcDocument;
      if(ns.getPref("notify", false)) { 
        this.notificationShow(message, icon, this.checkDocFlag(doc, "_noscript_message_shown"));
      } else {
        this.notificationHide(); 
      }
      if(this.checkDocFlag(doc, "_noscript_sound_played")) {
        ns.playSound(ns.getPref("sound.block"));
      }
    } else {
      this.notificationHide();
      message = shortMessage = "";
    }
    
    widget = document.getElementById("noscript-statusLabelValue");
    widget.setAttribute("value", shortMessage);
    widget.parentNode.style.display = message ? "block" : "none";
  }
,
  notifyHideTimeout: 0
,
  docFlag: {},
  checkDocFlag: function(doc, flag) {
    if(flag in doc && doc[flag] == noscriptOverlay.docFlag) return false;
    doc[flag] = noscriptOverlay.docFlag;
    return true;
  },
  clearDocFlag: function(doc, flag) {
    doc[flag] = null;
  },
  
  
  
  
  prefsObserver: {
    ns: noscriptUtil.service,
    iids: [Components.interfaces.nsISupports, Components.interfaces.nsIObserver],
    QueryInterface: function(iid) {
      return this.ns.queryInterfaceSupport(iid, this.iids);
    }
  ,
    observe: function(subject, topic, data) {
      if(subject == this.ns.caps) {
         noscriptOverlay.syncUI();
         return;
      }
      switch(data) {
        case "statusIcon": case "statusLabel":
        window.setTimeout(function() {
            var widget=document.getElementById("noscript-" + data);
            if(widget) {
              widget.setAttribute("hidden", !noscriptOverlay.ns.getPref(data))
            }
          }, 0);
         break;
         case "notify":
         case "notify.bottom" : 
           noscriptOverlay.notificationHide();
         break;
         case "keys.ui":
         case "keys.toggle":
           noscriptOverlay.shortcutKeys.setup(data.replace(/^keys\./, ""), this.ns.getPref(data, ""));
           break;
         break;
      }
    },
    register: function() {
      this.ns.prefs.addObserver("", this, false);
      this.ns.caps.addObserver("", this, false);
      const initPrefs = ["statusIcon", "statusLabel", "keys.ui", "keys.toggle"];
      for(var j = 0; j < initPrefs.length; j++) {
        this.observe(null, null, initPrefs[j]);
      }
    },
    remove: function() {
      this.ns.prefs.removeObserver("", this);
      this.ns.caps.removeObserver("", this, false);
    }
  },
  
  
  
  
  
  shortcutKeys: {
    
    execute: function(cmd) {
      switch(cmd) {
        case 'toggle':
          noscriptOverlay.toggleCurrentPage(3);
          break;
        case 'ui':
           noscriptOverlay.showUI();
           break;
      }
    },
    
    keys: {},
    setup: function(name, values) { 
      values = values.toLowerCase().replace(/^\s*(.*?)\s*$/g, "$1").split(/\s+/);
      var vpos = values.length;
      if(vpos) {
        
        var mods = { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false };
        
        var keyVal = values[--vpos];
        for(var value; vpos-- > 0;) {
          value = values[vpos] + "Key";
          if(value in mods) {
            mods[value] = true;
          }
        }
        
        var key = { modifiers: mods, charCode: 0, keyCode: 0 };
        
        if(keyVal.length > 3) {
          var pos = keyVal.indexOf('.');
          if(pos > 3) {
            key.charCode = keyVal.charCodeAt(pos + 1) || 0;
            keyVal = keyVal.substring(0, pos);
          }
          key.keyCode = KeyEvent["DOM_" + keyVal.toUpperCase()] || 0;
        } else {
          key.charCode = (key.modifiers.shiftKey ? keyVal.toUpperCase() : keyVal).charCodeAt(0) || 0;
        }
        
        this.keys[name] = key;
      } else {
        delete(this.keys[name]);
      }
    },
    listener: function(ev) {
      const binding = arguments.callee.binding;
      const skk = binding.keys;
      var cmd, k, p, sk, mods;
      for(k in skk) {
        cmd = k;
        sk = skk[k];
        
         
        if(ev.charCode && ev.charCode == sk.charCode || ev.keyCode && ev.keyCode == sk.keyCode) {
          mods = sk.modifiers;
          for(p in mods) {
            if(ev[p] != mods[p]) {
              cmd = null;
              break;
            }
          }
          
          
          if(cmd) {
            ev.preventDefault();
            binding.execute(cmd);
            return;
          }
        }
      }
    },
    
    register: function() {
      this.listener.binding = this;
      window.addEventListener("keypress", this.listener, true);
    },
    remove: function() {
      window.removeEventListener("keypress", this.listener, true);
    }
  },
  
  listeners: {
    
    onTabClose: function(ev) {
      try {
        getBrowser().getNotificationBox(ev.target.linkedBrowser).removeAllNotifications(true);
      } catch(e) {}
    },
    
    onDocumentClose: function(ev) {
      const doc = ev.originalTarget;
      if(!(doc.defaultView && doc.defaultView == doc.defaultView.top)) return;
      
      const ns = noscriptOverlay.ns;
      const browser = ns.domUtils.findBrowserForNode(doc);
      if(browser) {
        ns.pluginsCache.purgeURIs(browser);
        if(noscriptOverlay.notificationHide(browser, true)) {
           noscriptOverlay.clearDocFlag(doc, "_noscript_message_shown");
        }
      }
     
    },
    
    webProgressListener: {
      STATE_STOP: Components.interfaces.nsIWebProgressListener.STATE_STOP,
      onLocationChange: function(aWebProgress, aRequest, aLocation) { 
        if(this.originalOnLocationChange) {
          try {
            this.originalOnLocationChange(aWebProgress, aRequest, aLocation);
          } catch(e) {}
        }
        try {
          const domWindow = aWebProgress.DOMWindow;
          if(aRequest && (aRequest instanceof Components.interfaces.nsIChannel) && aRequest.isPending()) {
            const ns = noscriptOverlay.ns;
            const uri = aRequest.URI;
            const topWin = domWindow && domWindow == domWindow.top
            if(topWin) {
              noscriptOverlay.setMetaRefreshInfo(null, ns.domUtils.findBrowser(window, domWindow));
            }
            if(ns.shouldLoad(7, uri, uri, domWindow, aRequest.contentType, true) != 1) {
              aRequest.cancel(0x804b0002);
            } else {
              if(topWin) {
                if(ns.autoAllow) {
                  var site = ns.getQuickSite(uri.spec, ns.autoAllow);
                  if(site && (!(ns.isJSEnabled(site) || ns.isUntrusted(site) || ns.isManual(site)))) {
                    ns.setTemp(site, true);
                    ns.setJSEnabled(site, true);
                  }
                }
              }
            }
          }
          noscriptOverlay.syncUI(domWindow);
        } catch(e) {
          ns.consoleDump && dump("[NoScript] " + e + "\n");
          debugger;
        }
      },
      onStatusChange: function() {}, 
      onStateChange: function(aWebProgress, aRequest, stateFlags, status) {
        if(stateFlags & this.STATE_STOP) {
          const ns = noscriptOverlay.ns;
          const domWindow = aWebProgress.DOMWindow;
          const browser = ns.domUtils.findBrowserForNode(domWindow);
          if(browser) {
            ns.requestWatchdog.unsafeReload(browser, false);
          }
          try {
            noscriptOverlay.syncUI(domWindow);
          } catch(e) {}
        }
      }, 
      onSecurityChange: function() {}, 
      onProgressChange: function() {}
    },
    
    onContentLoad: function(ev) {
      var doc = ev.originalTarget;
      if(doc instanceof HTMLDocument) {
        var w = doc.defaultView;
        if(w) {
          const ns = noscriptOverlay.ns;
          doc._NoScript_contentLoaded = true;
          if(w == w.top) {
            ns.processMetaRefresh(doc);
            if(w == window.content) noscriptOverlay._syncUINow();
          } else {
            noscriptOverlay.syncUI(w.top);
          }
          ns.detectJSRedirects(doc);
        }
      }
    },
    onUninstallMaybe: function(ev) { noscriptOverlay.uninstallCheck(ev) }, 
    onContextMenu:  function(ev) { noscriptOverlay.prepareContextMenu(ev) },
    
    
    onLoad: function(ev) {
      noscriptOverlay.listeners.setup();
      noscriptOverlay.patchBrowserAccess();
    },
    onUnload: function(ev) {
      noscriptOverlay.listeners.teardown();
    },
    
    setup: function() {
      document.getElementById("contentAreaContextMenu")
          .addEventListener("popupshowing", this.onContextMenu, false);
      
          
      var b = getBrowser();
      
      b.addEventListener("click", noscriptOverlay.fixLink, true);

      b.addProgressListener(this.webProgressListener);
      this.originalTabProgressListener = b.mTabProgressListener;
      b.mTabProgressListener = function() {
        var l = noscriptOverlay.listeners.originalTabProgressListener.apply(this, arguments);
        l.originalOnLocationChange = l.onLocationChange;
        l.onLocationChange = noscriptOverlay.listeners.webProgressListener.onLocationChange;
        return l;
      };
      
      if(b.tabContainer) {
        b.tabContainer.addEventListener("TabClose", this.onTabClose, false);
      }
      
      window.addEventListener("pageshow", this.onContentLoad, false);
      window.addEventListener("DOMContentLoaded", this.onContentLoad, false);
      window.addEventListener("beforeunload", this.onDocumentClose, false);
      window.addEventListener("pagehide", this.onDocumentClose, false);
      
      noscriptOverlay.shortcutKeys.register();
      noscriptOverlay.prefsObserver.register();
      
      window.setTimeout(function() {  
        const ns = noscriptUtil.service;
        const prevVer = ns.getPref("version", "");
        if(prevVer != ns.VERSION) {
          ns.setPref("version", ns.VERSION);
          if(prevVer < "1.1.4.070304") ns.sanitize2ndLevs();
          if(ns.getPref("firstRunRedirection", true)) {
              window.setTimeout(function() {
                const url = "http://noscript.net?ver=" + ns.VERSION + "&prev=" + prevVer;
                const browser = getBrowser();
                browser.selectedTab = browser.addTab(url, null);
                ns.savePrefs();
              }, 100);
           }
        }
      }, 10);
    },
    
   
    teardown: function() {
      var b = getBrowser();
      if(b) {
        const ll = this.listeners;
        b.removeEventListener("click", noscriptOverlay.fixLink, true);
        if(b.tabContainer) {
          b.tabContainer.removeEventListener("TabClose", this.onTabClose, false);
        }
        
        b.removeProgressListener(this.webProgressListener);
      }
      
      window.removeEventListener("beforeunload", this.onDocumentClose, false);
      window.removeEventListener("pagehide", this.onDocumentClose, false);
      window.removeEventListener("pageshow", this.onContentLoad, false);
      window.removeEventListener("DOMContentLoaded", this.onContentLoad, false);

      noscriptOverlay.prefsObserver.remove();
      noscriptOverlay.shortcutKeys.remove();
      
      document.getElementById("contentAreaContextMenu")
              .removeEventListener("popupshowing", this.onContextMenu,false);
    }
  }, // END listeners
  
  patchBrowserAccess: function() { // called onload
    if(!nsBrowserAccess) return;
    if(!nsBrowserAccess.prototype.wrappedJSObject) {
      nsBrowserAccess.prototype.__defineGetter__("wrappedJSObject", function() { return this; });
    }
    if(!(window.browserDOMWindow && window.browserDOMWindow.wrappedJSObject)) {
      if(!'retryCount' in arguments.callee) {
        arguments.callee.retryCount = 10;
      } else if(arguments.callee.retryCount) {
        noscriptOverlay.ns.log("[NoScript] browserDOMWindow not found or not set up, retrying " + arguments.callee.retryCount + " times");
        arguments.callee.retryCount--;
        window.setTimeout(arguments.callee, 0);
      }
      return;
    }
    
    const OPEN_EXTERNAL = Components.interfaces.nsIBrowserDOMWindow.OPEN_EXTERNAL;   
    
    window.browserDOMWindow.wrappedJSObject.openURI = function(aURI, aOpener, aWhere, aContext) {
      var external = (aContext == OPEN_EXTERNAL && aURI &&
        (aURI.schemeIs("http") || aURI.schemeIs("https"))) && 
        (noscriptOverlay.ns.requestWatchdog.externalLoad = aURI.spec);
      var w = null;
      try {
        w = nsBrowserAccess.prototype.openURI.apply(this, [aURI, aOpener, aWhere, aContext]);
        if(external) noscriptOverlay.ns.log("[NoScript] external load intercepted");
      } finally {
        if(external && !w) noscriptOverlay.ns.requestWatchdog.externalLoad = null;
      }
      return w;
    }
    noscriptOverlay.ns.log("[NoScript] browserDOMWindow patched for external load interception");
  },
  
  install: function() {
    if(!this.ns) {
      // TODO - fail in a nicer way
      alert("NoScript is not properly installed and cannot operate correctly.\n" + 
            "Please install it again and check the Install FAQ section on http://noscript.net/faq if this problem persists.");
      return;
    }
    const ll = this.listeners;
    window.addEventListener("load", ll.onLoad, false);
    window.addEventListener("focus", ll.onUninstallMaybe, false);
    window.addEventListener("unload", ll.onUnload, false);
  },

  dispose: function() {
    const ll = this.listeners;
    window.removeEventListener("unload", ll.onUnload, false);
    window.removeEventListener("focus", ll.onUninstallMaybe, false);
    window.removeEventListener("load", ll.onLoad, false);
  }
}
  


noscriptOverlay.install();
