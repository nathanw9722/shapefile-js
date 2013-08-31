(function (root, factory) {
  /* global module: false */
  if (typeof define === 'function' && define.amd) {
    define(factory);
  } else if(typeof module !== 'undefined'){
    module.exports = factory();
  }else {
    root.shp = factory();
  }
}(this, function () {


/**
 * almond 0.2.6 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("../node_modules/almond/almond", function(){});


define('mgrs',['require','exports','module'],function(require, exports) {
  /*
Portions of this software are based on a port of components from the OpenMap
com.bbn.openmap.proj.coords Java package. An initial port was initially created
by Patrice G. Cappelaere and included in Community Mapbuilder
(http://svn.codehaus.org/mapbuilder/), which is licensed under the LGPL license
as per http://www.gnu.org/copyleft/lesser.html. OpenMap is licensed under the
following license agreement:


               OpenMap Software License Agreement
               ----------------------------------

This Agreement sets forth the terms and conditions under which
the software known as OpenMap(tm) will be licensed by BBN
Technologies ("BBN") to you ("Licensee"), and by which Derivative 
Works (as hereafter defined) of OpenMap will be licensed by you to BBN.

Definitions:

 "Derivative Work(s)" shall mean any revision, enhancement,
 modification, translation, abridgement, condensation or
 expansion created by Licensee or BBN that is based upon the
 Software or a portion thereof that would be a copyright
 infringement if prepared without the authorization of the
 copyright owners of the Software or portion thereof.

 "OpenMap" shall mean a programmer's toolkit for building map
 based applications as originally created by BBN, and any
 Derivative Works thereof as created by either BBN or Licensee,
 but shall include only those Derivative Works BBN has approved
 for inclusion into, and BBN has integrated into OpenMap.

 "Standard Version" shall mean OpenMap, as originally created by
 BBN.

 "Software" shall mean OpenMap and the Derivative Works created
 by Licensee and the collection of files distributed by the
 Licensee with OpenMap, and the collection of files created
 through textual modifications.

 "Copyright Holder" is whoever is named in the copyright or
 copyrights for the Derivative Works.

 "Licensee" is you, only if you agree to be bound by the terms
 and conditions set forth in this Agreement.

 "Reasonable copying fee" is whatever you can justify on the
 basis of media cost, duplication charges, time of people
 involved.

 "Freely Available" means that no fee is charged for the item
 itself, though there may be fees involved in handling the item.
 It also means that recipients of the item may redistribute it
 under the same conditions that they received it.

1. BBN maintains all rights, title and interest in and to
OpenMap, including all applicable copyrights, trade secrets,
patents and other intellectual rights therein.  Licensee hereby
grants to BBN all right, title and interest into the compilation
of OpenMap.  Licensee shall own all rights, title and interest
into the Derivative Works created by Licensee (subject to the
compilation ownership by BBN).

2. BBN hereby grants to Licensee a royalty free, worldwide right
and license to use, copy, distribute and make Derivative Works of
OpenMap, and sublicensing rights of any of the foregoing in
accordance with the terms and conditions of this Agreement,
provided that you duplicate all of the original copyright notices
and associated disclaimers.

3. Licensee hereby grants to BBN a royalty free, worldwide right
and license to use, copy, distribute and make Derivative Works of
Derivative Works created by Licensee and sublicensing rights of
any of the foregoing.

4. Licensee's right to create Derivative Works in the Software is
subject to Licensee agreement to insert a prominent notice in
each changed file stating how and when you changed that file, and
provided that you do at least ONE of the following:

    a) place your modifications in the Public Domain or otherwise
       make them Freely Available, such as by posting said
       modifications to Usenet or an equivalent medium, or
       placing the modifications on a major archive site and by
       providing your modifications to the Copyright Holder.

    b) use the modified Package only within your corporation or
       organization.

    c) rename any non-standard executables so the names do not
       conflict with standard executables, which must also be
       provided, and provide a separate manual page for each
       non-standard executable that clearly documents how it
       differs from OpenMap.

    d) make other distribution arrangements with the Copyright
       Holder.

5. Licensee may distribute the programs of this Software in
object code or executable form, provided that you do at least ONE
of the following:

    a) distribute an OpenMap version of the executables and
       library files, together with instructions (in the manual
       page or equivalent) on where to get OpenMap.

    b) accompany the distribution with the machine-readable
       source code with your modifications.

    c) accompany any non-standard executables with their
       corresponding OpenMap executables, giving the non-standard
       executables non-standard names, and clearly documenting
       the differences in manual pages (or equivalent), together
       with instructions on where to get OpenMap.

    d) make other distribution arrangements with the Copyright
       Holder.

6. You may charge a reasonable copying fee for any distribution
of this Software.  You may charge any fee you choose for support
of this Software.  You may not charge a fee for this Software
itself.  However, you may distribute this Software in aggregate
with other (possibly commercial) programs as part of a larger
(possibly commercial) software distribution provided that you do
not advertise this Software as a product of your own.

7. The data and images supplied as input to or produced as output
from the Software do not automatically fall under the copyright
of this Software, but belong to whomever generated them, and may
be sold commercially, and may be aggregated with this Software.

8. BBN makes no representation about the suitability of OpenMap
for any purposes.  BBN shall have no duty or requirement to
include any Derivative Works into OpenMap.

9. Each party hereto represents and warrants that they have the
full unrestricted right to grant all rights and licenses granted
to the other party herein.

10. THIS PACKAGE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY
KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING (BUT NOT LIMITED TO)
ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS, AND
WITHOUT ANY WARRANTIES AS TO NONINFRINGEMENT.

11. IN NO EVENT SHALL COPYRIGHT HOLDER BE LIABLE FOR ANY DIRECT,
SPECIAL, INDIRECT OR CONSEQUENTIAL DAMAGES WHATSOEVER RESULTING
FROM LOSS OF USE OF DATA OR PROFITS, WHETHER IN AN ACTION OF
CONTRACT, NEGLIGENCE OR OTHER TORTIOUS CONDUCT, ARISING OUT OF OR
IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS PACKAGE.

12. Without limitation of the foregoing, You agree to commit no
act which, directly or indirectly, would violate any U.S. law,
regulation, or treaty, or any other international treaty or
agreement to which the United States adheres or with which the
United States complies, relating to the export or re-export of
any commodities, software, or technical data.
*/



  /**
   * Converts between lat/lon and MGRS coordinates. Note that this static class
   * is restricted to the WGS84 ellipsoid and does not support MGRS notations
   * for polar regions (i.e. above 84° North and below 80° South).
   *
   * If proj4 is loaded, this will be referenced as util.MGRS. If used
   * standalone, it will be referenced as window.MGRS.
   *
   * @static
   */


  /**
   * UTM zones are grouped, and assigned to one of a group of 6
   * sets.
   *
   * {int} @private
   */
  var NUM_100K_SETS = 6;

  /**
   * The column letters (for easting) of the lower left value, per
   * set.
   *
   * {string} @private
   */
  var SET_ORIGIN_COLUMN_LETTERS = 'AJSAJS';

  /**
   * The row letters (for northing) of the lower left value, per
   * set.
   *
   * {string} @private
   */
  var SET_ORIGIN_ROW_LETTERS = 'AFAFAF';

  var A = 65; // A
  var I = 73; // I
  var O = 79; // O
  var V = 86; // V
  var Z = 90; // Z

  /**
   * Conversion of lat/lon to MGRS.
   *
   * @param {object} ll Object literal with lat and lon properties on a
   *     WGS84 ellipsoid.
   * @param {int} accuracy Accuracy in digits (5 for 1 m, 4 for 10 m, 3 for
   *      100 m, 4 for 1000 m or 5 for 10000 m). Optional, default is 5.
   * @return {string} the MGRS string for the given location and accuracy.
   */
  exports.forward = function(ll, accuracy) {
    accuracy = accuracy || 5; // default accuracy 1m
    return encode(LLtoUTM({
      lat: ll.lat,
      lon: ll.lon
    }), accuracy);
  };

  /**
   * Conversion of MGRS to lat/lon.
   *
   * @param {string} mgrs MGRS string.
   * @return {array} An array with left (longitude), bottom (latitude), right
   *     (longitude) and top (latitude) values in WGS84, representing the
   *     bounding box for the provided MGRS reference.
   */
  exports.inverse = function(mgrs) {
    var bbox = UTMtoLL(decode(mgrs.toUpperCase()));
    return [bbox.left, bbox.bottom, bbox.right, bbox.top];
  };

  /**
   * Conversion from degrees to radians.
   *
   * @private
   * @param {number} deg the angle in degrees.
   * @return {number} the angle in radians.
   */
  function degToRad(deg) {
    return (deg * (Math.PI / 180.0));
  }

  /**
   * Conversion from radians to degrees.
   *
   * @private
   * @param {number} rad the angle in radians.
   * @return {number} the angle in degrees.
   */
  function radToDeg(rad) {
    return (180.0 * (rad / Math.PI));
  }

  /**
   * Converts a set of Longitude and Latitude co-ordinates to UTM
   * using the WGS84 ellipsoid.
   *
   * @private
   * @param {object} ll Object literal with lat and lon properties
   *     representing the WGS84 coordinate to be converted.
   * @return {object} Object literal containing the UTM value with easting,
   *     northing, zoneNumber and zoneLetter properties, and an optional
   *     accuracy property in digits. Returns null if the conversion failed.
   */
  function LLtoUTM(ll) {
    var Lat = ll.lat;
    var Long = ll.lon;
    var a = 6378137.0; //ellip.radius;
    var eccSquared = 0.00669438; //ellip.eccsq;
    var k0 = 0.9996;
    var LongOrigin;
    var eccPrimeSquared;
    var N, T, C, A, M;
    var LatRad = degToRad(Lat);
    var LongRad = degToRad(Long);
    var LongOriginRad;
    var ZoneNumber;
    // (int)
    ZoneNumber = Math.floor((Long + 180) / 6) + 1;

    //Make sure the longitude 180.00 is in Zone 60
    if (Long === 180) {
      ZoneNumber = 60;
    }

    // Special zone for Norway
    if (Lat >= 56.0 && Lat < 64.0 && Long >= 3.0 && Long < 12.0) {
      ZoneNumber = 32;
    }

    // Special zones for Svalbard
    if (Lat >= 72.0 && Lat < 84.0) {
      if (Long >= 0.0 && Long < 9.0) {
        ZoneNumber = 31;
      }
      else if (Long >= 9.0 && Long < 21.0) {
        ZoneNumber = 33;
      }
      else if (Long >= 21.0 && Long < 33.0) {
        ZoneNumber = 35;
      }
      else if (Long >= 33.0 && Long < 42.0) {
        ZoneNumber = 37;
      }
    }

    LongOrigin = (ZoneNumber - 1) * 6 - 180 + 3; //+3 puts origin
    // in middle of
    // zone
    LongOriginRad = degToRad(LongOrigin);

    eccPrimeSquared = (eccSquared) / (1 - eccSquared);

    N = a / Math.sqrt(1 - eccSquared * Math.sin(LatRad) * Math.sin(LatRad));
    T = Math.tan(LatRad) * Math.tan(LatRad);
    C = eccPrimeSquared * Math.cos(LatRad) * Math.cos(LatRad);
    A = Math.cos(LatRad) * (LongRad - LongOriginRad);

    M = a * ((1 - eccSquared / 4 - 3 * eccSquared * eccSquared / 64 - 5 * eccSquared * eccSquared * eccSquared / 256) * LatRad - (3 * eccSquared / 8 + 3 * eccSquared * eccSquared / 32 + 45 * eccSquared * eccSquared * eccSquared / 1024) * Math.sin(2 * LatRad) + (15 * eccSquared * eccSquared / 256 + 45 * eccSquared * eccSquared * eccSquared / 1024) * Math.sin(4 * LatRad) - (35 * eccSquared * eccSquared * eccSquared / 3072) * Math.sin(6 * LatRad));

    var UTMEasting = (k0 * N * (A + (1 - T + C) * A * A * A / 6.0 + (5 - 18 * T + T * T + 72 * C - 58 * eccPrimeSquared) * A * A * A * A * A / 120.0) + 500000.0);

    var UTMNorthing = (k0 * (M + N * Math.tan(LatRad) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24.0 + (61 - 58 * T + T * T + 600 * C - 330 * eccPrimeSquared) * A * A * A * A * A * A / 720.0)));
    if (Lat < 0.0) {
      UTMNorthing += 10000000.0; //10000000 meter offset for
      // southern hemisphere
    }

    return {
      northing: Math.round(UTMNorthing),
      easting: Math.round(UTMEasting),
      zoneNumber: ZoneNumber,
      zoneLetter: getLetterDesignator(Lat)
    };
  }

  /**
   * Converts UTM coords to lat/long, using the WGS84 ellipsoid. This is a convenience
   * class where the Zone can be specified as a single string eg."60N" which
   * is then broken down into the ZoneNumber and ZoneLetter.
   *
   * @private
   * @param {object} utm An object literal with northing, easting, zoneNumber
   *     and zoneLetter properties. If an optional accuracy property is
   *     provided (in meters), a bounding box will be returned instead of
   *     latitude and longitude.
   * @return {object} An object literal containing either lat and lon values
   *     (if no accuracy was provided), or top, right, bottom and left values
   *     for the bounding box calculated according to the provided accuracy.
   *     Returns null if the conversion failed.
   */
  function UTMtoLL(utm) {

    var UTMNorthing = utm.northing;
    var UTMEasting = utm.easting;
    var zoneLetter = utm.zoneLetter;
    var zoneNumber = utm.zoneNumber;
    // check the ZoneNummber is valid
    if (zoneNumber < 0 || zoneNumber > 60) {
      return null;
    }

    var k0 = 0.9996;
    var a = 6378137.0; //ellip.radius;
    var eccSquared = 0.00669438; //ellip.eccsq;
    var eccPrimeSquared;
    var e1 = (1 - Math.sqrt(1 - eccSquared)) / (1 + Math.sqrt(1 - eccSquared));
    var N1, T1, C1, R1, D, M;
    var LongOrigin;
    var mu, phi1Rad;

    // remove 500,000 meter offset for longitude
    var x = UTMEasting - 500000.0;
    var y = UTMNorthing;

    // We must know somehow if we are in the Northern or Southern
    // hemisphere, this is the only time we use the letter So even
    // if the Zone letter isn't exactly correct it should indicate
    // the hemisphere correctly
    if (zoneLetter < 'N') {
      y -= 10000000.0; // remove 10,000,000 meter offset used
      // for southern hemisphere
    }

    // There are 60 zones with zone 1 being at West -180 to -174
    LongOrigin = (zoneNumber - 1) * 6 - 180 + 3; // +3 puts origin
    // in middle of
    // zone

    eccPrimeSquared = (eccSquared) / (1 - eccSquared);

    M = y / k0;
    mu = M / (a * (1 - eccSquared / 4 - 3 * eccSquared * eccSquared / 64 - 5 * eccSquared * eccSquared * eccSquared / 256));

    phi1Rad = mu + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu) + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu);
    // double phi1 = ProjMath.radToDeg(phi1Rad);

    N1 = a / Math.sqrt(1 - eccSquared * Math.sin(phi1Rad) * Math.sin(phi1Rad));
    T1 = Math.tan(phi1Rad) * Math.tan(phi1Rad);
    C1 = eccPrimeSquared * Math.cos(phi1Rad) * Math.cos(phi1Rad);
    R1 = a * (1 - eccSquared) / Math.pow(1 - eccSquared * Math.sin(phi1Rad) * Math.sin(phi1Rad), 1.5);
    D = x / (N1 * k0);

    var lat = phi1Rad - (N1 * Math.tan(phi1Rad) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * eccPrimeSquared) * D * D * D * D / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * eccPrimeSquared - 3 * C1 * C1) * D * D * D * D * D * D / 720);
    lat = radToDeg(lat);

    var lon = (D - (1 + 2 * T1 + C1) * D * D * D / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * eccPrimeSquared + 24 * T1 * T1) * D * D * D * D * D / 120) / Math.cos(phi1Rad);
    lon = LongOrigin + radToDeg(lon);

    var result;
    if (utm.accuracy) {
      var topRight = UTMtoLL({
        northing: utm.northing + utm.accuracy,
        easting: utm.easting + utm.accuracy,
        zoneLetter: utm.zoneLetter,
        zoneNumber: utm.zoneNumber
      });
      result = {
        top: topRight.lat,
        right: topRight.lon,
        bottom: lat,
        left: lon
      };
    }
    else {
      result = {
        lat: lat,
        lon: lon
      };
    }
    return result;
  }

  /**
   * Calculates the MGRS letter designator for the given latitude.
   *
   * @private
   * @param {number} lat The latitude in WGS84 to get the letter designator
   *     for.
   * @return {char} The letter designator.
   */
  function getLetterDesignator(lat) {
    //This is here as an error flag to show that the Latitude is
    //outside MGRS limits
    var LetterDesignator = 'Z';

    if ((84 >= lat) && (lat >= 72)) {
      LetterDesignator = 'X';
    }
    else if ((72 > lat) && (lat >= 64)) {
      LetterDesignator = 'W';
    }
    else if ((64 > lat) && (lat >= 56)) {
      LetterDesignator = 'V';
    }
    else if ((56 > lat) && (lat >= 48)) {
      LetterDesignator = 'U';
    }
    else if ((48 > lat) && (lat >= 40)) {
      LetterDesignator = 'T';
    }
    else if ((40 > lat) && (lat >= 32)) {
      LetterDesignator = 'S';
    }
    else if ((32 > lat) && (lat >= 24)) {
      LetterDesignator = 'R';
    }
    else if ((24 > lat) && (lat >= 16)) {
      LetterDesignator = 'Q';
    }
    else if ((16 > lat) && (lat >= 8)) {
      LetterDesignator = 'P';
    }
    else if ((8 > lat) && (lat >= 0)) {
      LetterDesignator = 'N';
    }
    else if ((0 > lat) && (lat >= -8)) {
      LetterDesignator = 'M';
    }
    else if ((-8 > lat) && (lat >= -16)) {
      LetterDesignator = 'L';
    }
    else if ((-16 > lat) && (lat >= -24)) {
      LetterDesignator = 'K';
    }
    else if ((-24 > lat) && (lat >= -32)) {
      LetterDesignator = 'J';
    }
    else if ((-32 > lat) && (lat >= -40)) {
      LetterDesignator = 'H';
    }
    else if ((-40 > lat) && (lat >= -48)) {
      LetterDesignator = 'G';
    }
    else if ((-48 > lat) && (lat >= -56)) {
      LetterDesignator = 'F';
    }
    else if ((-56 > lat) && (lat >= -64)) {
      LetterDesignator = 'E';
    }
    else if ((-64 > lat) && (lat >= -72)) {
      LetterDesignator = 'D';
    }
    else if ((-72 > lat) && (lat >= -80)) {
      LetterDesignator = 'C';
    }
    return LetterDesignator;
  }

  /**
   * Encodes a UTM location as MGRS string.
   *
   * @private
   * @param {object} utm An object literal with easting, northing,
   *     zoneLetter, zoneNumber
   * @param {number} accuracy Accuracy in digits (1-5).
   * @return {string} MGRS string for the given UTM location.
   */
  function encode(utm, accuracy) {
    var seasting = "" + utm.easting,
      snorthing = "" + utm.northing;

    return utm.zoneNumber + utm.zoneLetter + get100kID(utm.easting, utm.northing, utm.zoneNumber) + seasting.substr(seasting.length - 5, accuracy) + snorthing.substr(snorthing.length - 5, accuracy);
  }

  /**
   * Get the two letter 100k designator for a given UTM easting,
   * northing and zone number value.
   *
   * @private
   * @param {number} easting
   * @param {number} northing
   * @param {number} zoneNumber
   * @return the two letter 100k designator for the given UTM location.
   */
  function get100kID(easting, northing, zoneNumber) {
    var setParm = get100kSetForZone(zoneNumber);
    var setColumn = Math.floor(easting / 100000);
    var setRow = Math.floor(northing / 100000) % 20;
    return getLetter100kID(setColumn, setRow, setParm);
  }

  /**
   * Given a UTM zone number, figure out the MGRS 100K set it is in.
   *
   * @private
   * @param {number} i An UTM zone number.
   * @return {number} the 100k set the UTM zone is in.
   */
  function get100kSetForZone(i) {
    var setParm = i % NUM_100K_SETS;
    if (setParm === 0) {
      setParm = NUM_100K_SETS;
    }

    return setParm;
  }

  /**
   * Get the two-letter MGRS 100k designator given information
   * translated from the UTM northing, easting and zone number.
   *
   * @private
   * @param {number} column the column index as it relates to the MGRS
   *        100k set spreadsheet, created from the UTM easting.
   *        Values are 1-8.
   * @param {number} row the row index as it relates to the MGRS 100k set
   *        spreadsheet, created from the UTM northing value. Values
   *        are from 0-19.
   * @param {number} parm the set block, as it relates to the MGRS 100k set
   *        spreadsheet, created from the UTM zone. Values are from
   *        1-60.
   * @return two letter MGRS 100k code.
   */
  function getLetter100kID(column, row, parm) {
    // colOrigin and rowOrigin are the letters at the origin of the set
    var index = parm - 1;
    var colOrigin = SET_ORIGIN_COLUMN_LETTERS.charCodeAt(index);
    var rowOrigin = SET_ORIGIN_ROW_LETTERS.charCodeAt(index);

    // colInt and rowInt are the letters to build to return
    var colInt = colOrigin + column - 1;
    var rowInt = rowOrigin + row;
    var rollover = false;

    if (colInt > Z) {
      colInt = colInt - Z + A - 1;
      rollover = true;
    }

    if (colInt === I || (colOrigin < I && colInt > I) || ((colInt > I || colOrigin < I) && rollover)) {
      colInt++;
    }

    if (colInt === O || (colOrigin < O && colInt > O) || ((colInt > O || colOrigin < O) && rollover)) {
      colInt++;

      if (colInt === I) {
        colInt++;
      }
    }

    if (colInt > Z) {
      colInt = colInt - Z + A - 1;
    }

    if (rowInt > V) {
      rowInt = rowInt - V + A - 1;
      rollover = true;
    }
    else {
      rollover = false;
    }

    if (((rowInt === I) || ((rowOrigin < I) && (rowInt > I))) || (((rowInt > I) || (rowOrigin < I)) && rollover)) {
      rowInt++;
    }

    if (((rowInt === O) || ((rowOrigin < O) && (rowInt > O))) || (((rowInt > O) || (rowOrigin < O)) && rollover)) {
      rowInt++;

      if (rowInt === I) {
        rowInt++;
      }
    }

    if (rowInt > V) {
      rowInt = rowInt - V + A - 1;
    }

    var twoLetter = String.fromCharCode(colInt) + String.fromCharCode(rowInt);
    return twoLetter;
  }

  /**
   * Decode the UTM parameters from a MGRS string.
   *
   * @private
   * @param {string} mgrsString an UPPERCASE coordinate string is expected.
   * @return {object} An object literal with easting, northing, zoneLetter,
   *     zoneNumber and accuracy (in meters) properties.
   */
  function decode(mgrsString) {

    if (mgrsString && mgrsString.length === 0) {
      throw ("MGRSPoint coverting from nothing");
    }

    var length = mgrsString.length;

    var hunK = null;
    var sb = "";
    var testChar;
    var i = 0;

    // get Zone number
    while (!(/[A-Z]/).test(testChar = mgrsString.charAt(i))) {
      if (i >= 2) {
        throw ("MGRSPoint bad conversion from: " + mgrsString);
      }
      sb += testChar;
      i++;
    }

    var zoneNumber = parseInt(sb, 10);

    if (i === 0 || i + 3 > length) {
      // A good MGRS string has to be 4-5 digits long,
      // ##AAA/#AAA at least.
      throw ("MGRSPoint bad conversion from: " + mgrsString);
    }

    var zoneLetter = mgrsString.charAt(i++);

    // Should we check the zone letter here? Why not.
    if (zoneLetter <= 'A' || zoneLetter === 'B' || zoneLetter === 'Y' || zoneLetter >= 'Z' || zoneLetter === 'I' || zoneLetter === 'O') {
      throw ("MGRSPoint zone letter " + zoneLetter + " not handled: " + mgrsString);
    }

    hunK = mgrsString.substring(i, i += 2);

    var set = get100kSetForZone(zoneNumber);

    var east100k = getEastingFromChar(hunK.charAt(0), set);
    var north100k = getNorthingFromChar(hunK.charAt(1), set);

    // We have a bug where the northing may be 2000000 too low.
    // How
    // do we know when to roll over?

    while (north100k < getMinNorthing(zoneLetter)) {
      north100k += 2000000;
    }

    // calculate the char index for easting/northing separator
    var remainder = length - i;

    if (remainder % 2 !== 0) {
      throw ("MGRSPoint has to have an even number \nof digits after the zone letter and two 100km letters - front \nhalf for easting meters, second half for \nnorthing meters" + mgrsString);
    }

    var sep = remainder / 2;

    var sepEasting = 0.0;
    var sepNorthing = 0.0;
    var accuracyBonus, sepEastingString, sepNorthingString, easting, northing;
    if (sep > 0) {
      accuracyBonus = 100000.0 / Math.pow(10, sep);
      sepEastingString = mgrsString.substring(i, i + sep);
      sepEasting = parseFloat(sepEastingString) * accuracyBonus;
      sepNorthingString = mgrsString.substring(i + sep);
      sepNorthing = parseFloat(sepNorthingString) * accuracyBonus;
    }

    easting = sepEasting + east100k;
    northing = sepNorthing + north100k;

    return {
      easting: easting,
      northing: northing,
      zoneLetter: zoneLetter,
      zoneNumber: zoneNumber,
      accuracy: accuracyBonus
    };
  }

  /**
   * Given the first letter from a two-letter MGRS 100k zone, and given the
   * MGRS table set for the zone number, figure out the easting value that
   * should be added to the other, secondary easting value.
   *
   * @private
   * @param {char} e The first letter from a two-letter MGRS 100´k zone.
   * @param {number} set The MGRS table set for the zone number.
   * @return {number} The easting value for the given letter and set.
   */
  function getEastingFromChar(e, set) {
    // colOrigin is the letter at the origin of the set for the
    // column
    var curCol = SET_ORIGIN_COLUMN_LETTERS.charCodeAt(set - 1);
    var eastingValue = 100000.0;
    var rewindMarker = false;

    while (curCol !== e.charCodeAt(0)) {
      curCol++;
      if (curCol === I) {
        curCol++;
      }
      if (curCol === O) {
        curCol++;
      }
      if (curCol > Z) {
        if (rewindMarker) {
          throw ("Bad character: " + e);
        }
        curCol = A;
        rewindMarker = true;
      }
      eastingValue += 100000.0;
    }

    return eastingValue;
  }

  /**
   * Given the second letter from a two-letter MGRS 100k zone, and given the
   * MGRS table set for the zone number, figure out the northing value that
   * should be added to the other, secondary northing value. You have to
   * remember that Northings are determined from the equator, and the vertical
   * cycle of letters mean a 2000000 additional northing meters. This happens
   * approx. every 18 degrees of latitude. This method does *NOT* count any
   * additional northings. You have to figure out how many 2000000 meters need
   * to be added for the zone letter of the MGRS coordinate.
   *
   * @private
   * @param {char} n Second letter of the MGRS 100k zone
   * @param {number} set The MGRS table set number, which is dependent on the
   *     UTM zone number.
   * @return {number} The northing value for the given letter and set.
   */
  function getNorthingFromChar(n, set) {

    if (n > 'V') {
      throw ("MGRSPoint given invalid Northing " + n);
    }

    // rowOrigin is the letter at the origin of the set for the
    // column
    var curRow = SET_ORIGIN_ROW_LETTERS.charCodeAt(set - 1);
    var northingValue = 0.0;
    var rewindMarker = false;

    while (curRow !== n.charCodeAt(0)) {
      curRow++;
      if (curRow === I) {
        curRow++;
      }
      if (curRow === O) {
        curRow++;
      }
      // fixing a bug making whole application hang in this loop
      // when 'n' is a wrong character
      if (curRow > V) {
        if (rewindMarker) { // making sure that this loop ends
          throw ("Bad character: " + n);
        }
        curRow = A;
        rewindMarker = true;
      }
      northingValue += 100000.0;
    }

    return northingValue;
  }

  /**
   * The function getMinNorthing returns the minimum northing value of a MGRS
   * zone.
   *
   * Ported from Geotrans' c Lattitude_Band_Value structure table.
   *
   * @private
   * @param {char} zoneLetter The MGRS zone to get the min northing for.
   * @return {number}
   */
  function getMinNorthing(zoneLetter) {
    var northing;
    switch (zoneLetter) {
    case 'C':
      northing = 1100000.0;
      break;
    case 'D':
      northing = 2000000.0;
      break;
    case 'E':
      northing = 2800000.0;
      break;
    case 'F':
      northing = 3700000.0;
      break;
    case 'G':
      northing = 4600000.0;
      break;
    case 'H':
      northing = 5500000.0;
      break;
    case 'J':
      northing = 6400000.0;
      break;
    case 'K':
      northing = 7300000.0;
      break;
    case 'L':
      northing = 8200000.0;
      break;
    case 'M':
      northing = 9100000.0;
      break;
    case 'N':
      northing = 0.0;
      break;
    case 'P':
      northing = 800000.0;
      break;
    case 'Q':
      northing = 1700000.0;
      break;
    case 'R':
      northing = 2600000.0;
      break;
    case 'S':
      northing = 3500000.0;
      break;
    case 'T':
      northing = 4400000.0;
      break;
    case 'U':
      northing = 5300000.0;
      break;
    case 'V':
      northing = 6200000.0;
      break;
    case 'W':
      northing = 7000000.0;
      break;
    case 'X':
      northing = 7900000.0;
      break;
    default:
      northing = -1.0;
    }
    if (northing >= 0.0) {
      return northing;
    }
    else {
      throw ("Invalid zone letter: " + zoneLetter);
    }

  }

});

define('Point',['./mgrs'],function(mgrs) {
  function Point(x, y, z) {
    if (!(this instanceof Point)) {
      return new Point(x, y, z);
    }
    if (typeof x === 'object') {
      this.x = x[0];
      this.y = x[1];
      this.z = x[2] || 0.0;
    }
    else if (typeof x === 'string' && typeof y === 'undefined') {
      var coords = x.split(',');
      this.x = parseFloat(coords[0]);
      this.y = parseFloat(coords[1]);
      this.z = parseFloat(coords[2]) || 0.0;
    }
    else {
      this.x = x;
      this.y = y;
      this.z = z || 0.0;
    }
    this.clone = function() {
      return new Point(this.x, this.y, this.z);
    };
    this.toString = function() {
      return ("x=" + this.x + ",y=" + this.y);
    };
    /** 
     * APIMethod: toShortString
     * Return a short string version of the point.
     *
     * Return:
     * {String} Shortened String representation of proj4.Point object. 
     *         (ex. <i>"5, 42"</i>)
     */
    this.toShortString = function() {
      return (this.x + ", " + this.y);
    };
  }

  Point.fromMGRS = function(mgrsStr) {
    var llbbox = mgrs.inverse(mgrsStr);
    return new Point((llbbox[2] + llbbox[0]) / 2, (llbbox[3] + llbbox[1]) / 2);
  };
  Point.prototype.toMGRS = function(accuracy) {
      return mgrs.forward({
        lon: this.x,
        lat: this.y
      }, accuracy);
    };
  return Point;
});

define('extend',[],function() {
  return function(destination, source) {
    destination = destination || {};
    var value, property;
    if (!source) {
      return destination;
    }
    for (property in source) {
      value = source[property];
      if (value !== undefined) {
        destination[property] = value;
      }
    }
    return destination;
  };
});

define('common',[],function() {
  var common = {
    PI: 3.141592653589793238, //Math.PI,
    HALF_PI: 1.570796326794896619, //Math.PI*0.5,
    TWO_PI: 6.283185307179586477, //Math.PI*2,
    FORTPI: 0.78539816339744833,
    R2D: 57.29577951308232088,
    D2R: 0.01745329251994329577,
    SEC_TO_RAD: 4.84813681109535993589914102357e-6,
    /* SEC_TO_RAD = Pi/180/3600 */
    EPSLN: 1.0e-10,
    MAX_ITER: 20,
    // following constants from geocent.c
    COS_67P5: 0.38268343236508977,
    /* cosine of 67.5 degrees */
    AD_C: 1.0026000,
    /* Toms region 1 constant */

    /* datum_type values */
    PJD_UNKNOWN: 0,
    PJD_3PARAM: 1,
    PJD_7PARAM: 2,
    PJD_GRIDSHIFT: 3,
    PJD_WGS84: 4, // WGS84 or equivalent
    PJD_NODATUM: 5, // WGS84 or equivalent
    SRS_WGS84_SEMIMAJOR: 6378137, // only used in grid shift transforms
    SRS_WGS84_ESQUARED: 0.006694379990141316, //DGR: 2012-07-29

    // ellipoid pj_set_ell.c
    SIXTH: 0.1666666666666666667,
    /* 1/6 */
    RA4: 0.04722222222222222222,
    /* 17/360 */
    RA6: 0.02215608465608465608,
    /* 67/3024 */
    RV4: 0.06944444444444444444,
    /* 5/72 */
    RV6: 0.04243827160493827160,
    /* 55/1296 */

    // Function to compute the constant small m which is the radius of
    //   a parallel of latitude, phi, divided by the semimajor axis.
    // -----------------------------------------------------------------
    msfnz: function(eccent, sinphi, cosphi) {
      var con = eccent * sinphi;
      return cosphi / (Math.sqrt(1 - con * con));
    },

    // Function to compute the constant small t for use in the forward
    //   computations in the Lambert Conformal Conic and the Polar
    //   Stereographic projections.
    // -----------------------------------------------------------------
    tsfnz: function(eccent, phi, sinphi) {
      var con = eccent * sinphi;
      var com = 0.5 * eccent;
      con = Math.pow(((1 - con) / (1 + con)), com);
      return (Math.tan(0.5 * (this.HALF_PI - phi)) / con);
    },

    // Function to compute the latitude angle, phi2, for the inverse of the
    //   Lambert Conformal Conic and Polar Stereographic projections.
    // ----------------------------------------------------------------
    phi2z: function(eccent, ts) {
      var eccnth = 0.5 * eccent;
      var con, dphi;
      var phi = this.HALF_PI - 2 * Math.atan(ts);
      for (var i = 0; i <= 15; i++) {
        con = eccent * Math.sin(phi);
        dphi = this.HALF_PI - 2 * Math.atan(ts * (Math.pow(((1 - con) / (1 + con)), eccnth))) - phi;
        phi += dphi;
        if (Math.abs(dphi) <= 0.0000000001) {
          return phi;
        }
      }
      //console.log("phi2z has NoConvergence");
      return -9999;
    },

    /* Function to compute constant small q which is the radius of a 
   parallel of latitude, phi, divided by the semimajor axis. 
------------------------------------------------------------*/
    qsfnz: function(eccent, sinphi) {
      var con;
      if (eccent > 1.0e-7) {
        con = eccent * sinphi;
        return ((1 - eccent * eccent) * (sinphi / (1 - con * con) - (0.5 / eccent) * Math.log((1 - con) / (1 + con))));
      }
      else {
        return (2 * sinphi);
      }
    },

    /* Function to compute the inverse of qsfnz
------------------------------------------------------------*/
    iqsfnz: function(eccent, q) {
      var temp = 1 - (1 - eccent * eccent) / (2 * eccent) * Math.log((1 - eccent) / (1 + eccent));
      if (Math.abs(Math.abs(q) - temp) < 1.0E-6) {
        if (q < 0) {
          return (-1 * common.HALF_PI);
        }
        else {
          return common.HALF_PI;
        }
      }
      //var phi = 0.5* q/(1-eccent*eccent);
      var phi = Math.asin(0.5 * q);
      var dphi;
      var sin_phi;
      var cos_phi;
      var con;
      for (var i = 0; i < 30; i++) {
        sin_phi = Math.sin(phi);
        cos_phi = Math.cos(phi);
        con = eccent * sin_phi;
        dphi = Math.pow(1 - con * con, 2) / (2 * cos_phi) * (q / (1 - eccent * eccent) - sin_phi / (1 - con * con) + 0.5 / eccent * Math.log((1 - con) / (1 + con)));
        phi += dphi;
        if (Math.abs(dphi) <= 0.0000000001) {
          return phi;
        }
      }

      //console.log("IQSFN-CONV:Latitude failed to converge after 30 iterations");
      return NaN;
    },

    /* Function to eliminate roundoff errors in asin
----------------------------------------------*/
    asinz: function(x) {
      if (Math.abs(x) > 1) {
        x = (x > 1) ? 1 : -1;
      }
      return Math.asin(x);
    },

    // following functions from gctpc cproj.c for transverse mercator projections
    e0fn: function(x) {
      return (1 - 0.25 * x * (1 + x / 16 * (3 + 1.25 * x)));
    },
    e1fn: function(x) {
      return (0.375 * x * (1 + 0.25 * x * (1 + 0.46875 * x)));
    },
    e2fn: function(x) {
      return (0.05859375 * x * x * (1 + 0.75 * x));
    },
    e3fn: function(x) {
      return (x * x * x * (35 / 3072));
    },
    mlfn: function(e0, e1, e2, e3, phi) {
      return (e0 * phi - e1 * Math.sin(2 * phi) + e2 * Math.sin(4 * phi) - e3 * Math.sin(6 * phi));
    },
    imlfn: function(ml, e0, e1, e2, e3) {
      var phi;
      var dphi;

      phi = ml / e0;
      for (var i = 0; i < 15; i++) {
        dphi = (ml - (e0 * phi - e1 * Math.sin(2 * phi) + e2 * Math.sin(4 * phi) - e3 * Math.sin(6 * phi))) / (e0 - 2 * e1 * Math.cos(2 * phi) + 4 * e2 * Math.cos(4 * phi) - 6 * e3 * Math.cos(6 * phi));
        phi += dphi;
        if (Math.abs(dphi) <= 0.0000000001) {
          return phi;
        }
      }

      //proj4.reportError("IMLFN-CONV:Latitude failed to converge after 15 iterations");
      return NaN;
    },

    srat: function(esinp, exp) {
      return (Math.pow((1 - esinp) / (1 + esinp), exp));
    },

    // Function to return the sign of an argument
    sign: function(x) {
      if (x < 0) {
        return (-1);
      }
      else {
        return (1);
      }
    },

    // Function to adjust longitude to -180 to 180; input in radians
    adjust_lon: function(x) {
      x = (Math.abs(x) < this.PI) ? x : (x - (this.sign(x) * this.TWO_PI));
      return x;
    },

    // IGNF - DGR : algorithms used by IGN France

    // Function to adjust latitude to -90 to 90; input in radians
    adjust_lat: function(x) {
      x = (Math.abs(x) < this.HALF_PI) ? x : (x - (this.sign(x) * this.PI));
      return x;
    },

    // Latitude Isometrique - close to tsfnz ...
    latiso: function(eccent, phi, sinphi) {
      if (Math.abs(phi) > this.HALF_PI) {
        return Number.NaN;
      }
      if (phi === this.HALF_PI) {
        return Number.POSITIVE_INFINITY;
      }
      if (phi === -1 * this.HALF_PI) {
        return Number.NEGATIVE_INFINITY;
      }

      var con = eccent * sinphi;
      return Math.log(Math.tan((this.HALF_PI + phi) / 2)) + eccent * Math.log((1 - con) / (1 + con)) / 2;
    },

    fL: function(x, L) {
      return 2 * Math.atan(x * Math.exp(L)) - this.HALF_PI;
    },

    // Inverse Latitude Isometrique - close to ph2z
    invlatiso: function(eccent, ts) {
      var phi = this.fL(1, ts);
      var Iphi = 0;
      var con = 0;
      do {
        Iphi = phi;
        con = eccent * Math.sin(Iphi);
        phi = this.fL(Math.exp(eccent * Math.log((1 + con) / (1 - con)) / 2), ts);
      } while (Math.abs(phi - Iphi) > 1.0e-12);
      return phi;
    },

    // Needed for Gauss Schreiber
    // Original:  Denis Makarov (info@binarythings.com)
    // Web Site:  http://www.binarythings.com
    sinh: function(x) {
      var r = Math.exp(x);
      r = (r - 1 / r) / 2;
      return r;
    },

    cosh: function(x) {
      var r = Math.exp(x);
      r = (r + 1 / r) / 2;
      return r;
    },

    tanh: function(x) {
      var r = Math.exp(x);
      r = (r - 1 / r) / (r + 1 / r);
      return r;
    },

    asinh: function(x) {
      var s = (x >= 0 ? 1 : -1);
      return s * (Math.log(Math.abs(x) + Math.sqrt(x * x + 1)));
    },

    acosh: function(x) {
      return 2 * Math.log(Math.sqrt((x + 1) / 2) + Math.sqrt((x - 1) / 2));
    },

    atanh: function(x) {
      return Math.log((x - 1) / (x + 1)) / 2;
    },

    // Grande Normale
    gN: function(a, e, sinphi) {
      var temp = e * sinphi;
      return a / Math.sqrt(1 - temp * temp);
    },

    //code from the PROJ.4 pj_mlfn.c file;  this may be useful for other projections
    pj_enfn: function(es) {
      var en = [];
      en[0] = this.C00 - es * (this.C02 + es * (this.C04 + es * (this.C06 + es * this.C08)));
      en[1] = es * (this.C22 - es * (this.C04 + es * (this.C06 + es * this.C08)));
      var t = es * es;
      en[2] = t * (this.C44 - es * (this.C46 + es * this.C48));
      t *= es;
      en[3] = t * (this.C66 - es * this.C68);
      en[4] = t * es * this.C88;
      return en;
    },

    pj_mlfn: function(phi, sphi, cphi, en) {
      cphi *= sphi;
      sphi *= sphi;
      return (en[0] * phi - cphi * (en[1] + sphi * (en[2] + sphi * (en[3] + sphi * en[4]))));
    },

    pj_inv_mlfn: function(arg, es, en) {
      var k = 1 / (1 - es);
      var phi = arg;
      for (var i = common.MAX_ITER; i; --i) { /* rarely goes over 2 iterations */
        var s = Math.sin(phi);
        var t = 1 - es * s * s;
        //t = this.pj_mlfn(phi, s, Math.cos(phi), en) - arg;
        //phi -= t * (t * Math.sqrt(t)) * k;
        t = (this.pj_mlfn(phi, s, Math.cos(phi), en) - arg) * (t * Math.sqrt(t)) * k;
        phi -= t;
        if (Math.abs(t) < common.EPSLN) {
          return phi;
        }
      }
      //proj4.reportError("cass:pj_inv_mlfn: Convergence error");
      return phi;
    },

    /**
     * Determine correction values
     * source: nad_intr.c (DGR: 2012-07-29)
     */
    nad_intr: function(pin, ct) {
      // force computation by decreasing by 1e-7 to be as closed as possible
      // from computation under C:C++ by leveraging rounding problems ...
      var t = {
        x: (pin.x - 1e-7) / ct.del[0],
        y: (pin.y - 1e-7) / ct.del[1]
      };
      var indx = {
        x: Math.floor(t.x),
        y: Math.floor(t.y)
      };
      var frct = {
        x: t.x - 1 * indx.x,
        y: t.y - 1 * indx.y
      };
      var val = {
        x: Number.NaN,
        y: Number.NaN
      };
      var inx;
      if (indx.x < 0) {
        if (!(indx.x === -1 && frct.x > 0.99999999999)) {
          return val;
        }
        indx.x++;
        frct.x = 0;
      }
      else {
        inx = indx.x + 1;
        if (inx >= ct.lim[0]) {
          if (!(inx === ct.lim[0] && frct.x < 1e-11)) {
            return val;
          }
          indx.x--;
          frct.x = 1;
        }
      }
      if (indx.y < 0) {
        if (!(indx.y === -1 && frct.y > 0.99999999999)) {
          return val;
        }
        indx.y++;
        frct.y = 0;
      }
      else {
        inx = indx.y + 1;
        if (inx >= ct.lim[1]) {
          if (!(inx === ct.lim[1] && frct.y < 1e-11)) {
            return val;
          }
          indx.y++;
          frct.y = 1;
        }
      }
      inx = (indx.y * ct.lim[0]) + indx.x;
      var f00 = {
        x: ct.cvs[inx][0],
        y: ct.cvs[inx][1]
      };
      inx++;
      var f10 = {
        x: ct.cvs[inx][0],
        y: ct.cvs[inx][1]
      };
      inx += ct.lim[0];
      var f11 = {
        x: ct.cvs[inx][0],
        y: ct.cvs[inx][1]
      };
      inx--;
      var f01 = {
        x: ct.cvs[inx][0],
        y: ct.cvs[inx][1]
      };
      var m11 = frct.x * frct.y,
        m10 = frct.x * (1 - frct.y),
        m00 = (1 - frct.x) * (1 - frct.y),
        m01 = (1 - frct.x) * frct.y;
      val.x = (m00 * f00.x + m10 * f10.x + m01 * f01.x + m11 * f11.x);
      val.y = (m00 * f00.y + m10 * f10.y + m01 * f01.y + m11 * f11.y);
      return val;
    },

    /**
     * Correct value
     * source: nad_cvt.c (DGR: 2012-07-29)
     */
    nad_cvt: function(pin, inverse, ct) {
      var val = {
        "x": Number.NaN,
        "y": Number.NaN
      };
      if (isNaN(pin.x)) {
        return val;
      }
      var tb = {
        "x": pin.x,
        "y": pin.y
      };
      tb.x -= ct.ll[0];
      tb.y -= ct.ll[1];
      tb.x = common.adjust_lon(tb.x - common.PI) + common.PI;
      var t = common.nad_intr(tb, ct);
      if (inverse) {
        if (isNaN(t.x)) {
          return val;
        }
        t.x = tb.x + t.x;
        t.y = tb.y - t.y;
        var i = 9,
          tol = 1e-12;
        var dif, del;
        do {
          del = common.nad_intr(t, ct);
          if (isNaN(del.x)) {
            this.reportError("Inverse grid shift iteration failed, presumably at grid edge.  Using first approximation.");
            break;
          }
          dif = {
            "x": t.x - del.x - tb.x,
            "y": t.y + del.y - tb.y
          };
          t.x -= dif.x;
          t.y -= dif.y;
        } while (i-- && Math.abs(dif.x) > tol && Math.abs(dif.y) > tol);
        if (i < 0) {
          this.reportError("Inverse grid shift iterator failed to converge.");
          return val;
        }
        val.x = common.adjust_lon(t.x + ct.ll[0]);
        val.y = t.y + ct.ll[1];
      }
      else {
        if (!isNaN(t.x)) {
          val.x = pin.x - t.x;
          val.y = pin.y + t.y;
        }
      }
      return val;
    },

    /* meridinal distance for ellipsoid and inverse
     **    8th degree - accurate to < 1e-5 meters when used in conjuction
     **		with typical major axis values.
     **	Inverse determines phi to EPS (1e-11) radians, about 1e-6 seconds.
     */
    C00: 1,
    C02: 0.25,
    C04: 0.046875,
    C06: 0.01953125,
    C08: 0.01068115234375,
    C22: 0.75,
    C44: 0.46875,
    C46: 0.01302083333333333333,
    C48: 0.00712076822916666666,
    C66: 0.36458333333333333333,
    C68: 0.00569661458333333333,
    C88: 0.3076171875

  };
  return common;
});

define('constants',[],function() {
  var proj4 = {};
  //var Proj = require('./Proj');
  proj4.PrimeMeridian = {
    "greenwich": 0.0, //"0dE",
    "lisbon": -9.131906111111, //"9d07'54.862\"W",
    "paris": 2.337229166667, //"2d20'14.025\"E",
    "bogota": -74.080916666667, //"74d04'51.3\"W",
    "madrid": -3.687938888889, //"3d41'16.58\"W",
    "rome": 12.452333333333, //"12d27'8.4\"E",
    "bern": 7.439583333333, //"7d26'22.5\"E",
    "jakarta": 106.807719444444, //"106d48'27.79\"E",
    "ferro": -17.666666666667, //"17d40'W",
    "brussels": 4.367975, //"4d22'4.71\"E",
    "stockholm": 18.058277777778, //"18d3'29.8\"E",
    "athens": 23.7163375, //"23d42'58.815\"E",
    "oslo": 10.722916666667 //"10d43'22.5\"E"
  };

  proj4.Ellipsoid = {
    "MERIT": {
      a: 6378137.0,
      rf: 298.257,
      ellipseName: "MERIT 1983"
    },
    "SGS85": {
      a: 6378136.0,
      rf: 298.257,
      ellipseName: "Soviet Geodetic System 85"
    },
    "GRS80": {
      a: 6378137.0,
      rf: 298.257222101,
      ellipseName: "GRS 1980(IUGG, 1980)"
    },
    "IAU76": {
      a: 6378140.0,
      rf: 298.257,
      ellipseName: "IAU 1976"
    },
    "airy": {
      a: 6377563.396,
      b: 6356256.910,
      ellipseName: "Airy 1830"
    },
    "APL4.": {
      a: 6378137,
      rf: 298.25,
      ellipseName: "Appl. Physics. 1965"
    },
    "NWL9D": {
      a: 6378145.0,
      rf: 298.25,
      ellipseName: "Naval Weapons Lab., 1965"
    },
    "mod_airy": {
      a: 6377340.189,
      b: 6356034.446,
      ellipseName: "Modified Airy"
    },
    "andrae": {
      a: 6377104.43,
      rf: 300.0,
      ellipseName: "Andrae 1876 (Den., Iclnd.)"
    },
    "aust_SA": {
      a: 6378160.0,
      rf: 298.25,
      ellipseName: "Australian Natl & S. Amer. 1969"
    },
    "GRS67": {
      a: 6378160.0,
      rf: 298.2471674270,
      ellipseName: "GRS 67(IUGG 1967)"
    },
    "bessel": {
      a: 6377397.155,
      rf: 299.1528128,
      ellipseName: "Bessel 1841"
    },
    "bess_nam": {
      a: 6377483.865,
      rf: 299.1528128,
      ellipseName: "Bessel 1841 (Namibia)"
    },
    "clrk66": {
      a: 6378206.4,
      b: 6356583.8,
      ellipseName: "Clarke 1866"
    },
    "clrk80": {
      a: 6378249.145,
      rf: 293.4663,
      ellipseName: "Clarke 1880 mod."
    },
    "CPM": {
      a: 6375738.7,
      rf: 334.29,
      ellipseName: "Comm. des Poids et Mesures 1799"
    },
    "delmbr": {
      a: 6376428.0,
      rf: 311.5,
      ellipseName: "Delambre 1810 (Belgium)"
    },
    "engelis": {
      a: 6378136.05,
      rf: 298.2566,
      ellipseName: "Engelis 1985"
    },
    "evrst30": {
      a: 6377276.345,
      rf: 300.8017,
      ellipseName: "Everest 1830"
    },
    "evrst48": {
      a: 6377304.063,
      rf: 300.8017,
      ellipseName: "Everest 1948"
    },
    "evrst56": {
      a: 6377301.243,
      rf: 300.8017,
      ellipseName: "Everest 1956"
    },
    "evrst69": {
      a: 6377295.664,
      rf: 300.8017,
      ellipseName: "Everest 1969"
    },
    "evrstSS": {
      a: 6377298.556,
      rf: 300.8017,
      ellipseName: "Everest (Sabah & Sarawak)"
    },
    "fschr60": {
      a: 6378166.0,
      rf: 298.3,
      ellipseName: "Fischer (Mercury Datum) 1960"
    },
    "fschr60m": {
      a: 6378155.0,
      rf: 298.3,
      ellipseName: "Fischer 1960"
    },
    "fschr68": {
      a: 6378150.0,
      rf: 298.3,
      ellipseName: "Fischer 1968"
    },
    "helmert": {
      a: 6378200.0,
      rf: 298.3,
      ellipseName: "Helmert 1906"
    },
    "hough": {
      a: 6378270.0,
      rf: 297.0,
      ellipseName: "Hough"
    },
    "intl": {
      a: 6378388.0,
      rf: 297.0,
      ellipseName: "International 1909 (Hayford)"
    },
    "kaula": {
      a: 6378163.0,
      rf: 298.24,
      ellipseName: "Kaula 1961"
    },
    "lerch": {
      a: 6378139.0,
      rf: 298.257,
      ellipseName: "Lerch 1979"
    },
    "mprts": {
      a: 6397300.0,
      rf: 191.0,
      ellipseName: "Maupertius 1738"
    },
    "new_intl": {
      a: 6378157.5,
      b: 6356772.2,
      ellipseName: "New International 1967"
    },
    "plessis": {
      a: 6376523.0,
      rf: 6355863.0,
      ellipseName: "Plessis 1817 (France)"
    },
    "krass": {
      a: 6378245.0,
      rf: 298.3,
      ellipseName: "Krassovsky, 1942"
    },
    "SEasia": {
      a: 6378155.0,
      b: 6356773.3205,
      ellipseName: "Southeast Asia"
    },
    "walbeck": {
      a: 6376896.0,
      b: 6355834.8467,
      ellipseName: "Walbeck"
    },
    "WGS60": {
      a: 6378165.0,
      rf: 298.3,
      ellipseName: "WGS 60"
    },
    "WGS66": {
      a: 6378145.0,
      rf: 298.25,
      ellipseName: "WGS 66"
    },
    "WGS72": {
      a: 6378135.0,
      rf: 298.26,
      ellipseName: "WGS 72"
    },
    "WGS84": {
      a: 6378137.0,
      rf: 298.257223563,
      ellipseName: "WGS 84"
    },
    "sphere": {
      a: 6370997.0,
      b: 6370997.0,
      ellipseName: "Normal Sphere (r=6370997)"
    }
  };

  proj4.Datum = {
    "wgs84": {
      towgs84: "0,0,0",
      ellipse: "WGS84",
      datumName: "WGS84"
    },
    "ch1903":{
      towgs84:"674.374,15.056,405.346",
      ellipse:"bessel",
      datumName:"swiss"
    },
    "ggrs87": {
      towgs84: "-199.87,74.79,246.62",
      ellipse: "GRS80",
      datumName: "Greek_Geodetic_Reference_System_1987"
    },
    "nad83": {
      towgs84: "0,0,0",
      ellipse: "GRS80",
      datumName: "North_American_Datum_1983"
    },
    "nad27": {
      nadgrids: "@conus,@alaska,@ntv2_0.gsb,@ntv1_can.dat",
      ellipse: "clrk66",
      datumName: "North_American_Datum_1927"
    },
    "potsdam": {
      towgs84: "606.0,23.0,413.0",
      ellipse: "bessel",
      datumName: "Potsdam Rauenberg 1950 DHDN"
    },
    "carthage": {
      towgs84: "-263.0,6.0,431.0",
      ellipse: "clark80",
      datumName: "Carthage 1934 Tunisia"
    },
    "hermannskogel": {
      towgs84: "653.0,-212.0,449.0",
      ellipse: "bessel",
      datumName: "Hermannskogel"
    },
    "ire65": {
      towgs84: "482.530,-130.596,564.557,-1.042,-0.214,-0.631,8.15",
      ellipse: "mod_airy",
      datumName: "Ireland 1965"
    },
    "rassadiran": {
      towgs84: "-133.63,-157.5,-158.62",
      ellipse: "intl",
      datumName: "Rassadiran"
    },
    "nzgd49": {
      towgs84: "59.47,-5.04,187.44,0.47,-0.1,1.024,-4.5993",
      ellipse: "intl",
      datumName: "New Zealand Geodetic Datum 1949"
    },
    "osgb36": {
      towgs84: "446.448,-125.157,542.060,0.1502,0.2470,0.8421,-20.4894",
      ellipse: "airy",
      datumName: "Airy 1830"
    },
    "s_jtsk":{
      towgs84:"589,76,480",
      ellipse:'bessel',
      datumName:'S-JTSK (Ferro)'
    },
    'beduaram':{
      towgs84:'-106,-87,188',
      ellipse:'clrk80',
      datumName:'Beduaram'
    },
    'gunung_segara':{
      towgs84:'-403,684,41',
      ellipse:'bessel',
      datumName:'Gunung Segara Jakarta'
    }
  };

  //proj4.WGS84 = Proj('WGS84');
  proj4.Datum.OSB36 = proj4.Datum.OSGB36; //as returned from spatialreference.org

  //lookup table to go from the projection name in WKT to the proj4 projection name
  //build this out as required
  proj4.wktProjections = {
    "Lambert Tangential Conformal Conic Projection": "lcc",
    "Lambert_Conformal_Conic": "lcc",
    "Lambert_Conformal_Conic_2SP":"lcc",
    "Mercator": "merc",
    "Popular Visualisation Pseudo Mercator": "merc",
    "Mercator_1SP": "merc",
    "Transverse_Mercator": "tmerc",
    "Transverse Mercator": "tmerc",
    "Lambert Azimuthal Equal Area": "laea",
    "Universal Transverse Mercator System": "utm",
    "Hotine_Oblique_Mercator":"omerc",
    "Hotine Oblique Mercator":"omerc",
    "Hotine_Oblique_Mercator_Azimuth_Natural_Origin":"omerc",
    'Hotine_Oblique_Mercator_Azimuth_Center':'omerc',
    "Van_der_Grinten_I":"vandg",
    "VanDerGrinten":"vandg",
    "Stereographic_North_Pole":"sterea",
    "Oblique_Stereographic":"sterea",
    'Polar_Stereographic':"sterea",
    "Polyconic":"poly",
    'New_Zealand_Map_Grid':'nzmg',
    'Miller_Cylindrical':'mill',
    'Krovak':'krovak',
    'Equirectangular':'eqc',
    'Equidistant_Cylindrical':'eqc',
    'Cassini':'cass',
    'Cassini_Soldner':'cass',
    'Azimuthal_Equidistant':'aeqd',
    'Albers_Conic_Equal_Area':'aea',
    'Albers':'aea',
    'Mollweide':'moll',
    'Lambert_Azimuthal_Equal_Area':'laea',
    'Sinusoidal':"sinu",
    "Equidistant_Conic":'eqdc'
  };

  // Based on proj4 CTABLE  structure :
  // FIXME: better to have array instead of object holding longitudes, latitudes members
  //        In the former case, one has to document index 0 is longitude and
  //        1 is latitude ...
  //        In the later case, grid object gets bigger !!!!
  //        Solution 1 is chosen based on pj_gridinfo.c
  proj4.grids = {
    "null": { // name of grid's file
      "ll": [-3.14159265, - 1.57079633], // lower-left coordinates in radians (longitude, latitude):
      "del": [3.14159265, 1.57079633], // cell's size in radians (longitude, latitude):
      "lim": [3, 3], // number of nodes in longitude, latitude (including edges):
      "count": 9, // total number of nodes
      "cvs": [ // shifts : in ntv2 reverse order : lon, lat in radians ...
        [0.0, 0.0],
        [0.0, 0.0],
        [0.0, 0.0], // for (lon= 0; lon<lim[0]; lon++) {
        [0.0, 0.0],
        [0.0, 0.0],
        [0.0, 0.0], //   for (lat= 0; lat<lim[1]; lat++) { p= cvs[lat*lim[0]+lon]; }
        [0.0, 0.0],
        [0.0, 0.0],
        [0.0, 0.0] // }
      ]
    }
  };
  return proj4;
});

define('global',[],function() {
  return function(defs) {
    defs('WGS84', "+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees");
    defs('EPSG:4326', "+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees");
    defs('EPSG:4269', "+title=NAD83 (long/lat) +proj=longlat +a=6378137.0 +b=6356752.31414036 +ellps=GRS80 +datum=NAD83 +units=degrees");
    defs('EPSG:3857', "+title=WGS 84 / Pseudo-Mercator +proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs");

    defs['EPSG:3785'] = defs['EPSG:3857']; // maintain backward compat, official code is 3857
    defs.GOOGLE = defs['EPSG:3857'];
    defs['EPSG:900913'] = defs['EPSG:3857'];
    defs['EPSG:102113'] = defs['EPSG:3857'];
  };
});

define('projString',['./common', './constants'], function(common, constants) {
  return function(defData) {
    var self = {};

    var paramObj = {};
    defData.split("+").map(function(v) {
      return v.trim();
    }).filter(function(a) {
      return a;
    }).forEach(function(a) {
      var split = a.split("=");
      if (split[1] === "@null") {
        return;
      }
      split.push(true);
      paramObj[split[0].toLowerCase()] = split[1];
    });
    var paramName, paramVal, paramOutname;
    var params = {
      proj: 'projName',
      datum: 'datumCode',
      rf: function(v) {
        self.rf = parseFloat(v, 10);
      },
      lat_0: function(v) {
        self.lat0 = v * common.D2R;
      },
      lat_1: function(v) {
        self.lat1 = v * common.D2R;
      },
      lat_2: function(v) {
        self.lat2 = v * common.D2R;
      },
      lat_ts: function(v) {
        self.lat_ts = v * common.D2R;
      },
      lon_0: function(v) {
        self.long0 = v * common.D2R;
      },
      lon_1: function(v) {
        self.long1 = v * common.D2R;
      },
      lon_2: function(v) {
        self.long2 = v * common.D2R;
      },
      alpha: function(v) {
        self.alpha = parseFloat(v) * common.D2R;
      },
      lonc: function(v) {
        self.longc = v * common.D2R;
      },
      x_0: function(v) {
        self.x0 = parseFloat(v, 10);
      },
      y_0: function(v) {
        self.y0 = parseFloat(v, 10);
      },
      k_0: function(v) {
        self.k0 = parseFloat(v, 10);
      },
      k: function(v) {
        self.k0 = parseFloat(v, 10);
      },
      r_a: function() {
        self.R_A = true;
      },
      zone: function(v) {
        self.zone = parseInt(v, 10);
      },
      south: function() {
        self.utmSouth = true;
      },
      towgs84: function(v) {
        self.datum_params = v.split(",").map(function(a) {
          return parseFloat(a, 10);
        });
      },
      to_meter: function(v) {
        self.to_meter = parseFloat(v, 10);
      },
      from_greenwich: function(v) {
        self.from_greenwich = v * common.D2R;
      },
      pm: function(v) {
        self.from_greenwich = (constants.PrimeMeridian[v] ? constants.PrimeMeridian[v] : parseFloat(v, 10)) * common.D2R;
      },
      axis: function(v) {
        var legalAxis = "ewnsud";
        if (v.length === 3 && legalAxis.indexOf(v.substr(0, 1)) !== -1 && legalAxis.indexOf(v.substr(1, 1)) !== -1 && legalAxis.indexOf(v.substr(2, 1)) !== -1) {
          self.axis = v;
        }
      }
    };
    for (paramName in paramObj) {
      paramVal = paramObj[paramName];
      if (paramName in params) {
        paramOutname = params[paramName];
        if (typeof paramOutname === 'function') {
          paramOutname(paramVal);
        }
        else {
          self[paramOutname] = paramVal;
        }
      }
      else {
        self[paramName] = paramVal;
      }
    }
    return self;
  };
});
define('defs',['./common','./constants','./global','./projString'],function(common, constants,globals,parseProj) {

  function defs(name) {
    /*global console*/
    var that = this;
    if (arguments.length === 2) {
      defs[name] = parseProj(arguments[1]);
    }
    else if (arguments.length === 1) {
      if (Array.isArray(name)) {
        return name.map(function(v) {
          if (Array.isArray(v)) {
            defs.apply(that, v);
          }
          else {
            defs(v);
          }
        });
      }
      else if (typeof name === 'string') {
       
      }
      else if ('EPSG' in name) {
        defs['EPSG:' + name.EPSG] = name;
      }
      else if ('ESRI' in name) {
        defs['ESRI:' + name.ESRI] = name;
      }
      else if ('IAU2000' in name) {
        defs['IAU2000:' + name.IAU2000] = name;
      }
      else {
        console.log(name);
      }
      return;
    }
    
  
  }
  globals(defs);
  return defs;
});

define('datum',['./common'],function(common) {
  var datum = function(proj) {
    if (!(this instanceof datum)) {
      return new datum(proj);
    }
    this.datum_type = common.PJD_WGS84; //default setting
    if (!proj) {
      return;
    }
    if (proj.datumCode && proj.datumCode === 'none') {
      this.datum_type = common.PJD_NODATUM;
    }
    if (proj.datum_params) {
      for (var i = 0; i < proj.datum_params.length; i++) {
        proj.datum_params[i] = parseFloat(proj.datum_params[i]);
      }
      if (proj.datum_params[0] !== 0 || proj.datum_params[1] !== 0 || proj.datum_params[2] !== 0) {
        this.datum_type = common.PJD_3PARAM;
      }
      if (proj.datum_params.length > 3) {
        if (proj.datum_params[3] !== 0 || proj.datum_params[4] !== 0 || proj.datum_params[5] !== 0 || proj.datum_params[6] !== 0) {
          this.datum_type = common.PJD_7PARAM;
          proj.datum_params[3] *= common.SEC_TO_RAD;
          proj.datum_params[4] *= common.SEC_TO_RAD;
          proj.datum_params[5] *= common.SEC_TO_RAD;
          proj.datum_params[6] = (proj.datum_params[6] / 1000000.0) + 1.0;
        }
      }
    }
    // DGR 2011-03-21 : nadgrids support
    this.datum_type = proj.grids ? common.PJD_GRIDSHIFT : this.datum_type;

    this.a = proj.a; //datum object also uses these values
    this.b = proj.b;
    this.es = proj.es;
    this.ep2 = proj.ep2;
    this.datum_params = proj.datum_params;
    if (this.datum_type === common.PJD_GRIDSHIFT) {
      this.grids = proj.grids;
    }
  };
  datum.prototype = {


    /****************************************************************/
    // cs_compare_datums()
    //   Returns TRUE if the two datums match, otherwise FALSE.
    compare_datums: function(dest) {
      if (this.datum_type !== dest.datum_type) {
        return false; // false, datums are not equal
      }
      else if (this.a !== dest.a || Math.abs(this.es - dest.es) > 0.000000000050) {
        // the tolerence for es is to ensure that GRS80 and WGS84
        // are considered identical
        return false;
      }
      else if (this.datum_type === common.PJD_3PARAM) {
        return (this.datum_params[0] === dest.datum_params[0] && this.datum_params[1] === dest.datum_params[1] && this.datum_params[2] === dest.datum_params[2]);
      }
      else if (this.datum_type === common.PJD_7PARAM) {
        return (this.datum_params[0] === dest.datum_params[0] && this.datum_params[1] === dest.datum_params[1] && this.datum_params[2] === dest.datum_params[2] && this.datum_params[3] === dest.datum_params[3] && this.datum_params[4] === dest.datum_params[4] && this.datum_params[5] === dest.datum_params[5] && this.datum_params[6] === dest.datum_params[6]);
      }
      else if (this.datum_type === common.PJD_GRIDSHIFT || dest.datum_type === common.PJD_GRIDSHIFT) {
        //alert("ERROR: Grid shift transformations are not implemented.");
        //return false
        //DGR 2012-07-29 lazy ...
        return this.nadgrids === dest.nadgrids;
      }
      else {
        return true; // datums are equal
      }
    }, // cs_compare_datums()

    /*
     * The function Convert_Geodetic_To_Geocentric converts geodetic coordinates
     * (latitude, longitude, and height) to geocentric coordinates (X, Y, Z),
     * according to the current ellipsoid parameters.
     *
     *    Latitude  : Geodetic latitude in radians                     (input)
     *    Longitude : Geodetic longitude in radians                    (input)
     *    Height    : Geodetic height, in meters                       (input)
     *    X         : Calculated Geocentric X coordinate, in meters    (output)
     *    Y         : Calculated Geocentric Y coordinate, in meters    (output)
     *    Z         : Calculated Geocentric Z coordinate, in meters    (output)
     *
     */
    geodetic_to_geocentric: function(p) {
      var Longitude = p.x;
      var Latitude = p.y;
      var Height = p.z ? p.z : 0; //Z value not always supplied
      var X; // output
      var Y;
      var Z;

      var Error_Code = 0; //  GEOCENT_NO_ERROR;
      var Rn; /*  Earth radius at location  */
      var Sin_Lat; /*  Math.sin(Latitude)  */
      var Sin2_Lat; /*  Square of Math.sin(Latitude)  */
      var Cos_Lat; /*  Math.cos(Latitude)  */

      /*
       ** Don't blow up if Latitude is just a little out of the value
       ** range as it may just be a rounding issue.  Also removed longitude
       ** test, it should be wrapped by Math.cos() and Math.sin().  NFW for PROJ.4, Sep/2001.
       */
      if (Latitude < -common.HALF_PI && Latitude > -1.001 * common.HALF_PI) {
        Latitude = -common.HALF_PI;
      }
      else if (Latitude > common.HALF_PI && Latitude < 1.001 * common.HALF_PI) {
        Latitude = common.HALF_PI;
      }
      else if ((Latitude < -common.HALF_PI) || (Latitude > common.HALF_PI)) {
        /* Latitude out of range */
        //proj4.reportError('geocent:lat out of range:' + Latitude);
        return null;
      }

      if (Longitude > common.PI) {
        Longitude -= (2 * common.PI);
      }
      Sin_Lat = Math.sin(Latitude);
      Cos_Lat = Math.cos(Latitude);
      Sin2_Lat = Sin_Lat * Sin_Lat;
      Rn = this.a / (Math.sqrt(1.0e0 - this.es * Sin2_Lat));
      X = (Rn + Height) * Cos_Lat * Math.cos(Longitude);
      Y = (Rn + Height) * Cos_Lat * Math.sin(Longitude);
      Z = ((Rn * (1 - this.es)) + Height) * Sin_Lat;

      p.x = X;
      p.y = Y;
      p.z = Z;
      return Error_Code;
    }, // cs_geodetic_to_geocentric()


    geocentric_to_geodetic: function(p) {
      /* local defintions and variables */
      /* end-criterium of loop, accuracy of sin(Latitude) */
      var genau = 1e-12;
      var genau2 = (genau * genau);
      var maxiter = 30;

      var P; /* distance between semi-minor axis and location */
      var RR; /* distance between center and location */
      var CT; /* sin of geocentric latitude */
      var ST; /* cos of geocentric latitude */
      var RX;
      var RK;
      var RN; /* Earth radius at location */
      var CPHI0; /* cos of start or old geodetic latitude in iterations */
      var SPHI0; /* sin of start or old geodetic latitude in iterations */
      var CPHI; /* cos of searched geodetic latitude */
      var SPHI; /* sin of searched geodetic latitude */
      var SDPHI; /* end-criterium: addition-theorem of sin(Latitude(iter)-Latitude(iter-1)) */
      var At_Pole; /* indicates location is in polar region */
      var iter; /* # of continous iteration, max. 30 is always enough (s.a.) */

      var X = p.x;
      var Y = p.y;
      var Z = p.z ? p.z : 0.0; //Z value not always supplied
      var Longitude;
      var Latitude;
      var Height;

      At_Pole = false;
      P = Math.sqrt(X * X + Y * Y);
      RR = Math.sqrt(X * X + Y * Y + Z * Z);

      /*      special cases for latitude and longitude */
      if (P / this.a < genau) {

        /*  special case, if P=0. (X=0., Y=0.) */
        At_Pole = true;
        Longitude = 0.0;

        /*  if (X,Y,Z)=(0.,0.,0.) then Height becomes semi-minor axis
         *  of ellipsoid (=center of mass), Latitude becomes PI/2 */
        if (RR / this.a < genau) {
          Latitude = common.HALF_PI;
          Height = -this.b;
          return;
        }
      }
      else {
        /*  ellipsoidal (geodetic) longitude
         *  interval: -PI < Longitude <= +PI */
        Longitude = Math.atan2(Y, X);
      }

      /* --------------------------------------------------------------
       * Following iterative algorithm was developped by
       * "Institut for Erdmessung", University of Hannover, July 1988.
       * Internet: www.ife.uni-hannover.de
       * Iterative computation of CPHI,SPHI and Height.
       * Iteration of CPHI and SPHI to 10**-12 radian resp.
       * 2*10**-7 arcsec.
       * --------------------------------------------------------------
       */
      CT = Z / RR;
      ST = P / RR;
      RX = 1.0 / Math.sqrt(1.0 - this.es * (2.0 - this.es) * ST * ST);
      CPHI0 = ST * (1.0 - this.es) * RX;
      SPHI0 = CT * RX;
      iter = 0;

      /* loop to find sin(Latitude) resp. Latitude
       * until |sin(Latitude(iter)-Latitude(iter-1))| < genau */
      do {
        iter++;
        RN = this.a / Math.sqrt(1.0 - this.es * SPHI0 * SPHI0);

        /*  ellipsoidal (geodetic) height */
        Height = P * CPHI0 + Z * SPHI0 - RN * (1.0 - this.es * SPHI0 * SPHI0);

        RK = this.es * RN / (RN + Height);
        RX = 1.0 / Math.sqrt(1.0 - RK * (2.0 - RK) * ST * ST);
        CPHI = ST * (1.0 - RK) * RX;
        SPHI = CT * RX;
        SDPHI = SPHI * CPHI0 - CPHI * SPHI0;
        CPHI0 = CPHI;
        SPHI0 = SPHI;
      }
      while (SDPHI * SDPHI > genau2 && iter < maxiter);

      /*      ellipsoidal (geodetic) latitude */
      Latitude = Math.atan(SPHI / Math.abs(CPHI));

      p.x = Longitude;
      p.y = Latitude;
      p.z = Height;
      return p;
    }, // cs_geocentric_to_geodetic()

    /** Convert_Geocentric_To_Geodetic
     * The method used here is derived from 'An Improved Algorithm for
     * Geocentric to Geodetic Coordinate Conversion', by Ralph Toms, Feb 1996
     */
    geocentric_to_geodetic_noniter: function(p) {
      var X = p.x;
      var Y = p.y;
      var Z = p.z ? p.z : 0; //Z value not always supplied
      var Longitude;
      var Latitude;
      var Height;

      var W; /* distance from Z axis */
      var W2; /* square of distance from Z axis */
      var T0; /* initial estimate of vertical component */
      var T1; /* corrected estimate of vertical component */
      var S0; /* initial estimate of horizontal component */
      var S1; /* corrected estimate of horizontal component */
      var Sin_B0; /* Math.sin(B0), B0 is estimate of Bowring aux variable */
      var Sin3_B0; /* cube of Math.sin(B0) */
      var Cos_B0; /* Math.cos(B0) */
      var Sin_p1; /* Math.sin(phi1), phi1 is estimated latitude */
      var Cos_p1; /* Math.cos(phi1) */
      var Rn; /* Earth radius at location */
      var Sum; /* numerator of Math.cos(phi1) */
      var At_Pole; /* indicates location is in polar region */

      X = parseFloat(X); // cast from string to float
      Y = parseFloat(Y);
      Z = parseFloat(Z);

      At_Pole = false;
      if (X !== 0.0) {
        Longitude = Math.atan2(Y, X);
      }
      else {
        if (Y > 0) {
          Longitude = common.HALF_PI;
        }
        else if (Y < 0) {
          Longitude = -common.HALF_PI;
        }
        else {
          At_Pole = true;
          Longitude = 0.0;
          if (Z > 0.0) { /* north pole */
            Latitude = common.HALF_PI;
          }
          else if (Z < 0.0) { /* south pole */
            Latitude = -common.HALF_PI;
          }
          else { /* center of earth */
            Latitude = common.HALF_PI;
            Height = -this.b;
            return;
          }
        }
      }
      W2 = X * X + Y * Y;
      W = Math.sqrt(W2);
      T0 = Z * common.AD_C;
      S0 = Math.sqrt(T0 * T0 + W2);
      Sin_B0 = T0 / S0;
      Cos_B0 = W / S0;
      Sin3_B0 = Sin_B0 * Sin_B0 * Sin_B0;
      T1 = Z + this.b * this.ep2 * Sin3_B0;
      Sum = W - this.a * this.es * Cos_B0 * Cos_B0 * Cos_B0;
      S1 = Math.sqrt(T1 * T1 + Sum * Sum);
      Sin_p1 = T1 / S1;
      Cos_p1 = Sum / S1;
      Rn = this.a / Math.sqrt(1.0 - this.es * Sin_p1 * Sin_p1);
      if (Cos_p1 >= common.COS_67P5) {
        Height = W / Cos_p1 - Rn;
      }
      else if (Cos_p1 <= -common.COS_67P5) {
        Height = W / -Cos_p1 - Rn;
      }
      else {
        Height = Z / Sin_p1 + Rn * (this.es - 1.0);
      }
      if (At_Pole === false) {
        Latitude = Math.atan(Sin_p1 / Cos_p1);
      }

      p.x = Longitude;
      p.y = Latitude;
      p.z = Height;
      return p;
    }, // geocentric_to_geodetic_noniter()

    /****************************************************************/
    // pj_geocentic_to_wgs84( p )
    //  p = point to transform in geocentric coordinates (x,y,z)
    geocentric_to_wgs84: function(p) {

      if (this.datum_type === common.PJD_3PARAM) {
        // if( x[io] === HUGE_VAL )
        //    continue;
        p.x += this.datum_params[0];
        p.y += this.datum_params[1];
        p.z += this.datum_params[2];

      }
      else if (this.datum_type === common.PJD_7PARAM) {
        var Dx_BF = this.datum_params[0];
        var Dy_BF = this.datum_params[1];
        var Dz_BF = this.datum_params[2];
        var Rx_BF = this.datum_params[3];
        var Ry_BF = this.datum_params[4];
        var Rz_BF = this.datum_params[5];
        var M_BF = this.datum_params[6];
        // if( x[io] === HUGE_VAL )
        //    continue;
        var x_out = M_BF * (p.x - Rz_BF * p.y + Ry_BF * p.z) + Dx_BF;
        var y_out = M_BF * (Rz_BF * p.x + p.y - Rx_BF * p.z) + Dy_BF;
        var z_out = M_BF * (-Ry_BF * p.x + Rx_BF * p.y + p.z) + Dz_BF;
        p.x = x_out;
        p.y = y_out;
        p.z = z_out;
      }
    }, // cs_geocentric_to_wgs84

    /****************************************************************/
    // pj_geocentic_from_wgs84()
    //  coordinate system definition,
    //  point to transform in geocentric coordinates (x,y,z)
    geocentric_from_wgs84: function(p) {

      if (this.datum_type === common.PJD_3PARAM) {
        //if( x[io] === HUGE_VAL )
        //    continue;
        p.x -= this.datum_params[0];
        p.y -= this.datum_params[1];
        p.z -= this.datum_params[2];

      }
      else if (this.datum_type === common.PJD_7PARAM) {
        var Dx_BF = this.datum_params[0];
        var Dy_BF = this.datum_params[1];
        var Dz_BF = this.datum_params[2];
        var Rx_BF = this.datum_params[3];
        var Ry_BF = this.datum_params[4];
        var Rz_BF = this.datum_params[5];
        var M_BF = this.datum_params[6];
        var x_tmp = (p.x - Dx_BF) / M_BF;
        var y_tmp = (p.y - Dy_BF) / M_BF;
        var z_tmp = (p.z - Dz_BF) / M_BF;
        //if( x[io] === HUGE_VAL )
        //    continue;

        p.x = x_tmp + Rz_BF * y_tmp - Ry_BF * z_tmp;
        p.y = -Rz_BF * x_tmp + y_tmp + Rx_BF * z_tmp;
        p.z = Ry_BF * x_tmp - Rx_BF * y_tmp + z_tmp;
      } //cs_geocentric_from_wgs84()
    }
  };

  /** point object, nothing fancy, just allows values to be
    passed back and forth by reference rather than by value.
    Other point classes may be used as long as they have
    x and y properties, which will get modified in the transform method.
*/
  return datum;
});

define('projCode/longlat',['require','exports','module'],function(require, exports) {
  exports.init = function() {
    //no-op for longlat
  };
  function identity(pt){
    return pt;
  }
  exports.forward = identity;
  exports.inverse = identity;
});
define('projCode/tmerc',['../common'],function(common) {
  return {
    init: function() {
      this.e0 = common.e0fn(this.es);
      this.e1 = common.e1fn(this.es);
      this.e2 = common.e2fn(this.es);
      this.e3 = common.e3fn(this.es);
      this.ml0 = this.a * common.mlfn(this.e0, this.e1, this.e2, this.e3, this.lat0);
    },

    /**
    Transverse Mercator Forward  - long/lat to x/y
    long/lat in radians
  */
    forward: function(p) {
      var lon = p.x;
      var lat = p.y;

      var delta_lon = common.adjust_lon(lon - this.long0); // Delta longitude
      var con; // cone constant
      var x, y;
      var sin_phi = Math.sin(lat);
      var cos_phi = Math.cos(lat);

      if (this.sphere) { /* spherical form */
        var b = cos_phi * Math.sin(delta_lon);
        if ((Math.abs(Math.abs(b) - 1)) < 0.0000000001) {
          //proj4.reportError("tmerc:forward: Point projects into infinity");
          return (93);
        }
        else {
          x = 0.5 * this.a * this.k0 * Math.log((1 + b) / (1 - b));
          con = Math.acos(cos_phi * Math.cos(delta_lon) / Math.sqrt(1 - b * b));
          if (lat < 0) {
            con = -con;
          }
          y = this.a * this.k0 * (con - this.lat0);
        }
      }
      else {
        var al = cos_phi * delta_lon;
        var als = Math.pow(al, 2);
        var c = this.ep2 * Math.pow(cos_phi, 2);
        var tq = Math.tan(lat);
        var t = Math.pow(tq, 2);
        con = 1 - this.es * Math.pow(sin_phi, 2);
        var n = this.a / Math.sqrt(con);
        var ml = this.a * common.mlfn(this.e0, this.e1, this.e2, this.e3, lat);

        x = this.k0 * n * al * (1 + als / 6 * (1 - t + c + als / 20 * (5 - 18 * t + Math.pow(t, 2) + 72 * c - 58 * this.ep2))) + this.x0;
        y = this.k0 * (ml - this.ml0 + n * tq * (als * (0.5 + als / 24 * (5 - t + 9 * c + 4 * Math.pow(c, 2) + als / 30 * (61 - 58 * t + Math.pow(t, 2) + 600 * c - 330 * this.ep2))))) + this.y0;

      }
      p.x = x;
      p.y = y;
      return p;
    }, // tmercFwd()

    /**
    Transverse Mercator Inverse  -  x/y to long/lat
  */
    inverse: function(p) {
      var con, phi; /* temporary angles       */
      var delta_phi; /* difference between longitudes    */
      var i;
      var max_iter = 6; /* maximun number of iterations */
      var lat, lon;

      if (this.sphere) { /* spherical form */
        var f = Math.exp(p.x / (this.a * this.k0));
        var g = 0.5 * (f - 1 / f);
        var temp = this.lat0 + p.y / (this.a * this.k0);
        var h = Math.cos(temp);
        con = Math.sqrt((1 - h * h) / (1 + g * g));
        lat = common.asinz(con);
        if (temp < 0) {
          lat = -lat;
        }
        if ((g === 0) && (h === 0)) {
          lon = this.long0;
        }
        else {
          lon = common.adjust_lon(Math.atan2(g, h) + this.long0);
        }
      }
      else { // ellipsoidal form
        var x = p.x - this.x0;
        var y = p.y - this.y0;

        con = (this.ml0 + y / this.k0) / this.a;
        phi = con;
        for (i = 0; true; i++) {
          delta_phi = ((con + this.e1 * Math.sin(2 * phi) - this.e2 * Math.sin(4 * phi) + this.e3 * Math.sin(6 * phi)) / this.e0) - phi;
          phi += delta_phi;
          if (Math.abs(delta_phi) <= common.EPSLN) {
            break;
          }
          if (i >= max_iter) {
            //proj4.reportError("tmerc:inverse: Latitude failed to converge");
            return (95);
          }
        } // for()
        if (Math.abs(phi) < common.HALF_PI) {
          // sincos(phi, &sin_phi, &cos_phi);
          var sin_phi = Math.sin(phi);
          var cos_phi = Math.cos(phi);
          var tan_phi = Math.tan(phi);
          var c = this.ep2 * Math.pow(cos_phi, 2);
          var cs = Math.pow(c, 2);
          var t = Math.pow(tan_phi, 2);
          var ts = Math.pow(t, 2);
          con = 1 - this.es * Math.pow(sin_phi, 2);
          var n = this.a / Math.sqrt(con);
          var r = n * (1 - this.es) / con;
          var d = x / (n * this.k0);
          var ds = Math.pow(d, 2);
          lat = phi - (n * tan_phi * ds / r) * (0.5 - ds / 24 * (5 + 3 * t + 10 * c - 4 * cs - 9 * this.ep2 - ds / 30 * (61 + 90 * t + 298 * c + 45 * ts - 252 * this.ep2 - 3 * cs)));
          lon = common.adjust_lon(this.long0 + (d * (1 - ds / 6 * (1 + 2 * t + c - ds / 20 * (5 - 2 * c + 28 * t - 3 * cs + 8 * this.ep2 + 24 * ts))) / cos_phi));
        }
        else {
          lat = common.HALF_PI * common.sign(y);
          lon = this.long0;
        }
      }
      p.x = lon;
      p.y = lat;
      return p;
    } // tmercInv()
  };
});

define('projCode/utm',['../common','./tmerc'],function(common,tmerc) {
  return {

    dependsOn: 'tmerc',

    init: function() {
      if (!this.zone) {
        //proj4.reportError("utm:init: zone must be specified for UTM");
        return;
      }
      this.lat0 = 0;
      this.long0 = ((6 * Math.abs(this.zone)) - 183) * common.D2R;
      this.x0 = 500000;
      this.y0 = this.utmSouth ? 10000000 : 0;
      this.k0 = 0.9996;

      tmerc.init.apply(this);
      this.forward = tmerc.forward;
      this.inverse = tmerc.inverse;
    }
  };
});

define('projCode/gauss',['../common'],function(common) {
  return {

    init: function() {
      var sphi = Math.sin(this.lat0);
      var cphi = Math.cos(this.lat0);
      cphi *= cphi;
      this.rc = Math.sqrt(1 - this.es) / (1 - this.es * sphi * sphi);
      this.C = Math.sqrt(1 + this.es * cphi * cphi / (1 - this.es));
      this.phic0 = Math.asin(sphi / this.C);
      this.ratexp = 0.5 * this.C * this.e;
      this.K = Math.tan(0.5 * this.phic0 + common.FORTPI) / (Math.pow(Math.tan(0.5 * this.lat0 + common.FORTPI), this.C) * common.srat(this.e * sphi, this.ratexp));
    },

    forward: function(p) {
      var lon = p.x;
      var lat = p.y;

      p.y = 2 * Math.atan(this.K * Math.pow(Math.tan(0.5 * lat + common.FORTPI), this.C) * common.srat(this.e * Math.sin(lat), this.ratexp)) - common.HALF_PI;
      p.x = this.C * lon;
      return p;
    },

    inverse: function(p) {
      var DEL_TOL = 1e-14;
      var lon = p.x / this.C;
      var lat = p.y;
      var num = Math.pow(Math.tan(0.5 * lat + common.FORTPI) / this.K, 1 / this.C);
      for (var i = common.MAX_ITER; i > 0; --i) {
        lat = 2 * Math.atan(num * common.srat(this.e * Math.sin(p.y), - 0.5 * this.e)) - common.HALF_PI;
        if (Math.abs(lat - p.y) < DEL_TOL) {
          break;
        }
        p.y = lat;
      }
      /* convergence failed */
      if (!i) {
        //proj4.reportError("gauss:inverse:convergence failed");
        return null;
      }
      p.x = lon;
      p.y = lat;
      return p;
    }
  };

});

define('projCode/sterea',['../common','./gauss'],function(common,gauss) {
  return {

    init: function() {
      gauss.init.apply(this);
      if (!this.rc) {
        //proj4.reportError("sterea:init:E_ERROR_0");
        return;
      }
      this.sinc0 = Math.sin(this.phic0);
      this.cosc0 = Math.cos(this.phic0);
      this.R2 = 2 * this.rc;
      if (!this.title) {
        this.title = "Oblique Stereographic Alternative";
      }
    },

    forward: function(p) {
      var sinc, cosc, cosl, k;
      p.x = common.adjust_lon(p.x - this.long0); /* adjust del longitude */
      gauss.forward.apply(this, [p]);
      sinc = Math.sin(p.y);
      cosc = Math.cos(p.y);
      cosl = Math.cos(p.x);
      k = this.k0 * this.R2 / (1 + this.sinc0 * sinc + this.cosc0 * cosc * cosl);
      p.x = k * cosc * Math.sin(p.x);
      p.y = k * (this.cosc0 * sinc - this.sinc0 * cosc * cosl);
      p.x = this.a * p.x + this.x0;
      p.y = this.a * p.y + this.y0;
      return p;
    },

    inverse: function(p) {
      var sinc, cosc, lon, lat, rho;
      p.x = (p.x - this.x0) / this.a; /* descale and de-offset */
      p.y = (p.y - this.y0) / this.a;

      p.x /= this.k0;
      p.y /= this.k0;
      if ((rho = Math.sqrt(p.x * p.x + p.y * p.y))) {
        var c = 2 * Math.atan2(rho, this.R2);
        sinc = Math.sin(c);
        cosc = Math.cos(c);
        lat = Math.asin(cosc * this.sinc0 + p.y * sinc * this.cosc0 / rho);
        lon = Math.atan2(p.x * sinc, rho * this.cosc0 * cosc - p.y * this.sinc0 * sinc);
      }
      else {
        lat = this.phic0;
        lon = 0;
      }

      p.x = lon;
      p.y = lat;
      gauss.inverse.apply(this, [p]);
      p.x = common.adjust_lon(p.x + this.long0); /* adjust longitude to CM */
      return p;
    }
  };


});

define('projCode/somerc',[],function() {
  /*
  references:
    Formules et constantes pour le Calcul pour la
    projection cylindrique conforme à axe oblique et pour la transformation entre
    des systèmes de référence.
    http://www.swisstopo.admin.ch/internet/swisstopo/fr/home/topics/survey/sys/refsys/switzerland.parsysrelated1.31216.downloadList.77004.DownloadFile.tmp/swissprojectionfr.pdf
  */
  return {

    init: function() {
      var phy0 = this.lat0;
      this.lambda0 = this.long0;
      var sinPhy0 = Math.sin(phy0);
      var semiMajorAxis = this.a;
      var invF = this.rf;
      var flattening = 1 / invF;
      var e2 = 2 * flattening - Math.pow(flattening, 2);
      var e = this.e = Math.sqrt(e2);
      this.R = this.k0 * semiMajorAxis * Math.sqrt(1 - e2) / (1 - e2 * Math.pow(sinPhy0, 2));
      this.alpha = Math.sqrt(1 + e2 / (1 - e2) * Math.pow(Math.cos(phy0), 4));
      this.b0 = Math.asin(sinPhy0 / this.alpha);
      var k1 = Math.log(Math.tan(Math.PI / 4 + this.b0 / 2));
      var k2 = Math.log(Math.tan(Math.PI / 4 + phy0 / 2));
      var k3 = Math.log((1 + e * sinPhy0) / (1 - e * sinPhy0));
      this.K = k1 - this.alpha * k2 + this.alpha * e / 2 * k3;
    },


    forward: function(p) {
      var Sa1 = Math.log(Math.tan(Math.PI / 4 - p.y / 2));
      var Sa2 = this.e / 2 * Math.log((1 + this.e * Math.sin(p.y)) / (1 - this.e * Math.sin(p.y)));
      var S = -this.alpha * (Sa1 + Sa2) + this.K;

      // spheric latitude
      var b = 2 * (Math.atan(Math.exp(S)) - Math.PI / 4);

      // spheric longitude
      var I = this.alpha * (p.x - this.lambda0);

      // psoeudo equatorial rotation
      var rotI = Math.atan(Math.sin(I) / (Math.sin(this.b0) * Math.tan(b) + Math.cos(this.b0) * Math.cos(I)));

      var rotB = Math.asin(Math.cos(this.b0) * Math.sin(b) - Math.sin(this.b0) * Math.cos(b) * Math.cos(I));

      p.y = this.R / 2 * Math.log((1 + Math.sin(rotB)) / (1 - Math.sin(rotB))) + this.y0;
      p.x = this.R * rotI + this.x0;
      return p;
    },

    inverse: function(p) {
      var Y = p.x - this.x0;
      var X = p.y - this.y0;

      var rotI = Y / this.R;
      var rotB = 2 * (Math.atan(Math.exp(X / this.R)) - Math.PI / 4);

      var b = Math.asin(Math.cos(this.b0) * Math.sin(rotB) + Math.sin(this.b0) * Math.cos(rotB) * Math.cos(rotI));
      var I = Math.atan(Math.sin(rotI) / (Math.cos(this.b0) * Math.cos(rotI) - Math.sin(this.b0) * Math.tan(rotB)));

      var lambda = this.lambda0 + I / this.alpha;

      var S = 0;
      var phy = b;
      var prevPhy = -1000;
      var iteration = 0;
      while (Math.abs(phy - prevPhy) > 0.0000001) {
        if (++iteration > 20) {
          //proj4.reportError("omercFwdInfinity");
          return;
        }
        //S = Math.log(Math.tan(Math.PI / 4 + phy / 2));
        S = 1 / this.alpha * (Math.log(Math.tan(Math.PI / 4 + b / 2)) - this.K) + this.e * Math.log(Math.tan(Math.PI / 4 + Math.asin(this.e * Math.sin(phy)) / 2));
        prevPhy = phy;
        phy = 2 * Math.atan(Math.exp(S)) - Math.PI / 2;
      }

      p.x = lambda;
      p.y = phy;
      return p;
    }
  };

});

define('projCode/omerc',['../common'],function(common) {
  return {

    /* Initialize the Oblique Mercator  projection
    ------------------------------------------*/
    init: function() {
      this.no_off = this.no_off || false;
      this.no_rot = this.no_rot || false;

      if (isNaN(this.k0)) {
        this.k0 = 1;
      }
      var sinlat = Math.sin(this.lat0);
      var coslat = Math.cos(this.lat0);
      var con = this.e * sinlat;

      this.bl = Math.sqrt(1 + this.es / (1 - this.es) * Math.pow(coslat, 4));
      this.al = this.a * this.bl * this.k0 * Math.sqrt(1 - this.es) / (1 - con * con);
      var t0 = common.tsfnz(this.e, this.lat0, sinlat);
      var dl = this.bl / coslat * Math.sqrt((1 - this.es) / (1 - con * con));
      if (dl * dl < 1) {
        dl = 1;
      }
      var fl;
      var gl;
      if (!isNaN(this.longc)) {
        //Central point and azimuth method

        if (this.lat0 >= 0) {
          fl = dl + Math.sqrt(dl * dl - 1);
        }
        else {
          fl = dl - Math.sqrt(dl * dl - 1);
        }
        this.el = fl * Math.pow(t0, this.bl);
        gl = 0.5 * (fl - 1 / fl);
        this.gamma0 = Math.asin(Math.sin(this.alpha) / dl);
        this.long0 = this.longc - Math.asin(gl * Math.tan(this.gamma0)) / this.bl;

      }
      else {
        //2 points method
        var t1 = common.tsfnz(this.e, this.lat1, Math.sin(this.lat1));
        var t2 = common.tsfnz(this.e, this.lat2, Math.sin(this.lat2));
        if (this.lat0 >= 0) {
          this.el = (dl + Math.sqrt(dl * dl - 1)) * Math.pow(t0, this.bl);
        }
        else {
          this.el = (dl - Math.sqrt(dl * dl - 1)) * Math.pow(t0, this.bl);
        }
        var hl = Math.pow(t1, this.bl);
        var ll = Math.pow(t2, this.bl);
        fl = this.el / hl;
        gl = 0.5 * (fl - 1 / fl);
        var jl = (this.el * this.el - ll * hl) / (this.el * this.el + ll * hl);
        var pl = (ll - hl) / (ll + hl);
        var dlon12 = common.adjust_lon(this.long1 - this.long2);
        this.long0 = 0.5 * (this.long1 + this.long2) - Math.atan(jl * Math.tan(0.5 * this.bl * (dlon12)) / pl) / this.bl;
        this.long0 = common.adjust_lon(this.long0);
        var dlon10 = common.adjust_lon(this.long1 - this.long0);
        this.gamma0 = Math.atan(Math.sin(this.bl * (dlon10)) / gl);
        this.alpha = Math.asin(dl * Math.sin(this.gamma0));
      }

      if (this.no_off) {
        this.uc = 0;
      }
      else {
        if (this.lat0 >= 0) {
          this.uc = this.al / this.bl * Math.atan2(Math.sqrt(dl * dl - 1), Math.cos(this.alpha));
        }
        else {
          this.uc = -1 * this.al / this.bl * Math.atan2(Math.sqrt(dl * dl - 1), Math.cos(this.alpha));
        }
      }

    },


    /* Oblique Mercator forward equations--mapping lat,long to x,y
    ----------------------------------------------------------*/
    forward: function(p) {
      var lon = p.x;
      var lat = p.y;
      var dlon = common.adjust_lon(lon - this.long0);
      var us, vs;
      var con;
      if (Math.abs(Math.abs(lat) - common.HALF_PI) <= common.EPSLN) {
        if (lat > 0) {
          con = -1;
        }
        else {
          con = 1;
        }
        vs = this.al / this.bl * Math.log(Math.tan(common.FORTPI + con * this.gamma0 * 0.5));
        us = -1 * con * common.HALF_PI * this.al / this.bl;
      }
      else {
        var t = common.tsfnz(this.e, lat, Math.sin(lat));
        var ql = this.el / Math.pow(t, this.bl);
        var sl = 0.5 * (ql - 1 / ql);
        var tl = 0.5 * (ql + 1 / ql);
        var vl = Math.sin(this.bl * (dlon));
        var ul = (sl * Math.sin(this.gamma0) - vl * Math.cos(this.gamma0)) / tl;
        if (Math.abs(Math.abs(ul) - 1) <= common.EPSLN) {
          vs = Number.POSITIVE_INFINITY;
        }
        else {
          vs = 0.5 * this.al * Math.log((1 - ul) / (1 + ul)) / this.bl;
        }
        if (Math.abs(Math.cos(this.bl * (dlon))) <= common.EPSLN) {
          us = this.al * this.bl * (dlon);
        }
        else {
          us = this.al * Math.atan2(sl * Math.cos(this.gamma0) + vl * Math.sin(this.gamma0), Math.cos(this.bl * dlon)) / this.bl;
        }
      }

      if (this.no_rot) {
        p.x = this.x0 + us;
        p.y = this.y0 + vs;
      }
      else {

        us -= this.uc;
        p.x = this.x0 + vs * Math.cos(this.alpha) + us * Math.sin(this.alpha);
        p.y = this.y0 + us * Math.cos(this.alpha) - vs * Math.sin(this.alpha);
      }
      return p;
    },

    inverse: function(p) {
      var us, vs;
      if (this.no_rot) {
        vs = p.y - this.y0;
        us = p.x - this.x0;
      }
      else {
        vs = (p.x - this.x0) * Math.cos(this.alpha) - (p.y - this.y0) * Math.sin(this.alpha);
        us = (p.y - this.y0) * Math.cos(this.alpha) + (p.x - this.x0) * Math.sin(this.alpha);
        us += this.uc;
      }
      var qp = Math.exp(-1 * this.bl * vs / this.al);
      var sp = 0.5 * (qp - 1 / qp);
      var tp = 0.5 * (qp + 1 / qp);
      var vp = Math.sin(this.bl * us / this.al);
      var up = (vp * Math.cos(this.gamma0) + sp * Math.sin(this.gamma0)) / tp;
      var ts = Math.pow(this.el / Math.sqrt((1 + up) / (1 - up)), 1 / this.bl);
      if (Math.abs(up - 1) < common.EPSLN) {
        p.x = this.long0;
        p.y = common.HALF_PI;
      }
      else if (Math.abs(up + 1) < common.EPSLN) {
        p.x = this.long0;
        p.y = -1 * common.HALF_PI;
      }
      else {
        p.y = common.phi2z(this.e, ts);
        p.x = common.adjust_lon(this.long0 - Math.atan2(sp * Math.cos(this.gamma0) - vp * Math.sin(this.gamma0), Math.cos(this.bl * us / this.al)) / this.bl);
      }
      return p;
    }
  };

});

define('projCode/lcc',['../common'],function(common) {
  return {
    init: function() {

      // array of:  r_maj,r_min,lat1,lat2,c_lon,c_lat,false_east,false_north
      //double c_lat;                   /* center latitude                      */
      //double c_lon;                   /* center longitude                     */
      //double lat1;                    /* first standard parallel              */
      //double lat2;                    /* second standard parallel             */
      //double r_maj;                   /* major axis                           */
      //double r_min;                   /* minor axis                           */
      //double false_east;              /* x offset in meters                   */
      //double false_north;             /* y offset in meters                   */

      if (!this.lat2) {
        this.lat2 = this.lat1;
      } //if lat2 is not defined
      if (!this.k0) {
        this.k0 = 1;
      }

      // Standard Parallels cannot be equal and on opposite sides of the equator
      if (Math.abs(this.lat1 + this.lat2) < common.EPSLN) {
        //proj4.reportError("lcc:init: Equal Latitudes");
        return;
      }

      var temp = this.b / this.a;
      this.e = Math.sqrt(1 - temp * temp);

      var sin1 = Math.sin(this.lat1);
      var cos1 = Math.cos(this.lat1);
      var ms1 = common.msfnz(this.e, sin1, cos1);
      var ts1 = common.tsfnz(this.e, this.lat1, sin1);

      var sin2 = Math.sin(this.lat2);
      var cos2 = Math.cos(this.lat2);
      var ms2 = common.msfnz(this.e, sin2, cos2);
      var ts2 = common.tsfnz(this.e, this.lat2, sin2);

      var ts0 = common.tsfnz(this.e, this.lat0, Math.sin(this.lat0));

      if (Math.abs(this.lat1 - this.lat2) > common.EPSLN) {
        this.ns = Math.log(ms1 / ms2) / Math.log(ts1 / ts2);
      }
      else {
        this.ns = sin1;
      }
      if(isNaN(this.ns)){
        this.ns = sin1;
      }
      this.f0 = ms1 / (this.ns * Math.pow(ts1, this.ns));
      this.rh = this.a * this.f0 * Math.pow(ts0, this.ns);
      if (!this.title) {
        this.title = "Lambert Conformal Conic";
      }
    },


    // Lambert Conformal conic forward equations--mapping lat,long to x,y
    // -----------------------------------------------------------------
    forward: function(p) {

      var lon = p.x;
      var lat = p.y;

      // singular cases :
      if (Math.abs(2 * Math.abs(lat) - common.PI) <= common.EPSLN) {
        lat = common.sign(lat) * (common.HALF_PI - 2 * common.EPSLN);
      }

      var con = Math.abs(Math.abs(lat) - common.HALF_PI);
      var ts, rh1;
      if (con > common.EPSLN) {
        ts = common.tsfnz(this.e, lat, Math.sin(lat));
        rh1 = this.a * this.f0 * Math.pow(ts, this.ns);
      }
      else {
        con = lat * this.ns;
        if (con <= 0) {
          //proj4.reportError("lcc:forward: No Projection");
          return null;
        }
        rh1 = 0;
      }
      var theta = this.ns * common.adjust_lon(lon - this.long0);
      p.x = this.k0 * (rh1 * Math.sin(theta)) + this.x0;
      p.y = this.k0 * (this.rh - rh1 * Math.cos(theta)) + this.y0;

      return p;
    },

    // Lambert Conformal Conic inverse equations--mapping x,y to lat/long
    // -----------------------------------------------------------------
    inverse: function(p) {

      var rh1, con, ts;
      var lat, lon;
      var x = (p.x - this.x0) / this.k0;
      var y = (this.rh - (p.y - this.y0) / this.k0);
      if (this.ns > 0) {
        rh1 = Math.sqrt(x * x + y * y);
        con = 1;
      }
      else {
        rh1 = -Math.sqrt(x * x + y * y);
        con = -1;
      }
      var theta = 0;
      if (rh1 !== 0) {
        theta = Math.atan2((con * x), (con * y));
      }
      if ((rh1 !== 0) || (this.ns > 0)) {
        con = 1 / this.ns;
        ts = Math.pow((rh1 / (this.a * this.f0)), con);
        lat = common.phi2z(this.e, ts);
        if (lat === -9999) {
          return null;
        }
      }
      else {
        lat = -common.HALF_PI;
      }
      lon = common.adjust_lon(theta / this.ns + this.long0);

      p.x = lon;
      p.y = lat;
      return p;
    }
  };

});

define('projCode/krovak',['../common'],function(common) {
  return {

    init: function() {
      /* we want Bessel as fixed ellipsoid */
      this.a = 6377397.155;
      this.es = 0.006674372230614;
      this.e = Math.sqrt(this.es);
      /* if latitude of projection center is not set, use 49d30'N */
      if (!this.lat0) {
        this.lat0 = 0.863937979737193;
      }
      if (!this.long0) {
        this.long0 = 0.7417649320975901 - 0.308341501185665;
      }
      /* if scale not set default to 0.9999 */
      if (!this.k0) {
        this.k0 = 0.9999;
      }
      this.s45 = 0.785398163397448; /* 45 */
      this.s90 = 2 * this.s45;
      this.fi0 = this.lat0; /* Latitude of projection centre 49  30' */
      /*  Ellipsoid Bessel 1841 a = 6377397.155m 1/f = 299.1528128,
                 e2=0.006674372230614;
     */
      this.e2 = this.es; /* 0.006674372230614; */
      this.e = Math.sqrt(this.e2);
      this.alfa = Math.sqrt(1 + (this.e2 * Math.pow(Math.cos(this.fi0), 4)) / (1 - this.e2));
      this.uq = 1.04216856380474; /* DU(2, 59, 42, 42.69689) */
      this.u0 = Math.asin(Math.sin(this.fi0) / this.alfa);
      this.g = Math.pow((1 + this.e * Math.sin(this.fi0)) / (1 - this.e * Math.sin(this.fi0)), this.alfa * this.e / 2);
      this.k = Math.tan(this.u0 / 2 + this.s45) / Math.pow(Math.tan(this.fi0 / 2 + this.s45), this.alfa) * this.g;
      this.k1 = this.k0;
      this.n0 = this.a * Math.sqrt(1 - this.e2) / (1 - this.e2 * Math.pow(Math.sin(this.fi0), 2));
      this.s0 = 1.37008346281555; /* Latitude of pseudo standard parallel 78 30'00" N */
      this.n = Math.sin(this.s0);
      this.ro0 = this.k1 * this.n0 / Math.tan(this.s0);
      this.ad = this.s90 - this.uq;
    },

    /* ellipsoid */
    /* calculate xy from lat/lon */
    /* Constants, identical to inverse transform function */
    forward: function(p) {
      var gfi, u, deltav, s, d, eps, ro;
      var lon = p.x;
      var lat = p.y;
      var delta_lon = common.adjust_lon(lon - this.long0); // Delta longitude
      /* Transformation */
      gfi = Math.pow(((1 + this.e * Math.sin(lat)) / (1 - this.e * Math.sin(lat))), (this.alfa * this.e / 2));
      u = 2 * (Math.atan(this.k * Math.pow(Math.tan(lat / 2 + this.s45), this.alfa) / gfi) - this.s45);
      deltav = -delta_lon * this.alfa;
      s = Math.asin(Math.cos(this.ad) * Math.sin(u) + Math.sin(this.ad) * Math.cos(u) * Math.cos(deltav));
      d = Math.asin(Math.cos(u) * Math.sin(deltav) / Math.cos(s));
      eps = this.n * d;
      ro = this.ro0 * Math.pow(Math.tan(this.s0 / 2 + this.s45), this.n) / Math.pow(Math.tan(s / 2 + this.s45), this.n);
      /* x and y are reverted! */
      //p.y = ro * Math.cos(eps) / a;
      //p.x = ro * Math.sin(eps) / a;
      p.y = ro * Math.cos(eps) / 1;
      p.x = ro * Math.sin(eps) / 1;

      if (!this.czech) {
        p.y *= -1;
        p.x *= -1;
      }
      return (p);
    },

    /* calculate lat/lon from xy */
    inverse: function(p) {
      /* Constants, identisch wie in der Umkehrfunktion */
      var u, deltav, s, d, eps, ro, fi1;
      var ok;

      /* Transformation */
      /* revert y, x*/
      var tmp = p.x;
      p.x = p.y;
      p.y = tmp;
      if (!this.czech) {
        p.y *= -1;
        p.x *= -1;
      }
      ro = Math.sqrt(p.x * p.x + p.y * p.y);
      eps = Math.atan2(p.y, p.x);
      d = eps / Math.sin(this.s0);
      s = 2 * (Math.atan(Math.pow(this.ro0 / ro, 1 / this.n) * Math.tan(this.s0 / 2 + this.s45)) - this.s45);
      u = Math.asin(Math.cos(this.ad) * Math.sin(s) - Math.sin(this.ad) * Math.cos(s) * Math.cos(d));
      deltav = Math.asin(Math.cos(s) * Math.sin(d) / Math.cos(u));
      p.x = this.long0 - deltav / this.alfa;
      /* ITERATION FOR lat */
      fi1 = u;
      ok = 0;
      var iter = 0;
      do {
        p.y = 2 * (Math.atan(Math.pow(this.k, - 1 / this.alfa) * Math.pow(Math.tan(u / 2 + this.s45), 1 / this.alfa) * Math.pow((1 + this.e * Math.sin(fi1)) / (1 - this.e * Math.sin(fi1)), this.e / 2)) - this.s45);
        if (Math.abs(fi1 - p.y) < 0.0000000001) {
          ok = 1;
        }
        fi1 = p.y;
        iter += 1;
      } while (ok === 0 && iter < 15);
      if (iter >= 15) {
        //proj4.reportError("PHI3Z-CONV:Latitude failed to converge after 15 iterations");
        //console.log('iter:', iter);
        return null;
      }

      return (p);
    }
  };

});

define('projCode/cass',['../common'],function(common) {
  return {
    init: function() {
      if (!this.sphere) {
        this.e0 = common.e0fn(this.es);
        this.e1 = common.e1fn(this.es);
        this.e2 = common.e2fn(this.es);
        this.e3 = common.e3fn(this.es);
        this.ml0 = this.a * common.mlfn(this.e0, this.e1, this.e2, this.e3, this.lat0);
      }
    },



    /* Cassini forward equations--mapping lat,long to x,y
  -----------------------------------------------------------------------*/
    forward: function(p) {

      /* Forward equations
      -----------------*/
      var x, y;
      var lam = p.x;
      var phi = p.y;
      lam = common.adjust_lon(lam - this.long0);

      if (this.sphere) {
        x = this.a * Math.asin(Math.cos(phi) * Math.sin(lam));
        y = this.a * (Math.atan2(Math.tan(phi), Math.cos(lam)) - this.lat0);
      }
      else {
        //ellipsoid
        var sinphi = Math.sin(phi);
        var cosphi = Math.cos(phi);
        var nl = common.gN(this.a, this.e, sinphi);
        var tl = Math.tan(phi) * Math.tan(phi);
        var al = lam * Math.cos(phi);
        var asq = al * al;
        var cl = this.es * cosphi * cosphi / (1 - this.es);
        var ml = this.a * common.mlfn(this.e0, this.e1, this.e2, this.e3, phi);

        x = nl * al * (1 - asq * tl * (1 / 6 - (8 - tl + 8 * cl) * asq / 120));
        y = ml - this.ml0 + nl * sinphi / cosphi * asq * (0.5 + (5 - tl + 6 * cl) * asq / 24);


      }

      p.x = x + this.x0;
      p.y = y + this.y0;
      return p;
    }, //cassFwd()

    /* Inverse equations
  -----------------*/
    inverse: function(p) {
      p.x -= this.x0;
      p.y -= this.y0;
      var x = p.x / this.a;
      var y = p.y / this.a;
      var phi, lam;

      if (this.sphere) {
        var dd = y + this.lat0;
        phi = Math.asin(Math.sin(dd) * Math.cos(x));
        lam = Math.atan2(Math.tan(x), Math.cos(dd));
      }
      else {
        /* ellipsoid */
        var ml1 = this.ml0 / this.a + y;
        var phi1 = common.imlfn(ml1, this.e0, this.e1, this.e2, this.e3);
        if (Math.abs(Math.abs(phi1) - common.HALF_PI) <= common.EPSLN) {
          p.x = this.long0;
          p.y = common.HALF_PI;
          if (y < 0) {
            p.y *= -1;
          }
          return p;
        }
        var nl1 = common.gN(this.a, this.e, Math.sin(phi1));

        var rl1 = nl1 * nl1 * nl1 / this.a / this.a * (1 - this.es);
        var tl1 = Math.pow(Math.tan(phi1), 2);
        var dl = x * this.a / nl1;
        var dsq = dl * dl;
        phi = phi1 - nl1 * Math.tan(phi1) / rl1 * dl * dl * (0.5 - (1 + 3 * tl1) * dl * dl / 24);
        lam = dl * (1 - dsq * (tl1 / 3 + (1 + 3 * tl1) * tl1 * dsq / 15)) / Math.cos(phi1);

      }

      p.x = common.adjust_lon(lam + this.long0);
      p.y = common.adjust_lat(phi);
      return p;

    } //cassInv()

  };

});

define('projCode/laea',['../common'],function(common) {
  /*
  reference
    "New Equal-Area Map Projections for Noncircular Regions", John P. Snyder,
    The American Cartographer, Vol 15, No. 4, October 1988, pp. 341-355.
  */
  return {
    S_POLE: 1,
    N_POLE: 2,
    EQUIT: 3,
    OBLIQ: 4,


    /* Initialize the Lambert Azimuthal Equal Area projection
  ------------------------------------------------------*/
    init: function() {
      var t = Math.abs(this.lat0);
      if (Math.abs(t - common.HALF_PI) < common.EPSLN) {
        this.mode = this.lat0 < 0 ? this.S_POLE : this.N_POLE;
      }
      else if (Math.abs(t) < common.EPSLN) {
        this.mode = this.EQUIT;
      }
      else {
        this.mode = this.OBLIQ;
      }
      if (this.es > 0) {
        var sinphi;

        this.qp = common.qsfnz(this.e, 1);
        this.mmf = 0.5 / (1 - this.es);
        this.apa = this.authset(this.es);
        switch (this.mode) {
        case this.N_POLE:
          this.dd = 1;
          break;
        case this.S_POLE:
          this.dd = 1;
          break;
        case this.EQUIT:
          this.rq = Math.sqrt(0.5 * this.qp);
          this.dd = 1 / this.rq;
          this.xmf = 1;
          this.ymf = 0.5 * this.qp;
          break;
        case this.OBLIQ:
          this.rq = Math.sqrt(0.5 * this.qp);
          sinphi = Math.sin(this.lat0);
          this.sinb1 = common.qsfnz(this.e, sinphi) / this.qp;
          this.cosb1 = Math.sqrt(1 - this.sinb1 * this.sinb1);
          this.dd = Math.cos(this.lat0) / (Math.sqrt(1 - this.es * sinphi * sinphi) * this.rq * this.cosb1);
          this.ymf = (this.xmf = this.rq) / this.dd;
          this.xmf *= this.dd;
          break;
        }
      }
      else {
        if (this.mode === this.OBLIQ) {
          this.sinph0 = Math.sin(this.lat0);
          this.cosph0 = Math.cos(this.lat0);
        }
      }
    },

    /* Lambert Azimuthal Equal Area forward equations--mapping lat,long to x,y
  -----------------------------------------------------------------------*/
    forward: function(p) {

      /* Forward equations
      -----------------*/
      var x, y, coslam, sinlam, sinphi, q, sinb, cosb, b, cosphi;
      var lam = p.x;
      var phi = p.y;

      lam = common.adjust_lon(lam - this.long0);

      if (this.sphere) {
        sinphi = Math.sin(phi);
        cosphi = Math.cos(phi);
        coslam = Math.cos(lam);
        if (this.mode === this.OBLIQ || this.mode === this.EQUIT) {
          y = (this.mode === this.EQUIT) ? 1 + cosphi * coslam : 1 + this.sinph0 * sinphi + this.cosph0 * cosphi * coslam;
          if (y <= common.EPSLN) {
            //proj4.reportError("laea:fwd:y less than eps");
            return null;
          }
          y = Math.sqrt(2 / y);
          x = y * cosphi * Math.sin(lam);
          y *= (this.mode === this.EQUIT) ? sinphi : this.cosph0 * sinphi - this.sinph0 * cosphi * coslam;
        }
        else if (this.mode === this.N_POLE || this.mode === this.S_POLE) {
          if (this.mode === this.N_POLE) {
            coslam = -coslam;
          }
          if (Math.abs(phi + this.phi0) < common.EPSLN) {
            //proj4.reportError("laea:fwd:phi < eps");
            return null;
          }
          y = common.FORTPI - phi * 0.5;
          y = 2 * ((this.mode === this.S_POLE) ? Math.cos(y) : Math.sin(y));
          x = y * Math.sin(lam);
          y *= coslam;
        }
      }
      else {
        sinb = 0;
        cosb = 0;
        b = 0;
        coslam = Math.cos(lam);
        sinlam = Math.sin(lam);
        sinphi = Math.sin(phi);
        q = common.qsfnz(this.e, sinphi);
        if (this.mode === this.OBLIQ || this.mode === this.EQUIT) {
          sinb = q / this.qp;
          cosb = Math.sqrt(1 - sinb * sinb);
        }
        switch (this.mode) {
        case this.OBLIQ:
          b = 1 + this.sinb1 * sinb + this.cosb1 * cosb * coslam;
          break;
        case this.EQUIT:
          b = 1 + cosb * coslam;
          break;
        case this.N_POLE:
          b = common.HALF_PI + phi;
          q = this.qp - q;
          break;
        case this.S_POLE:
          b = phi - common.HALF_PI;
          q = this.qp + q;
          break;
        }
        if (Math.abs(b) < common.EPSLN) {
          //proj4.reportError("laea:fwd:b < eps");
          return null;
        }
        switch (this.mode) {
        case this.OBLIQ:
        case this.EQUIT:
          b = Math.sqrt(2 / b);
          if (this.mode === this.OBLIQ) {
            y = this.ymf * b * (this.cosb1 * sinb - this.sinb1 * cosb * coslam);
          }
          else {
            y = (b = Math.sqrt(2 / (1 + cosb * coslam))) * sinb * this.ymf;
          }
          x = this.xmf * b * cosb * sinlam;
          break;
        case this.N_POLE:
        case this.S_POLE:
          if (q >= 0) {
            x = (b = Math.sqrt(q)) * sinlam;
            y = coslam * ((this.mode === this.S_POLE) ? b : -b);
          }
          else {
            x = y = 0;
          }
          break;
        }
      }

      //v 1
      /*
    var sin_lat=Math.sin(lat);
    var cos_lat=Math.cos(lat);

    var sin_delta_lon=Math.sin(delta_lon);
    var cos_delta_lon=Math.cos(delta_lon);

    var g =this.sin_lat_o * sin_lat +this.cos_lat_o * cos_lat * cos_delta_lon;
    if (g == -1) {
      //proj4.reportError("laea:fwd:Point projects to a circle of radius "+ 2 * R);
      return null;
    }
    var ksp = this.a * Math.sqrt(2 / (1 + g));
    var x = ksp * cos_lat * sin_delta_lon + this.x0;
    var y = ksp * (this.cos_lat_o * sin_lat - this.sin_lat_o * cos_lat * cos_delta_lon) + this.y0;
    */
      p.x = this.a * x + this.x0;
      p.y = this.a * y + this.y0;
      return p;
    }, //lamazFwd()

    /* Inverse equations
  -----------------*/
    inverse: function(p) {
      p.x -= this.x0;
      p.y -= this.y0;
      var x = p.x / this.a;
      var y = p.y / this.a;
      var lam, phi, cCe, sCe, q, rho, ab;

      if (this.sphere) {
        var cosz = 0,
          rh, sinz = 0;

        rh = Math.sqrt(x * x + y * y);
        phi = rh * 0.5;
        if (phi > 1) {
          //proj4.reportError("laea:Inv:DataError");
          return null;
        }
        phi = 2 * Math.asin(phi);
        if (this.mode === this.OBLIQ || this.mode === this.EQUIT) {
          sinz = Math.sin(phi);
          cosz = Math.cos(phi);
        }
        switch (this.mode) {
        case this.EQUIT:
          phi = (Math.abs(rh) <= common.EPSLN) ? 0 : Math.asin(y * sinz / rh);
          x *= sinz;
          y = cosz * rh;
          break;
        case this.OBLIQ:
          phi = (Math.abs(rh) <= common.EPSLN) ? this.phi0 : Math.asin(cosz * this.sinph0 + y * sinz * this.cosph0 / rh);
          x *= sinz * this.cosph0;
          y = (cosz - Math.sin(phi) * this.sinph0) * rh;
          break;
        case this.N_POLE:
          y = -y;
          phi = common.HALF_PI - phi;
          break;
        case this.S_POLE:
          phi -= common.HALF_PI;
          break;
        }
        lam = (y === 0 && (this.mode === this.EQUIT || this.mode === this.OBLIQ)) ? 0 : Math.atan2(x, y);
      }
      else {
        ab = 0;
        if (this.mode === this.OBLIQ || this.mode === this.EQUIT) {
          x /= this.dd;
          y *= this.dd;
          rho = Math.sqrt(x * x + y * y);
          if (rho < common.EPSLN) {
            p.x = 0;
            p.y = this.phi0;
            return p;
          }
          sCe = 2 * Math.asin(0.5 * rho / this.rq);
          cCe = Math.cos(sCe);
          x *= (sCe = Math.sin(sCe));
          if (this.mode === this.OBLIQ) {
            ab = cCe * this.sinb1 + y * sCe * this.cosb1 / rho;
            q = this.qp * ab;
            y = rho * this.cosb1 * cCe - y * this.sinb1 * sCe;
          }
          else {
            ab = y * sCe / rho;
            q = this.qp * ab;
            y = rho * cCe;
          }
        }
        else if (this.mode === this.N_POLE || this.mode === this.S_POLE) {
          if (this.mode === this.N_POLE) {
            y = -y;
          }
          q = (x * x + y * y);
          if (!q) {
            p.x = 0;
            p.y = this.phi0;
            return p;
          }
          /*
          q = this.qp - q;
          */
          ab = 1 - q / this.qp;
          if (this.mode === this.S_POLE) {
            ab = -ab;
          }
        }
        lam = Math.atan2(x, y);
        phi = this.authlat(Math.asin(ab), this.apa);
      }

      /*
    var Rh = Math.Math.sqrt(p.x *p.x +p.y * p.y);
    var temp = Rh / (2 * this.a);

    if (temp > 1) {
      proj4.reportError("laea:Inv:DataError");
      return null;
    }

    var z = 2 * common.asinz(temp);
    var sin_z=Math.sin(z);
    var cos_z=Math.cos(z);

    var lon =this.long0;
    if (Math.abs(Rh) > common.EPSLN) {
       var lat = common.asinz(this.sin_lat_o * cos_z +this. cos_lat_o * sin_z *p.y / Rh);
       var temp =Math.abs(this.lat0) - common.HALF_PI;
       if (Math.abs(temp) > common.EPSLN) {
          temp = cos_z -this.sin_lat_o * Math.sin(lat);
          if(temp!=0) lon=common.adjust_lon(this.long0+Math.atan2(p.x*sin_z*this.cos_lat_o,temp*Rh));
       } else if (this.lat0 < 0) {
          lon = common.adjust_lon(this.long0 - Math.atan2(-p.x,p.y));
       } else {
          lon = common.adjust_lon(this.long0 + Math.atan2(p.x, -p.y));
       }
    } else {
      lat = this.lat0;
    }
    */
      //return(OK);
      p.x = common.adjust_lon(this.long0 + lam);
      p.y = phi;
      return p;
    }, //lamazInv()

    /* determine latitude from authalic latitude */
    P00: 0.33333333333333333333,
    P01: 0.17222222222222222222,
    P02: 0.10257936507936507936,
    P10: 0.06388888888888888888,
    P11: 0.06640211640211640211,
    P20: 0.01641501294219154443,

    authset: function(es) {
      var t;
      var APA = [];
      APA[0] = es * this.P00;
      t = es * es;
      APA[0] += t * this.P01;
      APA[1] = t * this.P10;
      t *= es;
      APA[0] += t * this.P02;
      APA[1] += t * this.P11;
      APA[2] = t * this.P20;
      return APA;
    },

    authlat: function(beta, APA) {
      var t = beta + beta;
      return (beta + APA[0] * Math.sin(t) + APA[1] * Math.sin(t + t) + APA[2] * Math.sin(t + t + t));
    }

  };

});

define('projCode/merc',['../common'],function(common) {
  return {
    init: function() {
      var con = this.b / this.a;
      this.es = 1 - con * con;
      this.e = Math.sqrt(this.es);
      if (this.lat_ts) {
        if (this.sphere) {
          this.k0 = Math.cos(this.lat_ts);
        }
        else {
          this.k0 = common.msfnz(this.e, Math.sin(this.lat_ts), Math.cos(this.lat_ts));
        }
      }
      else {
        if (!this.k0) {
          if (this.k) {
            this.k0 = this.k;
          }
          else {
            this.k0 = 1;
          }
        }
      }
    },

    /* Mercator forward equations--mapping lat,long to x,y
  --------------------------------------------------*/

    forward: function(p) {
      //alert("ll2m coords : "+coords);
      var lon = p.x;
      var lat = p.y;
      // convert to radians
      if (lat * common.R2D > 90 && lat * common.R2D < -90 && lon * common.R2D > 180 && lon * common.R2D < -180) {
        //proj4.reportError("merc:forward: llInputOutOfRange: " + lon + " : " + lat);
        return null;
      }

      var x, y;
      if (Math.abs(Math.abs(lat) - common.HALF_PI) <= common.EPSLN) {
        //proj4.reportError("merc:forward: ll2mAtPoles");
        return null;
      }
      else {
        if (this.sphere) {
          x = this.x0 + this.a * this.k0 * common.adjust_lon(lon - this.long0);
          y = this.y0 + this.a * this.k0 * Math.log(Math.tan(common.FORTPI + 0.5 * lat));
        }
        else {
          var sinphi = Math.sin(lat);
          var ts = common.tsfnz(this.e, lat, sinphi);
          x = this.x0 + this.a * this.k0 * common.adjust_lon(lon - this.long0);
          y = this.y0 - this.a * this.k0 * Math.log(ts);
        }
        p.x = x;
        p.y = y;
        return p;
      }
    },


    /* Mercator inverse equations--mapping x,y to lat/long
  --------------------------------------------------*/
    inverse: function(p) {

      var x = p.x - this.x0;
      var y = p.y - this.y0;
      var lon, lat;

      if (this.sphere) {
        lat = common.HALF_PI - 2 * Math.atan(Math.exp(-y / (this.a * this.k0)));
      }
      else {
        var ts = Math.exp(-y / (this.a * this.k0));
        lat = common.phi2z(this.e, ts);
        if (lat === -9999) {
          //proj4.reportError("merc:inverse: lat = -9999");
          return null;
        }
      }
      lon = common.adjust_lon(this.long0 + x / (this.a * this.k0));

      p.x = lon;
      p.y = lat;
      return p;
    }
  };

});

define('projCode/aea',['../common'],function(common) {
  return {
    init: function() {

      if (Math.abs(this.lat1 + this.lat2) < common.EPSLN) {
        //proj4.reportError("aeaInitEqualLatitudes");
        return;
      }
      this.temp = this.b / this.a;
      this.es = 1 - Math.pow(this.temp, 2);
      this.e3 = Math.sqrt(this.es);

      this.sin_po = Math.sin(this.lat1);
      this.cos_po = Math.cos(this.lat1);
      this.t1 = this.sin_po;
      this.con = this.sin_po;
      this.ms1 = common.msfnz(this.e3, this.sin_po, this.cos_po);
      this.qs1 = common.qsfnz(this.e3, this.sin_po, this.cos_po);

      this.sin_po = Math.sin(this.lat2);
      this.cos_po = Math.cos(this.lat2);
      this.t2 = this.sin_po;
      this.ms2 = common.msfnz(this.e3, this.sin_po, this.cos_po);
      this.qs2 = common.qsfnz(this.e3, this.sin_po, this.cos_po);

      this.sin_po = Math.sin(this.lat0);
      this.cos_po = Math.cos(this.lat0);
      this.t3 = this.sin_po;
      this.qs0 = common.qsfnz(this.e3, this.sin_po, this.cos_po);

      if (Math.abs(this.lat1 - this.lat2) > common.EPSLN) {
        this.ns0 = (this.ms1 * this.ms1 - this.ms2 * this.ms2) / (this.qs2 - this.qs1);
      }
      else {
        this.ns0 = this.con;
      }
      this.c = this.ms1 * this.ms1 + this.ns0 * this.qs1;
      this.rh = this.a * Math.sqrt(this.c - this.ns0 * this.qs0) / this.ns0;
    },

    /* Albers Conical Equal Area forward equations--mapping lat,long to x,y
  -------------------------------------------------------------------*/
    forward: function(p) {

      var lon = p.x;
      var lat = p.y;

      this.sin_phi = Math.sin(lat);
      this.cos_phi = Math.cos(lat);

      var qs = common.qsfnz(this.e3, this.sin_phi, this.cos_phi);
      var rh1 = this.a * Math.sqrt(this.c - this.ns0 * qs) / this.ns0;
      var theta = this.ns0 * common.adjust_lon(lon - this.long0);
      var x = rh1 * Math.sin(theta) + this.x0;
      var y = this.rh - rh1 * Math.cos(theta) + this.y0;

      p.x = x;
      p.y = y;
      return p;
    },


    inverse: function(p) {
      var rh1, qs, con, theta, lon, lat;

      p.x -= this.x0;
      p.y = this.rh - p.y + this.y0;
      if (this.ns0 >= 0) {
        rh1 = Math.sqrt(p.x * p.x + p.y * p.y);
        con = 1;
      }
      else {
        rh1 = -Math.sqrt(p.x * p.x + p.y * p.y);
        con = -1;
      }
      theta = 0;
      if (rh1 !== 0) {
        theta = Math.atan2(con * p.x, con * p.y);
      }
      con = rh1 * this.ns0 / this.a;
      if (this.sphere) {
        lat = Math.asin((this.c - con * con) / (2 * this.ns0));
      }
      else {
        qs = (this.c - con * con) / this.ns0;
        lat = this.phi1z(this.e3, qs);
      }

      lon = common.adjust_lon(theta / this.ns0 + this.long0);
      p.x = lon;
      p.y = lat;
      return p;
    },

    /* Function to compute phi1, the latitude for the inverse of the
   Albers Conical Equal-Area projection.
-------------------------------------------*/
    phi1z: function(eccent, qs) {
      var sinphi, cosphi, con, com, dphi;
      var phi = common.asinz(0.5 * qs);
      if (eccent < common.EPSLN) {
        return phi;
      }

      var eccnts = eccent * eccent;
      for (var i = 1; i <= 25; i++) {
        sinphi = Math.sin(phi);
        cosphi = Math.cos(phi);
        con = eccent * sinphi;
        com = 1 - con * con;
        dphi = 0.5 * com * com / cosphi * (qs / (1 - eccnts) - sinphi / com + 0.5 / eccent * Math.log((1 - con) / (1 + con)));
        phi = phi + dphi;
        if (Math.abs(dphi) <= 1e-7) {
          return phi;
        }
      }
      //proj4.reportError("aea:phi1z:Convergence error");
      return null;
    }

  };

});

define('projCode/gnom',['../common'],function(common) {
  /*
  reference:
    Wolfram Mathworld "Gnomonic Projection"
    http://mathworld.wolfram.com/GnomonicProjection.html
    Accessed: 12th November 2009
  */
  return {

    /* Initialize the Gnomonic projection
    -------------------------------------*/
    init: function() {

      /* Place parameters in static storage for common use
      -------------------------------------------------*/
      this.sin_p14 = Math.sin(this.lat0);
      this.cos_p14 = Math.cos(this.lat0);
      // Approximation for projecting points to the horizon (infinity)
      this.infinity_dist = 1000 * this.a;
      this.rc = 1;
    },


    /* Gnomonic forward equations--mapping lat,long to x,y
    ---------------------------------------------------*/
    forward: function(p) {
      var sinphi, cosphi; /* sin and cos value        */
      var dlon; /* delta longitude value      */
      var coslon; /* cos of longitude        */
      var ksp; /* scale factor          */
      var g;
      var x, y;
      var lon = p.x;
      var lat = p.y;
      /* Forward equations
      -----------------*/
      dlon = common.adjust_lon(lon - this.long0);

      sinphi = Math.sin(lat);
      cosphi = Math.cos(lat);

      coslon = Math.cos(dlon);
      g = this.sin_p14 * sinphi + this.cos_p14 * cosphi * coslon;
      ksp = 1;
      if ((g > 0) || (Math.abs(g) <= common.EPSLN)) {
        x = this.x0 + this.a * ksp * cosphi * Math.sin(dlon) / g;
        y = this.y0 + this.a * ksp * (this.cos_p14 * sinphi - this.sin_p14 * cosphi * coslon) / g;
      }
      else {
        //proj4.reportError("orthoFwdPointError");

        // Point is in the opposing hemisphere and is unprojectable
        // We still need to return a reasonable point, so we project 
        // to infinity, on a bearing 
        // equivalent to the northern hemisphere equivalent
        // This is a reasonable approximation for short shapes and lines that 
        // straddle the horizon.

        x = this.x0 + this.infinity_dist * cosphi * Math.sin(dlon);
        y = this.y0 + this.infinity_dist * (this.cos_p14 * sinphi - this.sin_p14 * cosphi * coslon);

      }
      p.x = x;
      p.y = y;
      return p;
    },


    inverse: function(p) {
      var rh; /* Rho */
      var sinc, cosc;
      var c;
      var lon, lat;

      /* Inverse equations
      -----------------*/
      p.x = (p.x - this.x0) / this.a;
      p.y = (p.y - this.y0) / this.a;

      p.x /= this.k0;
      p.y /= this.k0;

      if ((rh = Math.sqrt(p.x * p.x + p.y * p.y))) {
        c = Math.atan2(rh, this.rc);
        sinc = Math.sin(c);
        cosc = Math.cos(c);

        lat = common.asinz(cosc * this.sin_p14 + (p.y * sinc * this.cos_p14) / rh);
        lon = Math.atan2(p.x * sinc, rh * this.cos_p14 * cosc - p.y * this.sin_p14 * sinc);
        lon = common.adjust_lon(this.long0 + lon);
      }
      else {
        lat = this.phic0;
        lon = 0;
      }

      p.x = lon;
      p.y = lat;
      return p;
    }
  };

});

define('projCode/cea',['../common'],function(common) {
/*
  reference:  
    "Cartographic Projection Procedures for the UNIX Environment-
    A User's Manual" by Gerald I. Evenden,
    USGS Open File Report 90-284and Release 4 Interim Reports (2003)
*/
  return {

    /* Initialize the Cylindrical Equal Area projection
  -------------------------------------------*/
    init: function() {
      //no-op
      if (!this.sphere) {
        this.k0 = common.msfnz(this.e, Math.sin(this.lat_ts), Math.cos(this.lat_ts));
      }
    },


    /* Cylindrical Equal Area forward equations--mapping lat,long to x,y
    ------------------------------------------------------------*/
    forward: function(p) {
      var lon = p.x;
      var lat = p.y;
      var x, y;
      /* Forward equations
      -----------------*/
      var dlon = common.adjust_lon(lon - this.long0);
      if (this.sphere) {
        x = this.x0 + this.a * dlon * Math.cos(this.lat_ts);
        y = this.y0 + this.a * Math.sin(lat) / Math.cos(this.lat_ts);
      }
      else {
        var qs = common.qsfnz(this.e, Math.sin(lat));
        x = this.x0 + this.a * this.k0 * dlon;
        y = this.y0 + this.a * qs * 0.5 / this.k0;
      }

      p.x = x;
      p.y = y;
      return p;
    }, //ceaFwd()

    /* Cylindrical Equal Area inverse equations--mapping x,y to lat/long
    ------------------------------------------------------------*/
    inverse: function(p) {
      p.x -= this.x0;
      p.y -= this.y0;
      var lon, lat;

      if (this.sphere) {
        lon = common.adjust_lon(this.long0 + (p.x / this.a) / Math.cos(this.lat_ts));
        lat = Math.asin((p.y / this.a) * Math.cos(this.lat_ts));
      }
      else {
        lat = common.iqsfnz(this.e, 2 * p.y * this.k0 / this.a);
        lon = common.adjust_lon(this.long0 + p.x / (this.a * this.k0));
      }

      p.x = lon;
      p.y = lat;
      return p;
    } //ceaInv()
  };

});

define('projCode/eqc',['../common'],function(common) {
  return {
    init: function() {

      this.x0 = this.x0 || 0;
      this.y0 = this.y0 || 0;
      this.lat0 = this.lat0 || 0;
      this.long0 = this.long0 || 0;
      this.lat_ts = this.lat_t || 0;
      this.title = this.title || "Equidistant Cylindrical (Plate Carre)";

      this.rc = Math.cos(this.lat_ts);
    },


    // forward equations--mapping lat,long to x,y
    // -----------------------------------------------------------------
    forward: function(p) {

      var lon = p.x;
      var lat = p.y;

      var dlon = common.adjust_lon(lon - this.long0);
      var dlat = common.adjust_lat(lat - this.lat0);
      p.x = this.x0 + (this.a * dlon * this.rc);
      p.y = this.y0 + (this.a * dlat);
      return p;
    },

    // inverse equations--mapping x,y to lat/long
    // -----------------------------------------------------------------
    inverse: function(p) {

      var x = p.x;
      var y = p.y;

      p.x = common.adjust_lon(this.long0 + ((x - this.x0) / (this.a * this.rc)));
      p.y = common.adjust_lat(this.lat0 + ((y - this.y0) / (this.a)));
      return p;
    }

  };

});

define('projCode/poly',['../common'],function(common) {
  return {

    /* Initialize the POLYCONIC projection
    ----------------------------------*/
    init: function() {
      /* Place parameters in static storage for common use
      -------------------------------------------------*/
      this.temp = this.b / this.a;
      this.es = 1 - Math.pow(this.temp, 2); // devait etre dans tmerc.js mais n y est pas donc je commente sinon retour de valeurs nulles
      this.e = Math.sqrt(this.es);
      this.e0 = common.e0fn(this.es);
      this.e1 = common.e1fn(this.es);
      this.e2 = common.e2fn(this.es);
      this.e3 = common.e3fn(this.es);
      this.ml0 = this.a * common.mlfn(this.e0, this.e1, this.e2, this.e3, this.lat0); //si que des zeros le calcul ne se fait pas
    },


    /* Polyconic forward equations--mapping lat,long to x,y
    ---------------------------------------------------*/
    forward: function(p) {
      var lon = p.x;
      var lat = p.y;
      var x, y, el;
      var dlon = common.adjust_lon(lon - this.long0);
      el = dlon * Math.sin(lat);
      if (this.sphere) {
        if (Math.abs(lat) <= common.EPSLN) {
          x = this.a * dlon;
          y = -1 * this.a * this.lat0;
        }
        else {
          x = this.a * Math.sin(el) / Math.tan(lat);
          y = this.a * (common.adjust_lat(lat - this.lat0) + (1 - Math.cos(el)) / Math.tan(lat));
        }
      }
      else {
        if (Math.abs(lat) <= common.EPSLN) {
          x = this.a * dlon;
          y = -1 * this.ml0;
        }
        else {
          var nl = common.gN(this.a, this.e, Math.sin(lat)) / Math.tan(lat);
          x = nl * Math.sin(el);
          y = this.a * common.mlfn(this.e0, this.e1, this.e2, this.e3, lat) - this.ml0 + nl * (1 - Math.cos(el));
        }

      }
      p.x = x + this.x0;
      p.y = y + this.y0;
      return p;
    },


    /* Inverse equations
  -----------------*/
    inverse: function(p) {
      var lon, lat, x, y, i;
      var al, bl;
      var phi, dphi;
      x = p.x - this.x0;
      y = p.y - this.y0;

      if (this.sphere) {
        if (Math.abs(y + this.a * this.lat0) <= common.EPSLN) {
          lon = common.adjust_lon(x / this.a + this.long0);
          lat = 0;
        }
        else {
          al = this.lat0 + y / this.a;
          bl = x * x / this.a / this.a + al * al;
          phi = al;
          var tanphi;
          for (i = common.MAX_ITER; i; --i) {
            tanphi = Math.tan(phi);
            dphi = -1 * (al * (phi * tanphi + 1) - phi - 0.5 * (phi * phi + bl) * tanphi) / ((phi - al) / tanphi - 1);
            phi += dphi;
            if (Math.abs(dphi) <= common.EPSLN) {
              lat = phi;
              break;
            }
          }
          lon = common.adjust_lon(this.long0 + (Math.asin(x * Math.tan(phi) / this.a)) / Math.sin(lat));
        }
      }
      else {
        if (Math.abs(y + this.ml0) <= common.EPSLN) {
          lat = 0;
          lon = common.adjust_lon(this.long0 + x / this.a);
        }
        else {

          al = (this.ml0 + y) / this.a;
          bl = x * x / this.a / this.a + al * al;
          phi = al;
          var cl, mln, mlnp, ma;
          var con;
          for (i = common.MAX_ITER; i; --i) {
            con = this.e * Math.sin(phi);
            cl = Math.sqrt(1 - con * con) * Math.tan(phi);
            mln = this.a * common.mlfn(this.e0, this.e1, this.e2, this.e3, phi);
            mlnp = this.e0 - 2 * this.e1 * Math.cos(2 * phi) + 4 * this.e2 * Math.cos(4 * phi) - 6 * this.e3 * Math.cos(6 * phi);
            ma = mln / this.a;
            dphi = (al * (cl * ma + 1) - ma - 0.5 * cl * (ma * ma + bl)) / (this.es * Math.sin(2 * phi) * (ma * ma + bl - 2 * al * ma) / (4 * cl) + (al - ma) * (cl * mlnp - 2 / Math.sin(2 * phi)) - mlnp);
            phi -= dphi;
            if (Math.abs(dphi) <= common.EPSLN) {
              lat = phi;
              break;
            }
          }

          //lat=phi4z(this.e,this.e0,this.e1,this.e2,this.e3,al,bl,0,0);
          cl = Math.sqrt(1 - this.es * Math.pow(Math.sin(lat), 2)) * Math.tan(lat);
          lon = common.adjust_lon(this.long0 + Math.asin(x * cl / this.a) / Math.sin(lat));
        }
      }

      p.x = lon;
      p.y = lat;
      return p;
    }
  };

});

define('projCode/nzmg',['../common'],function(common) {
  /*
  reference
    Department of Land and Survey Technical Circular 1973/32
      http://www.linz.govt.nz/docs/miscellaneous/nz-map-definition.pdf
    OSG Technical Report 4.1
      http://www.linz.govt.nz/docs/miscellaneous/nzmg.pdf
  */
  return {

    /**
     * iterations: Number of iterations to refine inverse transform.
     *     0 -> km accuracy
     *     1 -> m accuracy -- suitable for most mapping applications
     *     2 -> mm accuracy
     */
    iterations: 1,

    init: function() {
      this.A = [];
      this.A[1] = 0.6399175073;
      this.A[2] = -0.1358797613;
      this.A[3] = 0.063294409;
      this.A[4] = -0.02526853;
      this.A[5] = 0.0117879;
      this.A[6] = -0.0055161;
      this.A[7] = 0.0026906;
      this.A[8] = -0.001333;
      this.A[9] = 0.00067;
      this.A[10] = -0.00034;

      this.B_re = [];
      this.B_im = [];
      this.B_re[1] = 0.7557853228;
      this.B_im[1] = 0;
      this.B_re[2] = 0.249204646;
      this.B_im[2] = 0.003371507;
      this.B_re[3] = -0.001541739;
      this.B_im[3] = 0.041058560;
      this.B_re[4] = -0.10162907;
      this.B_im[4] = 0.01727609;
      this.B_re[5] = -0.26623489;
      this.B_im[5] = -0.36249218;
      this.B_re[6] = -0.6870983;
      this.B_im[6] = -1.1651967;

      this.C_re = [];
      this.C_im = [];
      this.C_re[1] = 1.3231270439;
      this.C_im[1] = 0;
      this.C_re[2] = -0.577245789;
      this.C_im[2] = -0.007809598;
      this.C_re[3] = 0.508307513;
      this.C_im[3] = -0.112208952;
      this.C_re[4] = -0.15094762;
      this.C_im[4] = 0.18200602;
      this.C_re[5] = 1.01418179;
      this.C_im[5] = 1.64497696;
      this.C_re[6] = 1.9660549;
      this.C_im[6] = 2.5127645;

      this.D = [];
      this.D[1] = 1.5627014243;
      this.D[2] = 0.5185406398;
      this.D[3] = -0.03333098;
      this.D[4] = -0.1052906;
      this.D[5] = -0.0368594;
      this.D[6] = 0.007317;
      this.D[7] = 0.01220;
      this.D[8] = 0.00394;
      this.D[9] = -0.0013;
    },

    /**
    New Zealand Map Grid Forward  - long/lat to x/y
    long/lat in radians
  */
    forward: function(p) {
      var n;
      var lon = p.x;
      var lat = p.y;

      var delta_lat = lat - this.lat0;
      var delta_lon = lon - this.long0;

      // 1. Calculate d_phi and d_psi    ...                          // and d_lambda
      // For this algorithm, delta_latitude is in seconds of arc x 10-5, so we need to scale to those units. Longitude is radians.
      var d_phi = delta_lat / common.SEC_TO_RAD * 1E-5;
      var d_lambda = delta_lon;
      var d_phi_n = 1; // d_phi^0

      var d_psi = 0;
      for (n = 1; n <= 10; n++) {
        d_phi_n = d_phi_n * d_phi;
        d_psi = d_psi + this.A[n] * d_phi_n;
      }

      // 2. Calculate theta
      var th_re = d_psi;
      var th_im = d_lambda;

      // 3. Calculate z
      var th_n_re = 1;
      var th_n_im = 0; // theta^0
      var th_n_re1;
      var th_n_im1;

      var z_re = 0;
      var z_im = 0;
      for (n = 1; n <= 6; n++) {
        th_n_re1 = th_n_re * th_re - th_n_im * th_im;
        th_n_im1 = th_n_im * th_re + th_n_re * th_im;
        th_n_re = th_n_re1;
        th_n_im = th_n_im1;
        z_re = z_re + this.B_re[n] * th_n_re - this.B_im[n] * th_n_im;
        z_im = z_im + this.B_im[n] * th_n_re + this.B_re[n] * th_n_im;
      }

      // 4. Calculate easting and northing
      p.x = (z_im * this.a) + this.x0;
      p.y = (z_re * this.a) + this.y0;

      return p;
    },


    /**
    New Zealand Map Grid Inverse  -  x/y to long/lat
  */
    inverse: function(p) {
      var n;
      var x = p.x;
      var y = p.y;

      var delta_x = x - this.x0;
      var delta_y = y - this.y0;

      // 1. Calculate z
      var z_re = delta_y / this.a;
      var z_im = delta_x / this.a;

      // 2a. Calculate theta - first approximation gives km accuracy
      var z_n_re = 1;
      var z_n_im = 0; // z^0
      var z_n_re1;
      var z_n_im1;

      var th_re = 0;
      var th_im = 0;
      for (n = 1; n <= 6; n++) {
        z_n_re1 = z_n_re * z_re - z_n_im * z_im;
        z_n_im1 = z_n_im * z_re + z_n_re * z_im;
        z_n_re = z_n_re1;
        z_n_im = z_n_im1;
        th_re = th_re + this.C_re[n] * z_n_re - this.C_im[n] * z_n_im;
        th_im = th_im + this.C_im[n] * z_n_re + this.C_re[n] * z_n_im;
      }

      // 2b. Iterate to refine the accuracy of the calculation
      //        0 iterations gives km accuracy
      //        1 iteration gives m accuracy -- good enough for most mapping applications
      //        2 iterations bives mm accuracy
      for (var i = 0; i < this.iterations; i++) {
        var th_n_re = th_re;
        var th_n_im = th_im;
        var th_n_re1;
        var th_n_im1;

        var num_re = z_re;
        var num_im = z_im;
        for (n = 2; n <= 6; n++) {
          th_n_re1 = th_n_re * th_re - th_n_im * th_im;
          th_n_im1 = th_n_im * th_re + th_n_re * th_im;
          th_n_re = th_n_re1;
          th_n_im = th_n_im1;
          num_re = num_re + (n - 1) * (this.B_re[n] * th_n_re - this.B_im[n] * th_n_im);
          num_im = num_im + (n - 1) * (this.B_im[n] * th_n_re + this.B_re[n] * th_n_im);
        }

        th_n_re = 1;
        th_n_im = 0;
        var den_re = this.B_re[1];
        var den_im = this.B_im[1];
        for (n = 2; n <= 6; n++) {
          th_n_re1 = th_n_re * th_re - th_n_im * th_im;
          th_n_im1 = th_n_im * th_re + th_n_re * th_im;
          th_n_re = th_n_re1;
          th_n_im = th_n_im1;
          den_re = den_re + n * (this.B_re[n] * th_n_re - this.B_im[n] * th_n_im);
          den_im = den_im + n * (this.B_im[n] * th_n_re + this.B_re[n] * th_n_im);
        }

        // Complex division
        var den2 = den_re * den_re + den_im * den_im;
        th_re = (num_re * den_re + num_im * den_im) / den2;
        th_im = (num_im * den_re - num_re * den_im) / den2;
      }

      // 3. Calculate d_phi              ...                                    // and d_lambda
      var d_psi = th_re;
      var d_lambda = th_im;
      var d_psi_n = 1; // d_psi^0

      var d_phi = 0;
      for (n = 1; n <= 9; n++) {
        d_psi_n = d_psi_n * d_psi;
        d_phi = d_phi + this.D[n] * d_psi_n;
      }

      // 4. Calculate latitude and longitude
      // d_phi is calcuated in second of arc * 10^-5, so we need to scale back to radians. d_lambda is in radians.
      var lat = this.lat0 + (d_phi * common.SEC_TO_RAD * 1E5);
      var lon = this.long0 + d_lambda;

      p.x = lon;
      p.y = lat;

      return p;
    }
  };

});

define('projCode/mill',['../common'],function(common) {
  /*
  reference
    "New Equal-Area Map Projections for Noncircular Regions", John P. Snyder,
    The American Cartographer, Vol 15, No. 4, October 1988, pp. 341-355.
  */
  return {

    /* Initialize the Miller Cylindrical projection
  -------------------------------------------*/
    init: function() {
      //no-op
    },


    /* Miller Cylindrical forward equations--mapping lat,long to x,y
    ------------------------------------------------------------*/
    forward: function(p) {
      var lon = p.x;
      var lat = p.y;
      /* Forward equations
      -----------------*/
      var dlon = common.adjust_lon(lon - this.long0);
      var x = this.x0 + this.a * dlon;
      var y = this.y0 + this.a * Math.log(Math.tan((common.PI / 4) + (lat / 2.5))) * 1.25;

      p.x = x;
      p.y = y;
      return p;
    }, //millFwd()

    /* Miller Cylindrical inverse equations--mapping x,y to lat/long
    ------------------------------------------------------------*/
    inverse: function(p) {
      p.x -= this.x0;
      p.y -= this.y0;

      var lon = common.adjust_lon(this.long0 + p.x / this.a);
      var lat = 2.5 * (Math.atan(Math.exp(0.8 * p.y / this.a)) - common.PI / 4);

      p.x = lon;
      p.y = lat;
      return p;
    } //millInv()
  };

});

define('projCode/sinu',['../common'],function(common) {
  return {

    /* Initialize the Sinusoidal projection
    ------------------------------------*/
    init: function() {
      /* Place parameters in static storage for common use
    -------------------------------------------------*/


      if (!this.sphere) {
        this.en = common.pj_enfn(this.es);
      }
      else {
        this.n = 1;
        this.m = 0;
        this.es = 0;
        this.C_y = Math.sqrt((this.m + 1) / this.n);
        this.C_x = this.C_y / (this.m + 1);
      }

    },

    /* Sinusoidal forward equations--mapping lat,long to x,y
  -----------------------------------------------------*/
    forward: function(p) {
      var x, y;
      var lon = p.x;
      var lat = p.y;
      /* Forward equations
    -----------------*/
      lon = common.adjust_lon(lon - this.long0);

      if (this.sphere) {
        if (!this.m) {
          lat = this.n !== 1 ? Math.asin(this.n * Math.sin(lat)) : lat;
        }
        else {
          var k = this.n * Math.sin(lat);
          for (var i = common.MAX_ITER; i; --i) {
            var V = (this.m * lat + Math.sin(lat) - k) / (this.m + Math.cos(lat));
            lat -= V;
            if (Math.abs(V) < common.EPSLN) {
              break;
            }
          }
        }
        x = this.a * this.C_x * lon * (this.m + Math.cos(lat));
        y = this.a * this.C_y * lat;

      }
      else {

        var s = Math.sin(lat);
        var c = Math.cos(lat);
        y = this.a * common.pj_mlfn(lat, s, c, this.en);
        x = this.a * lon * c / Math.sqrt(1 - this.es * s * s);
      }

      p.x = x;
      p.y = y;
      return p;
    },

    inverse: function(p) {
      var lat, temp, lon;

      /* Inverse equations
    -----------------*/
      p.x -= this.x0;
      p.y -= this.y0;
      lat = p.y / this.a;

      if (this.sphere) {

        p.y /= this.C_y;
        lat = this.m ? Math.asin((this.m * p.y + Math.sin(p.y)) / this.n) : (this.n !== 1 ? Math.asin(Math.sin(p.y) / this.n) : p.y);
        lon = p.x / (this.C_x * (this.m + Math.cos(p.y)));

      }
      else {
        lat = common.pj_inv_mlfn(p.y / this.a, this.es, this.en);
        var s = Math.abs(lat);
        if (s < common.HALF_PI) {
          s = Math.sin(lat);
          temp = this.long0 + p.x * Math.sqrt(1 - this.es * s * s) / (this.a * Math.cos(lat));
          //temp = this.long0 + p.x / (this.a * Math.cos(lat));
          lon = common.adjust_lon(temp);
        }
        else if ((s - common.EPSLN) < common.HALF_PI) {
          lon = this.long0;
        }

      }

      p.x = lon;
      p.y = lat;
      return p;
    }
  };

});

define('projCode/moll',['../common'],function(common) {
  return {

    /* Initialize the Mollweide projection
    ------------------------------------*/
    init: function() {
      //no-op
    },

    /* Mollweide forward equations--mapping lat,long to x,y
    ----------------------------------------------------*/
    forward: function(p) {

      /* Forward equations
      -----------------*/
      var lon = p.x;
      var lat = p.y;

      var delta_lon = common.adjust_lon(lon - this.long0);
      var theta = lat;
      var con = common.PI * Math.sin(lat);

      /* Iterate using the Newton-Raphson method to find theta
      -----------------------------------------------------*/
      for (var i = 0; true; i++) {
        var delta_theta = -(theta + Math.sin(theta) - con) / (1 + Math.cos(theta));
        theta += delta_theta;
        if (Math.abs(delta_theta) < common.EPSLN) {
          break;
        }
        if (i >= 50) {
          //proj4.reportError("moll:Fwd:IterationError");
          //return(241);
        }
      }
      theta /= 2;

      /* If the latitude is 90 deg, force the x coordinate to be "0 + false easting"
       this is done here because of precision problems with "cos(theta)"
       --------------------------------------------------------------------------*/
      if (common.PI / 2 - Math.abs(lat) < common.EPSLN) {
        delta_lon = 0;
      }
      var x = 0.900316316158 * this.a * delta_lon * Math.cos(theta) + this.x0;
      var y = 1.4142135623731 * this.a * Math.sin(theta) + this.y0;

      p.x = x;
      p.y = y;
      return p;
    },

    inverse: function(p) {
      var theta;
      var arg;

      /* Inverse equations
      -----------------*/
      p.x -= this.x0;
      p.y -= this.y0;
      arg = p.y / (1.4142135623731 * this.a);

      /* Because of division by zero problems, 'arg' can not be 1.  Therefore
       a number very close to one is used instead.
       -------------------------------------------------------------------*/
      if (Math.abs(arg) > 0.999999999999) {
        arg = 0.999999999999;
      }
      theta = Math.asin(arg);
      var lon = common.adjust_lon(this.long0 + (p.x / (0.900316316158 * this.a * Math.cos(theta))));
      if (lon < (-common.PI)) {
        lon = -common.PI;
      }
      if (lon > common.PI) {
        lon = common.PI;
      }
      arg = (2 * theta + Math.sin(2 * theta)) / common.PI;
      if (Math.abs(arg) > 1) {
        arg = 1;
      }
      var lat = Math.asin(arg);
      //return(OK);

      p.x = lon;
      p.y = lat;
      return p;
    }
  };

});

define('projCode/eqdc',['../common'],function(common) {
  return {

    /* Initialize the Equidistant Conic projection
  ------------------------------------------*/
    init: function() {

      /* Place parameters in static storage for common use
      -------------------------------------------------*/
      // Standard Parallels cannot be equal and on opposite sides of the equator
      if (Math.abs(this.lat1 + this.lat2) < common.EPSLN) {
        common.reportError("eqdc:init: Equal Latitudes");
        return;
      }
      this.lat2 = this.lat2 || this.lat1;
      this.temp = this.b / this.a;
      this.es = 1 - Math.pow(this.temp, 2);
      this.e = Math.sqrt(this.es);
      this.e0 = common.e0fn(this.es);
      this.e1 = common.e1fn(this.es);
      this.e2 = common.e2fn(this.es);
      this.e3 = common.e3fn(this.es);

      this.sinphi = Math.sin(this.lat1);
      this.cosphi = Math.cos(this.lat1);

      this.ms1 = common.msfnz(this.e, this.sinphi, this.cosphi);
      this.ml1 = common.mlfn(this.e0, this.e1, this.e2, this.e3, this.lat1);

      if (Math.abs(this.lat1 - this.lat2) < common.EPSLN) {
        this.ns = this.sinphi;
        //proj4.reportError("eqdc:Init:EqualLatitudes");
      }
      else {
        this.sinphi = Math.sin(this.lat2);
        this.cosphi = Math.cos(this.lat2);
        this.ms2 = common.msfnz(this.e, this.sinphi, this.cosphi);
        this.ml2 = common.mlfn(this.e0, this.e1, this.e2, this.e3, this.lat2);
        this.ns = (this.ms1 - this.ms2) / (this.ml2 - this.ml1);
      }
      this.g = this.ml1 + this.ms1 / this.ns;
      this.ml0 = common.mlfn(this.e0, this.e1, this.e2, this.e3, this.lat0);
      this.rh = this.a * (this.g - this.ml0);
    },


    /* Equidistant Conic forward equations--mapping lat,long to x,y
  -----------------------------------------------------------*/
    forward: function(p) {
      var lon = p.x;
      var lat = p.y;
      var rh1;

      /* Forward equations
      -----------------*/
      if (this.sphere) {
        rh1 = this.a * (this.g - lat);
      }
      else {
        var ml = common.mlfn(this.e0, this.e1, this.e2, this.e3, lat);
        rh1 = this.a * (this.g - ml);
      }
      var theta = this.ns * common.adjust_lon(lon - this.long0);
      var x = this.x0 + rh1 * Math.sin(theta);
      var y = this.y0 + this.rh - rh1 * Math.cos(theta);
      p.x = x;
      p.y = y;
      return p;
    },

    /* Inverse equations
  -----------------*/
    inverse: function(p) {
      p.x -= this.x0;
      p.y = this.rh - p.y + this.y0;
      var con, rh1, lat, lon;
      if (this.ns >= 0) {
        rh1 = Math.sqrt(p.x * p.x + p.y * p.y);
        con = 1;
      }
      else {
        rh1 = -Math.sqrt(p.x * p.x + p.y * p.y);
        con = -1;
      }
      var theta = 0;
      if (rh1 !== 0) {
        theta = Math.atan2(con * p.x, con * p.y);
      }

      if (this.sphere) {
        lon = common.adjust_lon(this.long0 + theta / this.ns);
        lat = common.adjust_lat(this.g - rh1 / this.a);
        p.x = lon;
        p.y = lat;
        return p;
      }
      else {
        var ml = this.g - rh1 / this.a;
        lat = common.imlfn(ml, this.e0, this.e1, this.e2, this.e3);
        lon = common.adjust_lon(this.long0 + theta / this.ns);
        p.x = lon;
        p.y = lat;
        return p;
      }

    }




  };
});

define('projCode/vandg',['../common'],function(common) {
  return {

    /* Initialize the Van Der Grinten projection
  ----------------------------------------*/
    init: function() {
      //this.R = 6370997; //Radius of earth
      this.R = this.a;
    },

    forward: function(p) {

      var lon = p.x;
      var lat = p.y;

      /* Forward equations
    -----------------*/
      var dlon = common.adjust_lon(lon - this.long0);
      var x, y;

      if (Math.abs(lat) <= common.EPSLN) {
        x = this.x0 + this.R * dlon;
        y = this.y0;
      }
      var theta = common.asinz(2 * Math.abs(lat / common.PI));
      if ((Math.abs(dlon) <= common.EPSLN) || (Math.abs(Math.abs(lat) - common.HALF_PI) <= common.EPSLN)) {
        x = this.x0;
        if (lat >= 0) {
          y = this.y0 + common.PI * this.R * Math.tan(0.5 * theta);
        }
        else {
          y = this.y0 + common.PI * this.R * -Math.tan(0.5 * theta);
        }
        //  return(OK);
      }
      var al = 0.5 * Math.abs((common.PI / dlon) - (dlon / common.PI));
      var asq = al * al;
      var sinth = Math.sin(theta);
      var costh = Math.cos(theta);

      var g = costh / (sinth + costh - 1);
      var gsq = g * g;
      var m = g * (2 / sinth - 1);
      var msq = m * m;
      var con = common.PI * this.R * (al * (g - msq) + Math.sqrt(asq * (g - msq) * (g - msq) - (msq + asq) * (gsq - msq))) / (msq + asq);
      if (dlon < 0) {
        con = -con;
      }
      x = this.x0 + con;
      //con = Math.abs(con / (common.PI * this.R));
      var q = asq + g;
      con = common.PI * this.R * (m * q - al * Math.sqrt((msq + asq) * (asq + 1) - q * q)) / (msq + asq);
      if (lat >= 0) {
        //y = this.y0 + common.PI * this.R * Math.sqrt(1 - con * con - 2 * al * con);
        y = this.y0 + con;
      }
      else {
        //y = this.y0 - common.PI * this.R * Math.sqrt(1 - con * con - 2 * al * con);
        y = this.y0 - con;
      }
      p.x = x;
      p.y = y;
      return p;
    },

    /* Van Der Grinten inverse equations--mapping x,y to lat/long
  ---------------------------------------------------------*/
    inverse: function(p) {
      var lon, lat;
      var xx, yy, xys, c1, c2, c3;
      var a1;
      var m1;
      var con;
      var th1;
      var d;

      /* inverse equations
    -----------------*/
      p.x -= this.x0;
      p.y -= this.y0;
      con = common.PI * this.R;
      xx = p.x / con;
      yy = p.y / con;
      xys = xx * xx + yy * yy;
      c1 = -Math.abs(yy) * (1 + xys);
      c2 = c1 - 2 * yy * yy + xx * xx;
      c3 = -2 * c1 + 1 + 2 * yy * yy + xys * xys;
      d = yy * yy / c3 + (2 * c2 * c2 * c2 / c3 / c3 / c3 - 9 * c1 * c2 / c3 / c3) / 27;
      a1 = (c1 - c2 * c2 / 3 / c3) / c3;
      m1 = 2 * Math.sqrt(-a1 / 3);
      con = ((3 * d) / a1) / m1;
      if (Math.abs(con) > 1) {
        if (con >= 0) {
          con = 1;
        }
        else {
          con = -1;
        }
      }
      th1 = Math.acos(con) / 3;
      if (p.y >= 0) {
        lat = (-m1 * Math.cos(th1 + common.PI / 3) - c2 / 3 / c3) * common.PI;
      }
      else {
        lat = -(-m1 * Math.cos(th1 + common.PI / 3) - c2 / 3 / c3) * common.PI;
      }

      if (Math.abs(xx) < common.EPSLN) {
        lon = this.long0;
      }
      else {
        lon = common.adjust_lon(this.long0 + common.PI * (xys - 1 + Math.sqrt(1 + 2 * (xx * xx - yy * yy) + xys * xys)) / 2 / xx);
      }

      p.x = lon;
      p.y = lat;
      return p;
    }
  };

});

define('projCode/aeqd',['../common'],function(common) {
  return {

    init: function() {
      this.sin_p12 = Math.sin(this.lat0);
      this.cos_p12 = Math.cos(this.lat0);
    },

    forward: function(p) {
      var lon = p.x;
      var lat = p.y;
      var sinphi = Math.sin(p.y);
      var cosphi = Math.cos(p.y);
      var dlon = common.adjust_lon(lon - this.long0);
      var e0, e1, e2, e3, Mlp, Ml, tanphi, Nl1, Nl, psi, Az, G, H, GH, Hs, c, kp, cos_c, s, s2, s3, s4, s5;
      if (this.sphere) {
        if (Math.abs(this.sin_p12 - 1) <= common.EPSLN) {
          //North Pole case
          p.x = this.x0 + this.a * (common.HALF_PI - lat) * Math.sin(dlon);
          p.y = this.y0 - this.a * (common.HALF_PI - lat) * Math.cos(dlon);
          return p;
        }
        else if (Math.abs(this.sin_p12 + 1) <= common.EPSLN) {
          //South Pole case
          p.x = this.x0 + this.a * (common.HALF_PI + lat) * Math.sin(dlon);
          p.y = this.y0 + this.a * (common.HALF_PI + lat) * Math.cos(dlon);
          return p;
        }
        else {
          //default case
          cos_c = this.sin_p12 * sinphi + this.cos_p12 * cosphi * Math.cos(dlon);
          c = Math.acos(cos_c);
          kp = c / Math.sin(c);
          p.x = this.x0 + this.a * kp * cosphi * Math.sin(dlon);
          p.y = this.y0 + this.a * kp * (this.cos_p12 * sinphi - this.sin_p12 * cosphi * Math.cos(dlon));
          return p;
        }
      }
      else {
        e0 = common.e0fn(this.es);
        e1 = common.e1fn(this.es);
        e2 = common.e2fn(this.es);
        e3 = common.e3fn(this.es);
        if (Math.abs(this.sin_p12 - 1) <= common.EPSLN) {
          //North Pole case
          Mlp = this.a * common.mlfn(e0, e1, e2, e3, common.HALF_PI);
          Ml = this.a * common.mlfn(e0, e1, e2, e3, lat);
          p.x = this.x0 + (Mlp - Ml) * Math.sin(dlon);
          p.y = this.y0 - (Mlp - Ml) * Math.cos(dlon);
          return p;
        }
        else if (Math.abs(this.sin_p12 + 1) <= common.EPSLN) {
          //South Pole case
          Mlp = this.a * common.mlfn(e0, e1, e2, e3, common.HALF_PI);
          Ml = this.a * common.mlfn(e0, e1, e2, e3, lat);
          p.x = this.x0 + (Mlp + Ml) * Math.sin(dlon);
          p.y = this.y0 + (Mlp + Ml) * Math.cos(dlon);
          return p;
        }
        else {
          //Default case
          tanphi = sinphi / cosphi;
          Nl1 = common.gN(this.a, this.e, this.sin_p12);
          Nl = common.gN(this.a, this.e, sinphi);
          psi = Math.atan((1 - this.es) * tanphi + this.es * Nl1 * this.sin_p12 / (Nl * cosphi));
          Az = Math.atan2(Math.sin(dlon), this.cos_p12 * Math.tan(psi) - this.sin_p12 * Math.cos(dlon));
          if (Az === 0) {
            s = Math.asin(this.cos_p12 * Math.sin(psi) - this.sin_p12 * Math.cos(psi));
          }
          else if (Math.abs(Math.abs(Az) - common.PI) <= common.EPSLN) {
            s = -Math.asin(this.cos_p12 * Math.sin(psi) - this.sin_p12 * Math.cos(psi));
          }
          else {
            s = Math.asin(Math.sin(dlon) * Math.cos(psi) / Math.sin(Az));
          }
          G = this.e * this.sin_p12 / Math.sqrt(1 - this.es);
          H = this.e * this.cos_p12 * Math.cos(Az) / Math.sqrt(1 - this.es);
          GH = G * H;
          Hs = H * H;
          s2 = s * s;
          s3 = s2 * s;
          s4 = s3 * s;
          s5 = s4 * s;
          c = Nl1 * s * (1 - s2 * Hs * (1 - Hs) / 6 + s3 / 8 * GH * (1 - 2 * Hs) + s4 / 120 * (Hs * (4 - 7 * Hs) - 3 * G * G * (1 - 7 * Hs)) - s5 / 48 * GH);
          p.x = this.x0 + c * Math.sin(Az);
          p.y = this.y0 + c * Math.cos(Az);
          return p;
        }
      }


    },

    inverse: function(p) {
      p.x -= this.x0;
      p.y -= this.y0;
      var rh, z, sinz, cosz, lon, lat, con, e0, e1, e2, e3, Mlp, M, N1, psi, Az, cosAz, tmp, A, B, D, Ee, F;
      if (this.sphere) {
        rh = Math.sqrt(p.x * p.x + p.y * p.y);
        if (rh > (2 * common.HALF_PI * this.a)) {
          //proj4.reportError("aeqdInvDataError");
          return;
        }
        z = rh / this.a;

        sinz = Math.sin(z);
        cosz = Math.cos(z);

        lon = this.long0;
        if (Math.abs(rh) <= common.EPSLN) {
          lat = this.lat0;
        }
        else {
          lat = common.asinz(cosz * this.sin_p12 + (p.y * sinz * this.cos_p12) / rh);
          con = Math.abs(this.lat0) - common.HALF_PI;
          if (Math.abs(con) <= common.EPSLN) {
            if (this.lat0 >= 0) {
              lon = common.adjust_lon(this.long0 + Math.atan2(p.x, - p.y));
            }
            else {
              lon = common.adjust_lon(this.long0 - Math.atan2(-p.x, p.y));
            }
          }
          else {
            /*con = cosz - this.sin_p12 * Math.sin(lat);
        if ((Math.abs(con) < common.EPSLN) && (Math.abs(p.x) < common.EPSLN)) {
          //no-op, just keep the lon value as is
        } else {
          var temp = Math.atan2((p.x * sinz * this.cos_p12), (con * rh));
          lon = common.adjust_lon(this.long0 + Math.atan2((p.x * sinz * this.cos_p12), (con * rh)));
        }*/
            lon = common.adjust_lon(this.long0 + Math.atan2(p.x * sinz, rh * this.cos_p12 * cosz - p.y * this.sin_p12 * sinz));
          }
        }

        p.x = lon;
        p.y = lat;
        return p;
      }
      else {
        e0 = common.e0fn(this.es);
        e1 = common.e1fn(this.es);
        e2 = common.e2fn(this.es);
        e3 = common.e3fn(this.es);
        if (Math.abs(this.sin_p12 - 1) <= common.EPSLN) {
          //North pole case
          Mlp = this.a * common.mlfn(e0, e1, e2, e3, common.HALF_PI);
          rh = Math.sqrt(p.x * p.x + p.y * p.y);
          M = Mlp - rh;
          lat = common.imlfn(M / this.a, e0, e1, e2, e3);
          lon = common.adjust_lon(this.long0 + Math.atan2(p.x, - 1 * p.y));
          p.x = lon;
          p.y = lat;
          return p;
        }
        else if (Math.abs(this.sin_p12 + 1) <= common.EPSLN) {
          //South pole case
          Mlp = this.a * common.mlfn(e0, e1, e2, e3, common.HALF_PI);
          rh = Math.sqrt(p.x * p.x + p.y * p.y);
          M = rh - Mlp;

          lat = common.imlfn(M / this.a, e0, e1, e2, e3);
          lon = common.adjust_lon(this.long0 + Math.atan2(p.x, p.y));
          p.x = lon;
          p.y = lat;
          return p;
        }
        else {
          //default case
          rh = Math.sqrt(p.x * p.x + p.y * p.y);
          Az = Math.atan2(p.x, p.y);
          N1 = common.gN(this.a, this.e, this.sin_p12);
          cosAz = Math.cos(Az);
          tmp = this.e * this.cos_p12 * cosAz;
          A = -tmp * tmp / (1 - this.es);
          B = 3 * this.es * (1 - A) * this.sin_p12 * this.cos_p12 * cosAz / (1 - this.es);
          D = rh / N1;
          Ee = D - A * (1 + A) * Math.pow(D, 3) / 6 - B * (1 + 3 * A) * Math.pow(D, 4) / 24;
          F = 1 - A * Ee * Ee / 2 - D * Ee * Ee * Ee / 6;
          psi = Math.asin(this.sin_p12 * Math.cos(Ee) + this.cos_p12 * Math.sin(Ee) * cosAz);
          lon = common.adjust_lon(this.long0 + Math.asin(Math.sin(Az) * Math.sin(Ee) / Math.cos(psi)));
          lat = Math.atan((1 - this.es * F * this.sin_p12 / Math.sin(psi)) * Math.tan(psi) / (1 - this.es));
          p.x = lon;
          p.y = lat;
          return p;
        }
      }

    }
  };

});

define('projections',['require','exports','module','./projCode/longlat','./projCode/tmerc','./projCode/utm','./projCode/sterea','./projCode/somerc','./projCode/omerc','./projCode/lcc','./projCode/krovak','./projCode/cass','./projCode/laea','./projCode/merc','./projCode/aea','./projCode/gnom','./projCode/cea','./projCode/eqc','./projCode/poly','./projCode/nzmg','./projCode/mill','./projCode/sinu','./projCode/moll','./projCode/eqdc','./projCode/vandg','./projCode/aeqd','./projCode/longlat'],function(require, exports) {
  exports.longlat = require('./projCode/longlat');
  exports.identity = exports.longlat;
  exports.tmerc = require('./projCode/tmerc');
  exports.utm = require('./projCode/utm');
  exports.sterea = require('./projCode/sterea');
  exports.somerc = require('./projCode/somerc');
  exports.omerc = require('./projCode/omerc');
  exports.lcc = require('./projCode/lcc');
  exports.krovak = require('./projCode/krovak');
  exports.cass = require('./projCode/cass');
  exports.laea = require('./projCode/laea');
  exports.merc = require('./projCode/merc');
  exports.aea = require('./projCode/aea');
  exports.gnom = require('./projCode/gnom');
  exports.cea = require('./projCode/cea');
  exports.eqc = require('./projCode/eqc');
  exports.poly = require('./projCode/poly');
  exports.nzmg = require('./projCode/nzmg');
  exports.mill = require('./projCode/mill');
  exports.sinu = require('./projCode/sinu');
  exports.moll = require('./projCode/moll');
  exports.eqdc = require('./projCode/eqdc');
  exports.vandg = require('./projCode/vandg');
  exports.aeqd = require('./projCode/aeqd');
  exports.longlat = require('./projCode/longlat');
  exports.identity = exports.longlat;
});

define('wkt',['./extend','./constants','./common'],function(extend,constants,common) {
  /*function flatten(a) {
    var out = [];
    a.forEach(function(v) {
      if (Array.isArray(v)) {
        out = out.concat(v);
      }
      else {
        out.push(v);
      }
    });
    if (out.every(function(aa) {
      return !Array.isArray(aa);
    })) {
      return out;
    }
    return flatten(out);
  }*/

  function mapit(obj, key, v) {
    obj[key] = v.map(function(aa) {
      var o = {};
      fromLisp(aa, o);
      return o;
    }).reduce(function(a, b) {
      return extend(a, b);
    }, {});
  }

  function fromLisp(v, obj) {
    var key;
    if (!Array.isArray(v)) {
      obj[v] = true;
      return;
    }
    else {
      key = v.shift();
      if (key === 'PARAMETER') {
        key = v.shift();
      }
      if (v.length === 1) {
        if (Array.isArray(v[0])) {
          obj[key] = {};
          fromLisp(v[0], obj[key]);
        }
        else {
          obj[key] = v[0];
        }
      }
      else if (!v.length) {
        obj[key] = true;
      }
      else if (key === 'TOWGS84') {
        obj[key] = v;
      }
      else {
        obj[key] = {};
        if (['UNIT', 'PRIMEM', 'VERT_DATUM'].indexOf(key) > -1) {
          obj[key] = {
            name: v[0].toLowerCase(),
            convert: v[1]
          };
          if (v.length === 3) {
            obj[key].auth = v[2];
          }
        }
        else if (key === 'SPHEROID') {
          obj[key] = {
            name: v[0],
            a: v[1],
            rf: v[2]
          };
          if (v.length === 4) {
            obj[key].auth = v[3];
          }
        }
        else if (['GEOGCS', 'GEOCCS', 'DATUM', 'VERT_CS', 'COMPD_CS', 'LOCAL_CS', 'FITTED_CS', 'LOCAL_DATUM'].indexOf(key) > -1) {
          v[0] = ['name', v[0]];
          mapit(obj, key, v);
        }
        else if (v.every(function(aa) {
          return Array.isArray(aa);
        })) {
          mapit(obj, key, v);
        }
        else {
          fromLisp(v, obj[key]);
        }
      }
    }
  }
  function rename(obj, params){
    var outName=params[0];
    var inName = params[1];
    if(!(outName in obj)&&(inName in obj)){
      obj[outName]=obj[inName];
      if(params.length===3){
        obj[outName]=params[2](obj[outName]);
      }
    }
  }
  function d2r(input){
    return input*common.D2R;
  }
  function cleanWKT(wkt){
    if(wkt.type === 'GEOGCS'){
      wkt.projName = 'longlat';
    }else if(wkt.type === 'LOCAL_CS'){
      wkt.projName = 'identity';
      wkt.local=true;
    }else{
      wkt.projName = constants.wktProjections[wkt.PROJECTION];
    }
    if(wkt.UNIT){
      wkt.units=wkt.UNIT.name.toLowerCase();
      if(wkt.units === 'metre'){
        wkt.units = 'meter';
      }
      wkt.unitsPerMeter=wkt.UNIT.convert;
    }
    
    if(wkt.GEOGCS){
      //if(wkt.GEOGCS.PRIMEM&&wkt.GEOGCS.PRIMEM.convert){
      //  wkt.from_greenwich=wkt.GEOGCS.PRIMEM.convert*common.D2R;
      //}
      if(wkt.GEOGCS.DATUM){
        wkt.datumCode=wkt.GEOGCS.DATUM.name.toLowerCase();
      }else{
        wkt.datumCode=wkt.GEOGCS.name.toLowerCase();
      }
      if(wkt.datumCode.slice(0,2)==='d_'){
        wkt.datumCode=wkt.datumCode.slice(2);
      }
      if(wkt.datumCode==='new_zealand_geodetic_datum_1949' || wkt.datumCode === 'new_zealand_1949'){
        wkt.datumCode='nzgd49';
      }
      if(wkt.datumCode.slice(-6)==='_ferro'){
        wkt.datumCode=wkt.datumCode.slice(0,-6);
      }
      if(wkt.datumCode.slice(-8)==='_jakarta'){
        wkt.datumCode=wkt.datumCode.slice(0,-8);
      }
      if(wkt.GEOGCS.DATUM && wkt.GEOGCS.DATUM.SPHEROID){
        wkt.ellps=wkt.GEOGCS.DATUM.SPHEROID.name.replace('_19','');
        if(wkt.ellps.toLowerCase().slice(0,13)==="international"){
          wkt.ellps='intl';
        }
        wkt.a = wkt.GEOGCS.DATUM.SPHEROID.a;
        wkt.rf = parseFloat(wkt.GEOGCS.DATUM.SPHEROID.rf,10);
      }
    }
    if(wkt.b && !isFinite(wkt.b)){
      wkt.b=wkt.a;
    }
    var renamer = rename.bind(null,wkt);
    var list = [
      ['standard_parallel_1','Standard_Parallel_1'],
      ['standard_parallel_2','Standard_Parallel_2'],
      ['false_easting','False_Easting'],
      ['false_northing','False_Northing'],
      ['central_meridian','Central_Meridian'],
      ['latitude_of_origin','Latitude_Of_Origin'],
      ['scale_factor','Scale_Factor'],
      ['k0','scale_factor'],
      ['latitude_of_center','Latitude_of_center'],
      ['lat0','latitude_of_center',d2r],
      ['longitude_of_center','Longitude_Of_Center'],
      ['longc','longitude_of_center',d2r],
      ['x0','false_easting',parseFloat],
      ['y0','false_northing',parseFloat],
      ['long0','central_meridian',d2r],
      ['lat0','latitude_of_origin',d2r],
      ['lat0','standard_parallel_1',d2r],
      ['lat1','standard_parallel_1',d2r],
      ['lat2','standard_parallel_2',d2r],
      ['alpha','azimuth',d2r],
      ['srsCode','name']
    ];
    list.forEach(renamer);
    if(!wkt.long0&&wkt.longc&&(wkt.PROJECTION==='Albers_Conic_Equal_Area'||wkt.PROJECTION==="Lambert_Azimuthal_Equal_Area")){
      wkt.long0=wkt.longc;
    }
  }
  return function(wkt, self) {
    var lisp = JSON.parse(("," + wkt).replace(/\,([A-Z_0-9]+?)(\[)/g, ',["$1",').slice(1).replace(/\,([A-Z_0-9]+?)\]/g, ',"$1"]'));
    var type = lisp.shift();
    var name = lisp.shift();
    lisp.unshift(['name', name]);
    lisp.unshift(['type', type]);
    lisp.unshift('output');
    var obj = {};
    fromLisp(lisp, obj);
    cleanWKT(obj.output);
    return extend(self,obj.output);
  };
});

define('Proj',['./extend','./common','./defs','./constants','./datum','./projections','./wkt','./projString'],function(extend, common, defs,constants,datum,projections,wkt,projStr) {
  
  var proj = function proj(srsCode) {
    if (!(this instanceof proj)) {
      return new proj(srsCode);
    }
    this.srsCodeInput = srsCode;
    var obj;
    if(typeof srsCode === 'string'){
    //check to see if this is a WKT string
      if(srsCode in defs){
        this.deriveConstants(defs[srsCode]);
        extend(this,defs[srsCode]);
      }else if ((srsCode.indexOf('GEOGCS') >= 0) || (srsCode.indexOf('GEOCCS') >= 0) || (srsCode.indexOf('PROJCS') >= 0) || (srsCode.indexOf('LOCAL_CS') >= 0)) {
        obj = wkt(srsCode);
        this.deriveConstants(obj);
        extend(this,obj);
        //this.loadProjCode(this.projName);
      }else if(srsCode[0]==='+'){
        obj = projStr(srsCode);
        this.deriveConstants(obj);
        extend(this,obj);
      }
    } else {
      this.deriveConstants(srsCode);
      extend(this,srsCode);
    }

    this.initTransforms(this.projName);
  };
  proj.prototype = {
    /**
     * Function: initTransforms
     *    Finalize the initialization of the Proj object
     *
     */
    initTransforms: function(projName) {
      if (!(projName in proj.projections)) {
        throw ("unknown projection " + projName);
      }
      extend(this, proj.projections[projName]);
      this.init();
    },
  
    deriveConstants: function(self) {
      // DGR 2011-03-20 : nagrids -> nadgrids
      if (self.nadgrids && self.nadgrids.length === 0) {
        self.nadgrids = null;
      }
      if (self.nadgrids) {
        self.grids = self.nadgrids.split(",");
        var g = null,
          l = self.grids.length;
        if (l > 0) {
          for (var i = 0; i < l; i++) {
            g = self.grids[i];
            var fg = g.split("@");
            if (fg[fg.length - 1] === "") {
              //proj4.reportError("nadgrids syntax error '" + self.nadgrids + "' : empty grid found");
              continue;
            }
            self.grids[i] = {
              mandatory: fg.length === 1, //@=> optional grid (no error if not found)
              name: fg[fg.length - 1],
              grid: constants.grids[fg[fg.length - 1]] //FIXME: grids loading ...
            };
            if (self.grids[i].mandatory && !self.grids[i].grid) {
              //proj4.reportError("Missing '" + self.grids[i].name + "'");
            }
          }
        }
        // DGR, 2011-03-20: grids is an array of objects that hold
        // the loaded grids, its name and the mandatory informations of it.
      }
      if (self.datumCode && self.datumCode !== 'none') {
        var datumDef = constants.Datum[self.datumCode];
        if (datumDef) {
          self.datum_params = datumDef.towgs84 ? datumDef.towgs84.split(',') : null;
          self.ellps = datumDef.ellipse;
          self.datumName = datumDef.datumName ? datumDef.datumName : self.datumCode;
        }
      }
      if (!self.a) { // do we have an ellipsoid?
        var ellipse = constants.Ellipsoid[self.ellps] ? constants.Ellipsoid[self.ellps] : constants.Ellipsoid.WGS84;
        extend(self, ellipse);
      }
      if (self.rf && !self.b) {
        self.b = (1.0 - 1.0 / self.rf) * self.a;
      }
      if (self.rf === 0 || Math.abs(self.a - self.b) < common.EPSLN) {
        self.sphere = true;
        self.b = self.a;
      }
      self.a2 = self.a * self.a; // used in geocentric
      self.b2 = self.b * self.b; // used in geocentric
      self.es = (self.a2 - self.b2) / self.a2; // e ^ 2
      self.e = Math.sqrt(self.es); // eccentricity
      if (self.R_A) {
        self.a *= 1 - self.es * (common.SIXTH + self.es * (common.RA4 + self.es * common.RA6));
        self.a2 = self.a * self.a;
        self.b2 = self.b * self.b;
        self.es = 0;
      }
      self.ep2 = (self.a2 - self.b2) / self.b2; // used in geocentric
      if (!self.k0) {
        self.k0 = 1.0; //default value
      }
      //DGR 2010-11-12: axis
      if (!self.axis) {
        self.axis = "enu";
      }
  
      self.datum = datum(self);
    }
  };
  proj.projections = projections;
  return proj;

});

define('datum_transform',['./common'],function(common) {
  return function(source, dest, point) {
    var wp, i, l;

    function checkParams(fallback) {
      return (fallback === common.PJD_3PARAM || fallback === common.PJD_7PARAM);
    }
    // Short cut if the datums are identical.
    if (source.compare_datums(dest)) {
      return point; // in this case, zero is sucess,
      // whereas cs_compare_datums returns 1 to indicate TRUE
      // confusing, should fix this
    }

    // Explicitly skip datum transform by setting 'datum=none' as parameter for either source or dest
    if (source.datum_type === common.PJD_NODATUM || dest.datum_type === common.PJD_NODATUM) {
      return point;
    }

    //DGR: 2012-07-29 : add nadgrids support (begin)
    var src_a = source.a;
    var src_es = source.es;

    var dst_a = dest.a;
    var dst_es = dest.es;

    var fallback = source.datum_type;
    // If this datum requires grid shifts, then apply it to geodetic coordinates.
    if (fallback === common.PJD_GRIDSHIFT) {
      if (this.apply_gridshift(source, 0, point) === 0) {
        source.a = common.SRS_WGS84_SEMIMAJOR;
        source.es = common.SRS_WGS84_ESQUARED;
      }
      else {
        // try 3 or 7 params transformation or nothing ?
        if (!source.datum_params) {
          source.a = src_a;
          source.es = source.es;
          return point;
        }
        wp = 1;
        for (i = 0, l = source.datum_params.length; i < l; i++) {
          wp *= source.datum_params[i];
        }
        if (wp === 0) {
          source.a = src_a;
          source.es = source.es;
          return point;
        }
        if (source.datum_params.length > 3) {
          fallback = common.PJD_7PARAM;
        }
        else {
          fallback = common.PJD_3PARAM;
        }
      }
    }
    if (dest.datum_type === common.PJD_GRIDSHIFT) {
      dest.a = common.SRS_WGS84_SEMIMAJOR;
      dest.es = common.SRS_WGS84_ESQUARED;
    }
    // Do we need to go through geocentric coordinates?
    if (source.es !== dest.es || source.a !== dest.a || checkParams(fallback) || checkParams(dest.datum_type)) {
      //DGR: 2012-07-29 : add nadgrids support (end)
      // Convert to geocentric coordinates.
      source.geodetic_to_geocentric(point);
      // CHECK_RETURN;
      // Convert between datums
      if (checkParams(source.datum_type)) {
        source.geocentric_to_wgs84(point);
        // CHECK_RETURN;
      }
      if (checkParams(dest.datum_type)) {
        dest.geocentric_from_wgs84(point);
        // CHECK_RETURN;
      }
      // Convert back to geodetic coordinates
      dest.geocentric_to_geodetic(point);
      // CHECK_RETURN;
    }
    // Apply grid shift to destination if required
    if (dest.datum_type === common.PJD_GRIDSHIFT) {
      this.apply_gridshift(dest, 1, point);
      // CHECK_RETURN;
    }

    source.a = src_a;
    source.es = src_es;
    dest.a = dst_a;
    dest.es = dst_es;

    return point;
  };
});

define('adjust_axis',[],function() {
  return function(crs, denorm, point) {
    var xin = point.x,
      yin = point.y,
      zin = point.z || 0.0;
    var v, t, i;
    for (i = 0; i < 3; i++) {
      if (denorm && i === 2 && point.z === undefined) {
        continue;
      }
      if (i === 0) {
        v = xin;
        t = 'x';
      }
      else if (i === 1) {
        v = yin;
        t = 'y';
      }
      else {
        v = zin;
        t = 'z';
      }
      switch (crs.axis[i]) {
      case 'e':
        point[t] = v;
        break;
      case 'w':
        point[t] = -v;
        break;
      case 'n':
        point[t] = v;
        break;
      case 's':
        point[t] = -v;
        break;
      case 'u':
        if (point[t] !== undefined) {
          point.z = v;
        }
        break;
      case 'd':
        if (point[t] !== undefined) {
          point.z = -v;
        }
        break;
      default:
        //console.log("ERROR: unknow axis ("+crs.axis[i]+") - check definition of "+crs.projName);
        return null;
      }
    }
    return point;
  };
});

define('transform',['./common','./datum_transform','./adjust_axis','./Proj'],function(common, datum_transform, adjust_axis,proj) {

  return function(source, dest, point) {
    var wgs84;

    function checkNotWGS(source, dest) {
      return ((source.datum.datum_type === common.PJD_3PARAM || source.datum.datum_type === common.PJD_7PARAM) && dest.datumCode !== "WGS84");
    }

    // Workaround for datum shifts towgs84, if either source or destination projection is not wgs84
    if (source.datum && dest.datum && (checkNotWGS(source, dest) || checkNotWGS(dest, source))) {
      wgs84 = new proj('WGS84');
      this.transform(source, wgs84, point);
      source = wgs84;
    }
    // DGR, 2010/11/12
    if (source.axis !== "enu") {
      adjust_axis(source, false, point);
    }
    // Transform source points to long/lat, if they aren't already.
    if (source.projName === "longlat") {
      point.x *= common.D2R; // convert degrees to radians
      point.y *= common.D2R;
    }
    else {
      if (source.to_meter) {
        point.x *= source.to_meter;
        point.y *= source.to_meter;
      }
      source.inverse(point); // Convert Cartesian to longlat
    }
    // Adjust for the prime meridian if necessary
    if (source.from_greenwich) {
      point.x += source.from_greenwich;
    }

    // Convert datums if needed, and if possible.
    point = datum_transform(source.datum, dest.datum, point);

    // Adjust for the prime meridian if necessary
    if (dest.from_greenwich) {
      point.x -= dest.from_greenwich;
    }

    if (dest.projName === "longlat") {
      // convert radians to decimal degrees
      point.x *= common.R2D;
      point.y *= common.R2D;
    }
    else { // else project
      dest.forward(point);
      if (dest.to_meter) {
        point.x /= dest.to_meter;
        point.y /= dest.to_meter;
      }
    }

    // DGR, 2010/11/12
    if (dest.axis !== "enu") {
      adjust_axis(dest, true, point);
    }

    return point;
  };
});

define('core',['./Point','./Proj','./transform'],function(point,proj,transform) {
  var wgs84 = proj('WGS84');
  return function(fromProj, toProj, coord) {
    var transformer = function(f, t, c) {
      var transformedArray;
      if (Array.isArray(c)) {
        transformedArray = transform(f, t, point(c));
        if (c.length === 3) {
          return [transformedArray.x, transformedArray.y, transformedArray.z];
        }
        else {
          return [transformedArray.x, transformedArray.y];
        }
      }
      else {
        return transform(fromProj, toProj, c);
      }
    };

    fromProj = fromProj instanceof proj ? fromProj :proj(fromProj);
    if (typeof toProj === 'undefined') {
      toProj = fromProj;
      fromProj = wgs84;
    }
    else if (typeof toProj === 'string') {
      toProj = proj(toProj);
    }
    else if (('x' in toProj) || Array.isArray(toProj)) {
      coord = toProj;
      toProj = fromProj;
      fromProj = wgs84;
    }
    else {
      toProj = toProj instanceof proj ? toProj : proj(toProj);
    }
    if (coord) {
      return transformer(fromProj, toProj, coord);
    }
    else {
      return {
        forward: function(coords) {
          return transformer(fromProj, toProj, coords);
        },
        inverse: function(coords) {
          return transformer(toProj, fromProj, coords);
        }
      };
    }
  };
});
define('proj4',['./core','./Proj','./Point','./defs','./transform','./mgrs'],function(proj4, Proj, Point,defs,transform,mgrs) {
  
  proj4.defaultDatum = 'WGS84'; //default datum
  proj4.Proj = Proj;
  proj4.WGS84 = new proj4.Proj('WGS84');
  proj4.Point = Point;
  proj4.defs = defs;
  proj4.transform = transform;
  proj4.mgrs = mgrs;
  return proj4;

});

/**

JSZip - A Javascript class for generating and reading zip files
<http://stuartk.com/jszip>

(c) 2009-2012 Stuart Knightley <stuart [at] stuartk.com>
Dual licenced under the MIT license or GPLv3. See https://raw.github.com/Stuk/jszip/master/LICENSE.markdown.

Usage:
   zip = new JSZip();
   zip.file("hello.txt", "Hello, World!").file("tempfile", "nothing");
   zip.folder("images").file("smile.gif", base64Data, {base64: true});
   zip.file("Xmas.txt", "Ho ho ho !", {date : new Date("December 25, 2007 00:00:01")});
   zip.remove("tempfile");

   base64zip = zip.generate();

**/

/**
 * Representation a of zip file in js
 * @constructor
 * @param {String=|ArrayBuffer=|Uint8Array=} data the data to load, if any (optional).
 * @param {Object=} options the options for creating this objects (optional).
 */
define('unzip',[],function(){
var JSZip = function(data, options) {
   // object containing the files :
   // {
   //   "folder/" : {...},
   //   "folder/data.txt" : {...}
   // }
   this.files = {};

   // Where we are in the hierarchy
   this.root = "";

   if (data) {
      this.load(data, options);
   }
};

JSZip.signature = {
   LOCAL_FILE_HEADER : "\x50\x4b\x03\x04",
   CENTRAL_FILE_HEADER : "\x50\x4b\x01\x02",
   CENTRAL_DIRECTORY_END : "\x50\x4b\x05\x06",
   ZIP64_CENTRAL_DIRECTORY_LOCATOR : "\x50\x4b\x06\x07",
   ZIP64_CENTRAL_DIRECTORY_END : "\x50\x4b\x06\x06",
   DATA_DESCRIPTOR : "\x50\x4b\x07\x08"
};

// Default properties for a new file
JSZip.defaults = {
   base64: false,
   binary: false,
   dir: false,
   date: null,
   compression: null
};


JSZip.prototype = (function () {
   /**
    * A simple object representing a file in the zip file.
    * @constructor
    * @param {string} name the name of the file
    * @param {string} data the data
    * @param {Object} options the options of the file
    */
   var ZipObject = function (name, data, options) {
      this.name = name;
      this.data = data;
      this.options = options;
   };

   ZipObject.prototype = {
      /**
       * Return the content as UTF8 string.
       * @return {string} the UTF8 string.
       */
      asText : function () {
         var result = this.data;
         if (result === null || typeof result === "undefined") {
            return "";
         }
         if (this.options.base64) {
            result = JSZipBase64.decode(result);
         }
         if (this.options.binary) {
            result = JSZip.prototype.utf8decode(result);
         }
         return result;
      },
      /**
       * Returns the binary content.
       * @return {string} the content as binary.
       */
      asBinary : function () {
         var result = this.data;
         if (result === null || typeof result === "undefined") {
            return "";
         }
         if (this.options.base64) {
            result = JSZipBase64.decode(result);
         }
         if (!this.options.binary) {
            result = JSZip.prototype.utf8encode(result);
         }
         return result;
      },
      /**
       * Returns the content as an Uint8Array.
       * @return {Uint8Array} the content as an Uint8Array.
       */
      asUint8Array : function () {
         return JSZip.utils.string2Uint8Array(this.asBinary());
      },
      /**
       * Returns the content as an ArrayBuffer.
       * @return {ArrayBuffer} the content as an ArrayBufer.
       */
      asArrayBuffer : function () {
         return JSZip.utils.string2Uint8Array(this.asBinary()).buffer;
      }
   };

   /**
    * Transform an integer into a string in hexadecimal.
    * @private
    * @param {number} dec the number to convert.
    * @param {number} bytes the number of bytes to generate.
    * @returns {string} the result.
    */
   var decToHex = function(dec, bytes) {
      var hex = "", i;
      for(i = 0; i < bytes; i++) {
         hex += String.fromCharCode(dec&0xff);
         dec=dec>>>8;
      }
      return hex;
   };

   /**
    * Merge the objects passed as parameters into a new one.
    * @private
    * @param {...Object} var_args All objects to merge.
    * @return {Object} a new object with the data of the others.
    */
   var extend = function () {
      var result = {}, i, attr;
      for (i = 0; i < arguments.length; i++) { // arguments is not enumerable in some browsers
         for (attr in arguments[i]) {
            if (arguments[i].hasOwnProperty(attr) && typeof result[attr] === "undefined") {
               result[attr] = arguments[i][attr];
            }
         }
      }
      return result;
   };

   /**
    * Transforms the (incomplete) options from the user into the complete
    * set of options to create a file.
    * @private
    * @param {Object} o the options from the user.
    * @return {Object} the complete set of options.
    */
   var prepareFileAttrs = function (o) {
      o = o || {};
      if (o.base64 === true && o.binary == null) {
         o.binary = true;
      }
      o = extend(o, JSZip.defaults);
      o.date = o.date || new Date();
      if (o.compression !== null) o.compression = o.compression.toUpperCase();

      return o;
   };

  /**
   * Add a file in the current folder.
   * @private
   * @param {string} name the name of the file
   * @param {String|ArrayBuffer|Uint8Array} data the data of the file
   * @param {Object} o the options of the file
   * @return {Object} the new file.
   */
   var fileAdd = function (name, data, o) {
      // be sure sub folders exist
      var parent = parentFolder(name);
      if (parent) {
         folderAdd.call(this, parent);
      }

      o = prepareFileAttrs(o);

      if (o.dir || data === null || typeof data === "undefined") {
         o.base64 = false;
         o.binary = false;
         data = null;
      } else if (JSZip.support.uint8array && data instanceof Uint8Array) {
         o.base64 = false;
         o.binary = true;
         data = JSZip.utils.uint8Array2String(data);
      } else if (JSZip.support.arraybuffer && data instanceof ArrayBuffer) {
         o.base64 = false;
         o.binary = true;
         var bufferView = new Uint8Array(data);
         data = JSZip.utils.uint8Array2String(bufferView);
      } else if (o.binary && !o.base64) {
         // optimizedBinaryString == true means that the file has already been filtered with a 0xFF mask
         if (o.optimizedBinaryString !== true) {
            // this is a string, not in a base64 format.
            // Be sure that this is a correct "binary string"
            data = JSZip.utils.string2binary(data);
         }
         // we remove this option since it's only relevant here
         delete o.optimizedBinaryString;
      }

      return this.files[name] = new ZipObject(name, data, o);
   };


   /**
    * Find the parent folder of the path.
    * @private
    * @param {string} path the path to use
    * @return {string} the parent folder, or ""
    */
   var parentFolder = function (path) {
      if (path.slice(-1) == '/') {
         path = path.substring(0, path.length - 1);
      }
      var lastSlash = path.lastIndexOf('/');
      return (lastSlash > 0) ? path.substring(0, lastSlash) : "";
   };

   /**
    * Add a (sub) folder in the current folder.
    * @private
    * @param {string} name the folder's name
    * @return {Object} the new folder.
    */
   var folderAdd = function (name) {
      // Check the name ends with a /
      if (name.slice(-1) != "/") {
         name += "/"; // IE doesn't like substr(-1)
      }

      // Does this folder already exist?
      if (!this.files[name]) {
         // be sure sub folders exist
         var parent = parentFolder(name);
         if (parent) {
            folderAdd.call(this, parent);
         }

         fileAdd.call(this, name, null, {dir:true});
      }
      return this.files[name];
   };

   /**
    * Generate the data found in the local header of a zip file.
    * Do not create it now, as some parts are re-used later.
    * @private
    * @param {Object} file the file to use.
    * @param {string} utfEncodedFileName the file name, utf8 encoded.
    * @param {string} compressionType the compression to use.
    * @return {Object} an object containing header and compressedData.
    */
   var prepareLocalHeaderData = function(file, utfEncodedFileName, compressionType) {
      var useUTF8 = utfEncodedFileName !== file.name,
          data    = file.asBinary(),
          o       = file.options,
          dosTime,
          dosDate;

      // date
      // @see http://www.delorie.com/djgpp/doc/rbinter/it/52/13.html
      // @see http://www.delorie.com/djgpp/doc/rbinter/it/65/16.html
      // @see http://www.delorie.com/djgpp/doc/rbinter/it/66/16.html

      dosTime = o.date.getHours();
      dosTime = dosTime << 6;
      dosTime = dosTime | o.date.getMinutes();
      dosTime = dosTime << 5;
      dosTime = dosTime | o.date.getSeconds() / 2;

      dosDate = o.date.getFullYear() - 1980;
      dosDate = dosDate << 4;
      dosDate = dosDate | (o.date.getMonth() + 1);
      dosDate = dosDate << 5;
      dosDate = dosDate | o.date.getDate();

      var hasData = data !== null && data.length !== 0;

      compressionType = o.compression || compressionType;
      if (!JSZip.compressions[compressionType]) {
         throw compressionType + " is not a valid compression method !";
      }

      var compression    = JSZip.compressions[compressionType];
      var compressedData = hasData ? compression.compress(data) : '';

      var header = "";

      // version needed to extract
      header += "\x0A\x00";
      // general purpose bit flag
      // set bit 11 if utf8
      header += useUTF8 ? "\x00\x08" : "\x00\x00";
      // compression method
      header += hasData ? compression.magic : JSZip.compressions['STORE'].magic;
      // last mod file time
      header += decToHex(dosTime, 2);
      // last mod file date
      header += decToHex(dosDate, 2);
      // crc-32
      header += hasData ? decToHex(this.crc32(data), 4) : '\x00\x00\x00\x00';
      // compressed size
      header += hasData ? decToHex(compressedData.length, 4) : '\x00\x00\x00\x00';
      // uncompressed size
      header += hasData ? decToHex(data.length, 4) : '\x00\x00\x00\x00';
      // file name length
      header += decToHex(utfEncodedFileName.length, 2);
      // extra field length
      header += "\x00\x00";

      return {
         header:header,
         compressedData:compressedData
      };
   };


   // return the actual prototype of JSZip
   return {
      /**
       * Read an existing zip and merge the data in the current JSZip object.
       * The implementation is in jszip-load.js, don't forget to include it.
       * @param {String|ArrayBuffer|Uint8Array} stream  The stream to load
       * @param {Object} options Options for loading the stream.
       *  options.base64 : is the stream in base64 ? default : false
       * @return {JSZip} the current JSZip object
       */
      load : function (stream, options) {
         throw new Error("Load method is not defined. Is the file jszip-load.js included ?");
      },

      /**
       * Filter nested files/folders with the specified function.
       * @param {Function} search the predicate to use :
       * function (relativePath, file) {...}
       * It takes 2 arguments : the relative path and the file.
       * @return {Array} An array of matching elements.
       */
      filter : function (search) {
         var result = [], filename, relativePath, file, fileClone;
         for (filename in this.files) {
            if ( !this.files.hasOwnProperty(filename) ) { continue; }
            file = this.files[filename];
            // return a new object, don't let the user mess with our internal objects :)
            fileClone = new ZipObject(file.name, file.data, extend(file.options));
            relativePath = filename.slice(this.root.length, filename.length);
            if (filename.slice(0, this.root.length) === this.root && // the file is in the current root
                search(relativePath, fileClone)) { // and the file matches the function
               result.push(fileClone);
            }
         }
         return result;
      },

      /**
       * Add a file to the zip file, or search a file.
       * @param   {string|RegExp} name The name of the file to add (if data is defined),
       * the name of the file to find (if no data) or a regex to match files.
       * @param   {String|ArrayBuffer|Uint8Array} data  The file data, either raw or base64 encoded
       * @param   {Object} o     File options
       * @return  {JSZip|Object|Array} this JSZip object (when adding a file),
       * a file (when searching by string) or an array of files (when searching by regex).
       */
      file : function(name, data, o) {
         if (arguments.length === 1) {
            if (name instanceof RegExp) {
               var regexp = name;
               return this.filter(function(relativePath, file) {
                  return !file.options.dir && regexp.test(relativePath);
               });
            } else { // text
               return this.filter(function (relativePath, file) {
                  return !file.options.dir && relativePath === name;
               })[0]||null;
            }
         } else { // more than one argument : we have data !
            name = this.root+name;
            fileAdd.call(this, name, data, o);
         }
         return this;
      },

      /**
       * Add a directory to the zip file, or search.
       * @param   {String|RegExp} arg The name of the directory to add, or a regex to search folders.
       * @return  {JSZip} an object with the new directory as the root, or an array containing matching folders.
       */
      folder : function(arg) {
         if (!arg) {
            return this;
         }

         if (arg instanceof RegExp) {
            return this.filter(function(relativePath, file) {
               return file.options.dir && arg.test(relativePath);
            });
         }

         // else, name is a new folder
         var name = this.root + arg;
         var newFolder = folderAdd.call(this, name);

         // Allow chaining by returning a new object with this folder as the root
         var ret = this.clone();
         ret.root = newFolder.name;
         return ret;
      },

      /**
       * Delete a file, or a directory and all sub-files, from the zip
       * @param {string} name the name of the file to delete
       * @return {JSZip} this JSZip object
       */
      remove : function(name) {
         name = this.root + name;
         var file = this.files[name];
         if (!file) {
            // Look for any folders
            if (name.slice(-1) != "/") {
               name += "/";
            }
            file = this.files[name];
         }

         if (file) {
            if (!file.options.dir) {
               // file
               delete this.files[name];
            } else {
               // folder
               var kids = this.filter(function (relativePath, file) {
                  return file.name.slice(0, name.length) === name;
               });
               for (var i = 0; i < kids.length; i++) {
                  delete this.files[kids[i].name];
               }
            }
         }

         return this;
      },

      /**
       * Generate the complete zip file
       * @param {Object} options the options to generate the zip file :
       * - base64, (deprecated, use type instead) true to generate base64.
       * - compression, "STORE" by default.
       * - type, "base64" by default. Values are : string, base64, uint8array, arraybuffer, blob.
       * @return {String|Uint8Array|ArrayBuffer|Blob} the zip file
       */
      generate : function(options) {
         options = extend(options || {}, {
            base64 : true,
            compression : "STORE",
            type : "base64"
         });
         var compression = options.compression.toUpperCase();

         if (!JSZip.compressions[compression]) {
            throw compression + " is not a valid compression method !";
         }

         // The central directory, and files data
         var directory = [], files = [], fileOffset = 0;

         for (var name in this.files) {
            if ( !this.files.hasOwnProperty(name) ) { continue; }

            var file = this.files[name];

            var utfEncodedFileName = this.utf8encode(file.name);

            var fileRecord = "",
            dirRecord = "",
            data = prepareLocalHeaderData.call(this, file, utfEncodedFileName, compression);
            fileRecord = JSZip.signature.LOCAL_FILE_HEADER + data.header + utfEncodedFileName + data.compressedData;

            dirRecord = JSZip.signature.CENTRAL_FILE_HEADER +
            // version made by (00: DOS)
            "\x14\x00" +
            // file header (common to file and central directory)
            data.header +
            // file comment length
            "\x00\x00" +
            // disk number start
            "\x00\x00" +
            // internal file attributes TODO
            "\x00\x00" +
            // external file attributes
            (this.files[name].options.dir===true?"\x10\x00\x00\x00":"\x00\x00\x00\x00")+
            // relative offset of local header
            decToHex(fileOffset, 4) +
            // file name
            utfEncodedFileName;

            fileOffset += fileRecord.length;

            files.push(fileRecord);
            directory.push(dirRecord);
         }

         var fileData = files.join("");
         var dirData = directory.join("");

         var dirEnd = "";

         // end of central dir signature
         dirEnd = JSZip.signature.CENTRAL_DIRECTORY_END +
         // number of this disk
         "\x00\x00" +
         // number of the disk with the start of the central directory
         "\x00\x00" +
         // total number of entries in the central directory on this disk
         decToHex(files.length, 2) +
         // total number of entries in the central directory
         decToHex(files.length, 2) +
         // size of the central directory   4 bytes
         decToHex(dirData.length, 4) +
         // offset of start of central directory with respect to the starting disk number
         decToHex(fileData.length, 4) +
         // .ZIP file comment length
         "\x00\x00";

         var zip = fileData + dirData + dirEnd;


         switch(options.type.toLowerCase()) {
            case "uint8array" :
               return JSZip.utils.string2Uint8Array(zip);
            case "arraybuffer" :
               return JSZip.utils.string2Uint8Array(zip).buffer;
            case "blob" :
               return JSZip.utils.string2Blob(zip);
            case "base64" :
               return (options.base64) ? JSZipBase64.encode(zip) : zip;
            default : // case "string" :
               return zip;
         }
      },

      /**
       *
       *  Javascript crc32
       *  http://www.webtoolkit.info/
       *
       */
      crc32 : function(str, crc) {

         if (str === "" || typeof str === "undefined") {
            return 0;
         }

         var table = [
            0x00000000, 0x77073096, 0xEE0E612C, 0x990951BA,
            0x076DC419, 0x706AF48F, 0xE963A535, 0x9E6495A3,
            0x0EDB8832, 0x79DCB8A4, 0xE0D5E91E, 0x97D2D988,
            0x09B64C2B, 0x7EB17CBD, 0xE7B82D07, 0x90BF1D91,
            0x1DB71064, 0x6AB020F2, 0xF3B97148, 0x84BE41DE,
            0x1ADAD47D, 0x6DDDE4EB, 0xF4D4B551, 0x83D385C7,
            0x136C9856, 0x646BA8C0, 0xFD62F97A, 0x8A65C9EC,
            0x14015C4F, 0x63066CD9, 0xFA0F3D63, 0x8D080DF5,
            0x3B6E20C8, 0x4C69105E, 0xD56041E4, 0xA2677172,
            0x3C03E4D1, 0x4B04D447, 0xD20D85FD, 0xA50AB56B,
            0x35B5A8FA, 0x42B2986C, 0xDBBBC9D6, 0xACBCF940,
            0x32D86CE3, 0x45DF5C75, 0xDCD60DCF, 0xABD13D59,
            0x26D930AC, 0x51DE003A, 0xC8D75180, 0xBFD06116,
            0x21B4F4B5, 0x56B3C423, 0xCFBA9599, 0xB8BDA50F,
            0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924,
            0x2F6F7C87, 0x58684C11, 0xC1611DAB, 0xB6662D3D,
            0x76DC4190, 0x01DB7106, 0x98D220BC, 0xEFD5102A,
            0x71B18589, 0x06B6B51F, 0x9FBFE4A5, 0xE8B8D433,
            0x7807C9A2, 0x0F00F934, 0x9609A88E, 0xE10E9818,
            0x7F6A0DBB, 0x086D3D2D, 0x91646C97, 0xE6635C01,
            0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E,
            0x6C0695ED, 0x1B01A57B, 0x8208F4C1, 0xF50FC457,
            0x65B0D9C6, 0x12B7E950, 0x8BBEB8EA, 0xFCB9887C,
            0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3, 0xFBD44C65,
            0x4DB26158, 0x3AB551CE, 0xA3BC0074, 0xD4BB30E2,
            0x4ADFA541, 0x3DD895D7, 0xA4D1C46D, 0xD3D6F4FB,
            0x4369E96A, 0x346ED9FC, 0xAD678846, 0xDA60B8D0,
            0x44042D73, 0x33031DE5, 0xAA0A4C5F, 0xDD0D7CC9,
            0x5005713C, 0x270241AA, 0xBE0B1010, 0xC90C2086,
            0x5768B525, 0x206F85B3, 0xB966D409, 0xCE61E49F,
            0x5EDEF90E, 0x29D9C998, 0xB0D09822, 0xC7D7A8B4,
            0x59B33D17, 0x2EB40D81, 0xB7BD5C3B, 0xC0BA6CAD,
            0xEDB88320, 0x9ABFB3B6, 0x03B6E20C, 0x74B1D29A,
            0xEAD54739, 0x9DD277AF, 0x04DB2615, 0x73DC1683,
            0xE3630B12, 0x94643B84, 0x0D6D6A3E, 0x7A6A5AA8,
            0xE40ECF0B, 0x9309FF9D, 0x0A00AE27, 0x7D079EB1,
            0xF00F9344, 0x8708A3D2, 0x1E01F268, 0x6906C2FE,
            0xF762575D, 0x806567CB, 0x196C3671, 0x6E6B06E7,
            0xFED41B76, 0x89D32BE0, 0x10DA7A5A, 0x67DD4ACC,
            0xF9B9DF6F, 0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5,
            0xD6D6A3E8, 0xA1D1937E, 0x38D8C2C4, 0x4FDFF252,
            0xD1BB67F1, 0xA6BC5767, 0x3FB506DD, 0x48B2364B,
            0xD80D2BDA, 0xAF0A1B4C, 0x36034AF6, 0x41047A60,
            0xDF60EFC3, 0xA867DF55, 0x316E8EEF, 0x4669BE79,
            0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236,
            0xCC0C7795, 0xBB0B4703, 0x220216B9, 0x5505262F,
            0xC5BA3BBE, 0xB2BD0B28, 0x2BB45A92, 0x5CB36A04,
            0xC2D7FFA7, 0xB5D0CF31, 0x2CD99E8B, 0x5BDEAE1D,
            0x9B64C2B0, 0xEC63F226, 0x756AA39C, 0x026D930A,
            0x9C0906A9, 0xEB0E363F, 0x72076785, 0x05005713,
            0x95BF4A82, 0xE2B87A14, 0x7BB12BAE, 0x0CB61B38,
            0x92D28E9B, 0xE5D5BE0D, 0x7CDCEFB7, 0x0BDBDF21,
            0x86D3D2D4, 0xF1D4E242, 0x68DDB3F8, 0x1FDA836E,
            0x81BE16CD, 0xF6B9265B, 0x6FB077E1, 0x18B74777,
            0x88085AE6, 0xFF0F6A70, 0x66063BCA, 0x11010B5C,
            0x8F659EFF, 0xF862AE69, 0x616BFFD3, 0x166CCF45,
            0xA00AE278, 0xD70DD2EE, 0x4E048354, 0x3903B3C2,
            0xA7672661, 0xD06016F7, 0x4969474D, 0x3E6E77DB,
            0xAED16A4A, 0xD9D65ADC, 0x40DF0B66, 0x37D83BF0,
            0xA9BCAE53, 0xDEBB9EC5, 0x47B2CF7F, 0x30B5FFE9,
            0xBDBDF21C, 0xCABAC28A, 0x53B39330, 0x24B4A3A6,
            0xBAD03605, 0xCDD70693, 0x54DE5729, 0x23D967BF,
            0xB3667A2E, 0xC4614AB8, 0x5D681B02, 0x2A6F2B94,
            0xB40BBE37, 0xC30C8EA1, 0x5A05DF1B, 0x2D02EF8D
         ];

         if (typeof(crc) == "undefined") { crc = 0; }
         var x = 0;
         var y = 0;

         crc = crc ^ (-1);
         for( var i = 0, iTop = str.length; i < iTop; i++ ) {
            y = ( crc ^ str.charCodeAt( i ) ) & 0xFF;
            x = table[y];
            crc = ( crc >>> 8 ) ^ x;
         }

         return crc ^ (-1);
      },

      // Inspired by http://my.opera.com/GreyWyvern/blog/show.dml/1725165
      clone : function() {
         var newObj = new JSZip();
         for (var i in this) {
            if (typeof this[i] !== "function") {
               newObj[i] = this[i];
            }
         }
         return newObj;
      },


      /**
       * http://www.webtoolkit.info/javascript-utf8.html
       */
      utf8encode : function (string) {
         var utftext = "";

         for (var n = 0; n < string.length; n++) {

            var c = string.charCodeAt(n);

            if (c < 128) {
               utftext += String.fromCharCode(c);
            } else if ((c > 127) && (c < 2048)) {
               utftext += String.fromCharCode((c >> 6) | 192);
               utftext += String.fromCharCode((c & 63) | 128);
            } else {
               utftext += String.fromCharCode((c >> 12) | 224);
               utftext += String.fromCharCode(((c >> 6) & 63) | 128);
               utftext += String.fromCharCode((c & 63) | 128);
            }

         }

         return utftext;
      },

      /**
       * http://www.webtoolkit.info/javascript-utf8.html
       */
      utf8decode : function (utftext) {
         var string = "";
         var i = 0;
         var c = 0, c1 = 0, c2 = 0, c3 = 0;

         while ( i < utftext.length ) {

            c = utftext.charCodeAt(i);

            if (c < 128) {
               string += String.fromCharCode(c);
               i++;
            } else if ((c > 191) && (c < 224)) {
               c2 = utftext.charCodeAt(i+1);
               string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
               i += 2;
            } else {
               c2 = utftext.charCodeAt(i+1);
               c3 = utftext.charCodeAt(i+2);
               string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
               i += 3;
            }

         }

         return string;
      }
   };
}());

/*
 * Compression methods
 * This object is filled in as follow :
 * name : {
 *    magic // the 2 bytes indentifying the compression method
 *    compress // function, take the uncompressed content and return it compressed.
 *    uncompress // function, take the compressed content and return it uncompressed.
 * }
 *
 * STORE is the default compression method, so it's included in this file.
 * Other methods should go to separated files : the user wants modularity.
 */
JSZip.compressions = {
   "STORE" : {
      magic : "\x00\x00",
      compress : function (content) {
         return content; // no compression
      },
      uncompress : function (content) {
         return content; // no compression
      }
   }
};

/*
 * List features that require a modern browser, and if the current browser support them.
 */
JSZip.support = {
   // contains true if JSZip can read/generate ArrayBuffer, false otherwise.
   arraybuffer : (function(){
      return typeof ArrayBuffer !== "undefined" && typeof Uint8Array !== "undefined";
   })(),
   // contains true if JSZip can read/generate Uint8Array, false otherwise.
   uint8array : (function(){
      return typeof Uint8Array !== "undefined";
   })(),
   // contains true if JSZip can read/generate Blob, false otherwise.
   blob : (function(){
      // the spec started with BlobBuilder then replaced it with a construtor for Blob.
      // Result : we have browsers that :
      // * know the BlobBuilder (but with prefix)
      // * know the Blob constructor
      // * know about Blob but not about how to build them
      // About the "=== 0" test : if given the wrong type, it may be converted to a string.
      // Instead of an empty content, we will get "[object Uint8Array]" for example.
      if (typeof ArrayBuffer === "undefined") {
         return false;
      }
      var buffer = new ArrayBuffer(0);
      try {
         return new Blob([buffer], { type: "application/zip" }).size === 0;
      }
      catch(e) {}

      try {
         var builder = new (window.BlobBuilder || window.WebKitBlobBuilder ||
                            window.MozBlobBuilder || window.MSBlobBuilder)();
         builder.append(buffer);
         return builder.getBlob('application/zip').size === 0;
      }
      catch(e) {}

      return false;
   })()
};

JSZip.utils = {
   /**
    * Convert a string to a "binary string" : a string containing only char codes between 0 and 255.
    * @param {string} str the string to transform.
    * @return {String} the binary string.
    */
   string2binary : function (str) {
      var result = "";
      for (var i = 0; i < str.length; i++) {
         result += String.fromCharCode(str.charCodeAt(i) & 0xff);
      }
      return result;
   },
   /**
    * Create a Uint8Array from the string.
    * @param {string} str the string to transform.
    * @return {Uint8Array} the typed array.
    * @throws {Error} an Error if the browser doesn't support the requested feature.
    */
   string2Uint8Array : function (str) {
      if (!JSZip.support.uint8array) {
         throw new Error("Uint8Array is not supported by this browser");
      }
      var buffer = new ArrayBuffer(str.length);
      var bufferView = new Uint8Array(buffer);
      for(var i = 0; i < str.length; i++) {
         bufferView[i] = str.charCodeAt(i);
      }

      return bufferView;
   },

   /**
    * Create a string from the Uint8Array.
    * @param {Uint8Array} array the array to transform.
    * @return {string} the string.
    * @throws {Error} an Error if the browser doesn't support the requested feature.
    */
   uint8Array2String : function (array) {
      if (!JSZip.support.uint8array) {
         throw new Error("Uint8Array is not supported by this browser");
      }
      var result = "";
      for(var i = 0; i < array.length; i++) {
         result += String.fromCharCode(array[i]);
      }

      return result;
   },
   /**
    * Create a blob from the given string.
    * @param {string} str the string to transform.
    * @return {Blob} the string.
    * @throws {Error} an Error if the browser doesn't support the requested feature.
    */
   string2Blob : function (str) {
      if (!JSZip.support.blob) {
         throw new Error("Blob is not supported by this browser");
      }

      var buffer = JSZip.utils.string2Uint8Array(str).buffer;
      try {
         // Blob constructor
         return new Blob([buffer], { type: "application/zip" });
      }
      catch(e) {}

      try {
         // deprecated, browser only, old way
         var builder = new (window.BlobBuilder || window.WebKitBlobBuilder ||
                            window.MozBlobBuilder || window.MSBlobBuilder)();
         builder.append(buffer);
         return builder.getBlob('application/zip');
      }
      catch(e) {}

      // well, fuck ?!
      throw new Error("Bug : can't construct the Blob.");
   }
};

/**
 *
 *  Base64 encode / decode
 *  http://www.webtoolkit.info/
 *
 *  Hacked so that it doesn't utf8 en/decode everything
 **/
var JSZipBase64 = (function() {
   // private property
   var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

   return {
      // public method for encoding
      encode : function(input, utf8) {
         var output = "";
         var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
         var i = 0;

         while (i < input.length) {

            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);

            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;

            if (isNaN(chr2)) {
               enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
               enc4 = 64;
            }

            output = output +
               _keyStr.charAt(enc1) + _keyStr.charAt(enc2) +
               _keyStr.charAt(enc3) + _keyStr.charAt(enc4);

         }

         return output;
      },

      // public method for decoding
      decode : function(input, utf8) {
         var output = "";
         var chr1, chr2, chr3;
         var enc1, enc2, enc3, enc4;
         var i = 0;

         input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

         while (i < input.length) {

            enc1 = _keyStr.indexOf(input.charAt(i++));
            enc2 = _keyStr.indexOf(input.charAt(i++));
            enc3 = _keyStr.indexOf(input.charAt(i++));
            enc4 = _keyStr.indexOf(input.charAt(i++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            output = output + String.fromCharCode(chr1);

            if (enc3 != 64) {
               output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
               output = output + String.fromCharCode(chr3);
            }

         }

         return output;

      }
   };
}());

/**

JSZip - A Javascript class for generating and reading zip files
<http://stuartk.com/jszip>

(c) 2011 David Duponchel <d.duponchel@gmail.com>
Dual licenced under the MIT license or GPLv3. See LICENSE.markdown.

**/
/*global JSZip,JSZipBase64 */
(function () {

   var MAX_VALUE_16BITS = 65535;
   var MAX_VALUE_32BITS = -1; // well, "\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF" is parsed as -1

   /**
    * Prettify a string read as binary.
    * @param {string} str the string to prettify.
    * @return {string} a pretty string.
    */
   var pretty = function (str) {
      var res = '', code, i;
      for (i = 0; i < (str||"").length; i++) {
         code = str.charCodeAt(i);
         res += '\\x' + (code < 16 ? "0" : "") + code.toString(16).toUpperCase();
      }
      return res;
   };

   /**
    * Find a compression registered in JSZip.
    * @param {string} compressionMethod the method magic to find.
    * @return {Object|null} the JSZip compression object, null if none found.
    */
   var findCompression = function (compressionMethod) {
      for (var method in JSZip.compressions) {
         if( !JSZip.compressions.hasOwnProperty(method) ) { continue; }
         if (JSZip.compressions[method].magic === compressionMethod) {
            return JSZip.compressions[method];
         }
      }
      return null;
   };

   // class StreamReader {{{
   /**
    * Read bytes from a stream.
    * Developer tip : when debugging, a watch on pretty(this.reader.stream.slice(this.reader.index))
    * is very useful :)
    * @constructor
    * @param {String|ArrayBuffer|Uint8Array} stream the stream to read.
    */
   function StreamReader(stream) {
      this.stream = "";
      if (JSZip.support.uint8array && stream instanceof Uint8Array) {
         this.stream = JSZip.utils.uint8Array2String(stream);
      } else if (JSZip.support.arraybuffer && stream instanceof ArrayBuffer) {
         var bufferView = new Uint8Array(stream);
         this.stream = JSZip.utils.uint8Array2String(bufferView);
      } else {
         this.stream = JSZip.utils.string2binary(stream);
      }
      this.index = 0;
   }
   StreamReader.prototype = {
      /**
       * Check that the offset will not go too far.
       * @param {string} offset the additional offset to check.
       * @throws {Error} an Error if the offset is out of bounds.
       */
      checkOffset : function (offset) {
         this.checkIndex(this.index + offset);
      },
      /**
       * Check that the specifed index will not be too far.
       * @param {string} newIndex the index to check.
       * @throws {Error} an Error if the index is out of bounds.
       */
      checkIndex : function (newIndex) {
         if (this.stream.length < newIndex || newIndex < 0) {
            throw new Error("End of stream reached (stream length = " +
                            this.stream.length + ", asked index = " +
                            (newIndex) + "). Corrupted zip ?");
         }
      },
      /**
       * Change the index.
       * @param {number} newIndex The new index.
       * @throws {Error} if the new index is out of the stream.
       */
      setIndex : function (newIndex) {
         this.checkIndex(newIndex);
         this.index = newIndex;
      },
      /**
       * Skip the next n bytes.
       * @param {number} n the number of bytes to skip.
       * @throws {Error} if the new index is out of the stream.
       */
      skip : function (n) {
         this.setIndex(this.index + n);
      },
      /**
       * Get the byte at the specified index.
       * @param {number} i the index to use.
       * @return {number} a byte.
       */
      byteAt : function(i) {
         return this.stream.charCodeAt(i);
      },
      /**
       * Get the next number with a given byte size.
       * @param {number} size the number of bytes to read.
       * @return {number} the corresponding number.
       */
      readInt : function (size) {
         var result = 0, i;
         this.checkOffset(size);
         for(i = this.index + size - 1; i >= this.index; i--) {
            result = (result << 8) + this.byteAt(i);
         }
         this.index += size;
         return result;
      },
      /**
       * Get the next string with a given byte size.
       * @param {number} size the number of bytes to read.
       * @return {string} the corresponding string.
       */
      readString : function (size) {
         this.checkOffset(size);
         // this will work because the constructor applied the "& 0xff" mask.
         var result = this.stream.slice(this.index, this.index + size);
         this.index += size;
         return result;
      },
      /**
       * Get the next date.
       * @return {Date} the date.
       */
      readDate : function () {
         var dostime = this.readInt(4);
         return new Date(
            ((dostime >> 25) & 0x7f) + 1980, // year
            ((dostime >> 21) & 0x0f) - 1, // month
            (dostime >> 16) & 0x1f, // day
            (dostime >> 11) & 0x1f, // hour
            (dostime >> 5) & 0x3f, // minute
            (dostime & 0x1f) << 1); // second
      }
   };
   // }}} end of StreamReader

   // class ZipEntry {{{
   /**
    * An entry in the zip file.
    * @constructor
    * @param {Object} options Options of the current file.
    * @param {Object} loadOptions Options for loading the stream.
    */
   function ZipEntry(options, loadOptions) {
      this.options = options;
      this.loadOptions = loadOptions;
   }
   ZipEntry.prototype = {
      /**
       * say if the file is encrypted.
       * @return {boolean} true if the file is encrypted, false otherwise.
       */
      isEncrypted : function () {
         // bit 1 is set
         return (this.bitFlag & 0x0001) === 0x0001;
      },
      /**
       * say if the file has utf-8 filename/comment.
       * @return {boolean} true if the filename/comment is in utf-8, false otherwise.
       */
      useUTF8 : function () {
         // bit 11 is set
         return (this.bitFlag & 0x0800) === 0x0800;
      },
      /**
       * Read the local part of a zip file and add the info in this object.
       * @param {StreamReader} reader the reader to use.
       */
      readLocalPart : function(reader) {
         var compression, localExtraFieldsLength;

         // we already know everything from the central dir !
         // If the central dir data are false, we are doomed.
         // On the bright side, the local part is scary  : zip64, data descriptors, both, etc.
         // The less data we get here, the more reliable this should be.
         // Let's skip the whole header and dash to the data !
         reader.skip(22);
         // in some zip created on windows, the filename stored in the central dir contains \ instead of /.
         // Strangely, the filename here is OK.
         // I would love to treat these zip files as corrupted (see http://www.info-zip.org/FAQ.html#backslashes
         // or APPNOTE#4.4.17.1, "All slashes MUST be forward slashes '/'") but there are a lot of bad zip generators...
         // Search "unzip mismatching "local" filename continuing with "central" filename version" on
         // the internet.
         //
         // I think I see the logic here : the central directory is used to display
         // content and the local directory is used to extract the files. Mixing / and \
         // may be used to display \ to windows users and use / when extracting the files.
         // Unfortunately, this lead also to some issues : http://seclists.org/fulldisclosure/2009/Sep/394
         this.fileNameLength = reader.readInt(2);
         localExtraFieldsLength = reader.readInt(2); // can't be sure this will be the same as the central dir
         this.fileName = reader.readString(this.fileNameLength);
         reader.skip(localExtraFieldsLength);

         if (this.compressedSize == -1 || this.uncompressedSize == -1) {
            throw new Error("Bug or corrupted zip : didn't get enough informations from the central directory " +
                            "(compressedSize == -1 || uncompressedSize == -1)");
         }
         this.compressedFileData = reader.readString(this.compressedSize);

         compression = findCompression(this.compressionMethod);
         if (compression === null) { // no compression found
            throw new Error("Corrupted zip : compression " + pretty(this.compressionMethod) +
                            " unknown (inner file : " + this.fileName + ")");
         }
         this.uncompressedFileData = compression.uncompress(this.compressedFileData);

         if (this.uncompressedFileData.length !== this.uncompressedSize) {
            throw new Error("Bug : uncompressed data size mismatch");
         }

         if (this.loadOptions.checkCRC32 && JSZip.prototype.crc32(this.uncompressedFileData) !== this.crc32) {
            throw new Error("Corrupted zip : CRC32 mismatch");
         }
      },

      /**
       * Read the central part of a zip file and add the info in this object.
       * @param {StreamReader} reader the reader to use.
       */
      readCentralPart : function(reader) {
         this.versionMadeBy          = reader.readString(2);
         this.versionNeeded          = reader.readInt(2);
         this.bitFlag                = reader.readInt(2);
         this.compressionMethod      = reader.readString(2);
         this.date                   = reader.readDate();
         this.crc32                  = reader.readInt(4);
         this.compressedSize         = reader.readInt(4);
         this.uncompressedSize       = reader.readInt(4);
         this.fileNameLength         = reader.readInt(2);
         this.extraFieldsLength      = reader.readInt(2);
         this.fileCommentLength      = reader.readInt(2);
         this.diskNumberStart        = reader.readInt(2);
         this.internalFileAttributes = reader.readInt(2);
         this.externalFileAttributes = reader.readInt(4);
         this.localHeaderOffset      = reader.readInt(4);

         if (this.isEncrypted()) {
            throw new Error("Encrypted zip are not supported");
         }

         this.fileName = reader.readString(this.fileNameLength);
         this.readExtraFields(reader);
         this.parseZIP64ExtraField(reader);
         this.fileComment = reader.readString(this.fileCommentLength);

         // warning, this is true only for zip with madeBy == DOS (plateform dependent feature)
         this.dir = this.externalFileAttributes & 0x00000010 ? true : false;
      },
      /**
       * Parse the ZIP64 extra field and merge the info in the current ZipEntry.
       * @param {StreamReader} reader the reader to use.
       */
      parseZIP64ExtraField : function(reader) {

         if(!this.extraFields[0x0001]) {
            return;
         }

         // should be something, preparing the extra reader
         var extraReader = new StreamReader(this.extraFields[0x0001].value);

         // I really hope that these 64bits integer can fit in 32 bits integer, because js
         // won't let us have more.
         if(this.uncompressedSize === MAX_VALUE_32BITS) {
            this.uncompressedSize = extraReader.readInt(8);
         }
         if(this.compressedSize === MAX_VALUE_32BITS) {
            this.compressedSize = extraReader.readInt(8);
         }
         if(this.localHeaderOffset === MAX_VALUE_32BITS) {
            this.localHeaderOffset = extraReader.readInt(8);
         }
         if(this.diskNumberStart === MAX_VALUE_32BITS) {
            this.diskNumberStart = extraReader.readInt(4);
         }
      },
      /**
       * Read the central part of a zip file and add the info in this object.
       * @param {StreamReader} reader the reader to use.
       */
      readExtraFields : function(reader) {
         var start = reader.index,
             extraFieldId,
             extraFieldLength,
             extraFieldValue;

         this.extraFields = this.extraFields || {};

         while (reader.index < start + this.extraFieldsLength) {
            extraFieldId     = reader.readInt(2);
            extraFieldLength = reader.readInt(2);
            extraFieldValue  = reader.readString(extraFieldLength);

            this.extraFields[extraFieldId] = {
               id:     extraFieldId,
               length: extraFieldLength,
               value:  extraFieldValue
            };
         }
      },
      /**
       * Apply an UTF8 transformation if needed.
       */
      handleUTF8 : function() {
         if (this.useUTF8()) {
            this.fileName    = JSZip.prototype.utf8decode(this.fileName);
            this.fileComment = JSZip.prototype.utf8decode(this.fileComment);
         }
      }
   };
   // }}} end of ZipEntry

   //  class ZipEntries {{{
   /**
    * All the entries in the zip file.
    * @constructor
    * @param {String|ArrayBuffer|Uint8Array} data the binary stream to load.
    * @param {Object} loadOptions Options for loading the stream.
    */
   function ZipEntries(data, loadOptions) {
      this.files = [];
      this.loadOptions = loadOptions;
      if (data) {
         this.load(data);
      }
   }
   ZipEntries.prototype = {
      /**
       * Check that the reader is on the speficied signature.
       * @param {string} expectedSignature the expected signature.
       * @throws {Error} if it is an other signature.
       */
      checkSignature : function(expectedSignature) {
         var signature = this.reader.readString(4);
         if (signature !== expectedSignature) {
            throw new Error("Corrupted zip or bug : unexpected signature " +
                            "(" + pretty(signature) + ", expected " + pretty(expectedSignature) + ")");
         }
      },
      /**
       * Read the end of the central directory.
       */
      readBlockEndOfCentral : function () {
         this.diskNumber                  = this.reader.readInt(2);
         this.diskWithCentralDirStart     = this.reader.readInt(2);
         this.centralDirRecordsOnThisDisk = this.reader.readInt(2);
         this.centralDirRecords           = this.reader.readInt(2);
         this.centralDirSize              = this.reader.readInt(4);
         this.centralDirOffset            = this.reader.readInt(4);

         this.zipCommentLength            = this.reader.readInt(2);
         this.zipComment                  = this.reader.readString(this.zipCommentLength);
      },
      /**
       * Read the end of the Zip 64 central directory.
       * Not merged with the method readEndOfCentral :
       * The end of central can coexist with its Zip64 brother,
       * I don't want to read the wrong number of bytes !
       */
      readBlockZip64EndOfCentral : function () {
         this.zip64EndOfCentralSize       = this.reader.readInt(8);
         this.versionMadeBy               = this.reader.readString(2);
         this.versionNeeded               = this.reader.readInt(2);
         this.diskNumber                  = this.reader.readInt(4);
         this.diskWithCentralDirStart     = this.reader.readInt(4);
         this.centralDirRecordsOnThisDisk = this.reader.readInt(8);
         this.centralDirRecords           = this.reader.readInt(8);
         this.centralDirSize              = this.reader.readInt(8);
         this.centralDirOffset            = this.reader.readInt(8);

         this.zip64ExtensibleData = {};
         var extraDataSize = this.zip64EndOfCentralSize - 44,
         index = 0,
         extraFieldId,
         extraFieldLength,
         extraFieldValue;
         while(index < extraDataSize) {
            extraFieldId     = this.reader.readInt(2);
            extraFieldLength = this.reader.readInt(4);
            extraFieldValue  = this.reader.readString(extraFieldLength);
            this.zip64ExtensibleData[extraFieldId] = {
               id:     extraFieldId,
               length: extraFieldLength,
               value:  extraFieldValue
            };
         }
      },
      /**
       * Read the end of the Zip 64 central directory locator.
       */
      readBlockZip64EndOfCentralLocator : function () {
         this.diskWithZip64CentralDirStart       = this.reader.readInt(4);
         this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8);
         this.disksCount                         = this.reader.readInt(4);
         if (this.disksCount > 1) {
            throw new Error("Multi-volumes zip are not supported");
         }
      },
      /**
       * Read the local files, based on the offset read in the central part.
       */
      readLocalFiles : function() {
         var i, file;
         for(i = 0; i < this.files.length; i++) {
            file = this.files[i];
            this.reader.setIndex(file.localHeaderOffset);
            this.checkSignature(JSZip.signature.LOCAL_FILE_HEADER);
            file.readLocalPart(this.reader);
            file.handleUTF8();
         }
      },
      /**
       * Read the central directory.
       */
      readCentralDir : function() {
         var file;

         this.reader.setIndex(this.centralDirOffset);
         while(this.reader.readString(4) === JSZip.signature.CENTRAL_FILE_HEADER) {
            file = new ZipEntry({
               zip64: this.zip64
            }, this.loadOptions);
            file.readCentralPart(this.reader);
            this.files.push(file);
         }
      },
      /**
       * Read the end of central directory.
       */
      readEndOfCentral : function() {
            var offset = this.reader.stream.lastIndexOf(JSZip.signature.CENTRAL_DIRECTORY_END);
            if (offset === -1) {
               throw new Error("Corrupted zip : can't find end of central directory");
            }
            this.reader.setIndex(offset);
            this.checkSignature(JSZip.signature.CENTRAL_DIRECTORY_END);
            this.readBlockEndOfCentral();

         
            /* extract from the zip spec :
               4)  If one of the fields in the end of central directory
                   record is too small to hold required data, the field
                   should be set to -1 (0xFFFF or 0xFFFFFFFF) and the
                   ZIP64 format record should be created.
               5)  The end of central directory record and the
                   Zip64 end of central directory locator record must
                   reside on the same disk when splitting or spanning
                   an archive.
            */
            if (  this.diskNumber                  === MAX_VALUE_16BITS
               || this.diskWithCentralDirStart     === MAX_VALUE_16BITS
               || this.centralDirRecordsOnThisDisk === MAX_VALUE_16BITS
               || this.centralDirRecords           === MAX_VALUE_16BITS
               || this.centralDirSize              === MAX_VALUE_32BITS
               || this.centralDirOffset            === MAX_VALUE_32BITS
            ) {
               this.zip64 = true;

               /*
               Warning : the zip64 extension is supported, but ONLY if the 64bits integer read from
               the zip file can fit into a 32bits integer. This cannot be solved : Javascript represents
               all numbers as 64-bit double precision IEEE 754 floating point numbers.
               So, we have 53bits for integers and bitwise operations treat everything as 32bits.
               see https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Operators/Bitwise_Operators
               and http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-262.pdf section 8.5
               */

               // should look for a zip64 EOCD locator
               offset = this.reader.stream.lastIndexOf(JSZip.signature.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
               if (offset === -1) {
                  throw new Error("Corrupted zip : can't find the ZIP64 end of central directory locator");
               }
               this.reader.setIndex(offset);
               this.checkSignature(JSZip.signature.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
               this.readBlockZip64EndOfCentralLocator();

               // now the zip64 EOCD record
               this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir);
               this.checkSignature(JSZip.signature.ZIP64_CENTRAL_DIRECTORY_END);
               this.readBlockZip64EndOfCentral();
            }
      },
      /**
       * Read a zip file and create ZipEntries.
       * @param {String|ArrayBuffer|Uint8Array} data the binary string representing a zip file.
       */
      load : function(data) {
         this.reader = new StreamReader(data);

         this.readEndOfCentral();
         this.readCentralDir();
         this.readLocalFiles();
      }
   };
   // }}} end of ZipEntries

   /**
    * Implementation of the load method of JSZip.
    * It uses the above classes to decode a zip file, and load every files.
    * @param {String|ArrayBuffer|Uint8Array} data the data to load.
    * @param {Object} options Options for loading the stream.
    *  options.base64 : is the stream in base64 ? default : false
    */
   JSZip.prototype.load = function(data, options) {
      var files, zipEntries, i, input;
      options = options || {};
      if(options.base64) {
         data = JSZipBase64.decode(data);
      }

      zipEntries = new ZipEntries(data, options);
      files = zipEntries.files;
      for (i = 0; i < files.length; i++) {
         input = files[i];
         this.file(input.fileName, input.uncompressedFileData, {
            binary:true,
            optimizedBinaryString:true,
            date:input.date,
            dir:input.dir
         });
      }

      return this;
   };

}());

/*
 * Port of a script by Masanao Izumo.
 *
 * Only changes : wrap all the variables in a function and add the 
 * main function to JSZip (DEFLATE compression method).
 * Everything else was written by M. Izumo.
 *
 * Original code can be found here: http://www.onicos.com/staff/iz/amuse/javascript/expert/inflate.txt
 */

if(!JSZip) {
   throw "JSZip not defined";
}

/*
 * Original:
 *   http://www.onicos.com/staff/iz/amuse/javascript/expert/inflate.txt
 */

(function(){
  // the original implementation leaks a global variable.
  // Defining the variable here doesn't break anything.
  var zip_fixed_bd;

/* Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
 * Version: 1.0.0.1
 * LastModified: Dec 25 1999
 */

/* Interface:
 * data = zip_inflate(src);
 */

/* constant parameters */
var zip_WSIZE = 32768;        // Sliding Window size
var zip_STORED_BLOCK = 0;
var zip_STATIC_TREES = 1;
var zip_DYN_TREES    = 2;

/* for inflate */
var zip_lbits = 9; 		// bits in base literal/length lookup table
var zip_dbits = 6; 		// bits in base distance lookup table
var zip_INBUFSIZ = 32768;	// Input buffer size
var zip_INBUF_EXTRA = 64;	// Extra buffer

/* variables (inflate) */
var zip_slide;
var zip_wp;			// current position in slide
var zip_fixed_tl = null;	// inflate static
var zip_fixed_td;		// inflate static
var zip_fixed_bl, fixed_bd;	// inflate static
var zip_bit_buf;		// bit buffer
var zip_bit_len;		// bits in bit buffer
var zip_method;
var zip_eof;
var zip_copy_leng;
var zip_copy_dist;
var zip_tl, zip_td;	// literal/length and distance decoder tables
var zip_bl, zip_bd;	// number of bits decoded by tl and td

var zip_inflate_data;
var zip_inflate_pos;


/* constant tables (inflate) */
var zip_MASK_BITS = new Array(
    0x0000,
    0x0001, 0x0003, 0x0007, 0x000f, 0x001f, 0x003f, 0x007f, 0x00ff,
    0x01ff, 0x03ff, 0x07ff, 0x0fff, 0x1fff, 0x3fff, 0x7fff, 0xffff);
// Tables for deflate from PKZIP's appnote.txt.
var zip_cplens = new Array( // Copy lengths for literal codes 257..285
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
    35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0);
/* note: see note #13 above about the 258 in this list. */
var zip_cplext = new Array( // Extra bits for literal codes 257..285
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
    3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 99, 99); // 99==invalid
var zip_cpdist = new Array( // Copy offsets for distance codes 0..29
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
    257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
    8193, 12289, 16385, 24577);
var zip_cpdext = new Array( // Extra bits for distance codes
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    7, 7, 8, 8, 9, 9, 10, 10, 11, 11,
    12, 12, 13, 13);
var zip_border = new Array(  // Order of the bit length code lengths
    16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15);
/* objects (inflate) */

function zip_HuftList() {
    this.next = null;
    this.list = null;
}

function zip_HuftNode() {
    this.e = 0; // number of extra bits or operation
    this.b = 0; // number of bits in this code or subcode

    // union
    this.n = 0; // literal, length base, or distance base
    this.t = null; // (zip_HuftNode) pointer to next level of table
}

function zip_HuftBuild(b,	// code lengths in bits (all assumed <= BMAX)
		       n,	// number of codes (assumed <= N_MAX)
		       s,	// number of simple-valued codes (0..s-1)
		       d,	// list of base values for non-simple codes
		       e,	// list of extra bits for non-simple codes
		       mm	// maximum lookup bits
		   ) {
    this.BMAX = 16;   // maximum bit length of any code
    this.N_MAX = 288; // maximum number of codes in any set
    this.status = 0;	// 0: success, 1: incomplete table, 2: bad input
    this.root = null;	// (zip_HuftList) starting table
    this.m = 0;		// maximum lookup bits, returns actual

/* Given a list of code lengths and a maximum table size, make a set of
   tables to decode that set of codes.	Return zero on success, one if
   the given code set is incomplete (the tables are still built in this
   case), two if the input is invalid (all zero length codes or an
   oversubscribed set of lengths), and three if not enough memory.
   The code with value 256 is special, and the tables are constructed
   so that no bits beyond that code are fetched when that code is
   decoded. */
    {
	var a;			// counter for codes of length k
	var c = new Array(this.BMAX+1);	// bit length count table
	var el;			// length of EOB code (value 256)
	var f;			// i repeats in table every f entries
	var g;			// maximum code length
	var h;			// table level
	var i;			// counter, current code
	var j;			// counter
	var k;			// number of bits in current code
	var lx = new Array(this.BMAX+1);	// stack of bits per table
	var p;			// pointer into c[], b[], or v[]
	var pidx;		// index of p
	var q;			// (zip_HuftNode) points to current table
	var r = new zip_HuftNode(); // table entry for structure assignment
	var u = new Array(this.BMAX); // zip_HuftNode[BMAX][]  table stack
	var v = new Array(this.N_MAX); // values in order of bit length
	var w;
	var x = new Array(this.BMAX+1);// bit offsets, then code stack
	var xp;			// pointer into x or c
	var y;			// number of dummy codes added
	var z;			// number of entries in current table
	var o;
	var tail;		// (zip_HuftList)

	tail = this.root = null;
	for(i = 0; i < c.length; i++)
	    c[i] = 0;
	for(i = 0; i < lx.length; i++)
	    lx[i] = 0;
	for(i = 0; i < u.length; i++)
	    u[i] = null;
	for(i = 0; i < v.length; i++)
	    v[i] = 0;
	for(i = 0; i < x.length; i++)
	    x[i] = 0;

	// Generate counts for each bit length
	el = n > 256 ? b[256] : this.BMAX; // set length of EOB code, if any
	p = b; pidx = 0;
	i = n;
	do {
	    c[p[pidx]]++;	// assume all entries <= BMAX
	    pidx++;
	} while(--i > 0);
	if(c[0] == n) {	// null input--all zero length codes
	    this.root = null;
	    this.m = 0;
	    this.status = 0;
	    return;
	}

	// Find minimum and maximum length, bound *m by those
	for(j = 1; j <= this.BMAX; j++)
	    if(c[j] != 0)
		break;
	k = j;			// minimum code length
	if(mm < j)
	    mm = j;
	for(i = this.BMAX; i != 0; i--)
	    if(c[i] != 0)
		break;
	g = i;			// maximum code length
	if(mm > i)
	    mm = i;

	// Adjust last length count to fill out codes, if needed
	for(y = 1 << j; j < i; j++, y <<= 1)
	    if((y -= c[j]) < 0) {
		this.status = 2;	// bad input: more codes than bits
		this.m = mm;
		return;
	    }
	if((y -= c[i]) < 0) {
	    this.status = 2;
	    this.m = mm;
	    return;
	}
	c[i] += y;

	// Generate starting offsets into the value table for each length
	x[1] = j = 0;
	p = c;
	pidx = 1;
	xp = 2;
	while(--i > 0)		// note that i == g from above
	    x[xp++] = (j += p[pidx++]);

	// Make a table of values in order of bit lengths
	p = b; pidx = 0;
	i = 0;
	do {
	    if((j = p[pidx++]) != 0)
		v[x[j]++] = i;
	} while(++i < n);
	n = x[g];			// set n to length of v

	// Generate the Huffman codes and for each, make the table entries
	x[0] = i = 0;		// first Huffman code is zero
	p = v; pidx = 0;		// grab values in bit order
	h = -1;			// no tables yet--level -1
	w = lx[0] = 0;		// no bits decoded yet
	q = null;			// ditto
	z = 0;			// ditto

	// go through the bit lengths (k already is bits in shortest code)
	for(; k <= g; k++) {
	    a = c[k];
	    while(a-- > 0) {
		// here i is the Huffman code of length k bits for value p[pidx]
		// make tables up to required level
		while(k > w + lx[1 + h]) {
		    w += lx[1 + h]; // add bits already decoded
		    h++;

		    // compute minimum size table less than or equal to *m bits
		    z = (z = g - w) > mm ? mm : z; // upper limit
		    if((f = 1 << (j = k - w)) > a + 1) { // try a k-w bit table
			// too few codes for k-w bit table
			f -= a + 1;	// deduct codes from patterns left
			xp = k;
			while(++j < z) { // try smaller tables up to z bits
			    if((f <<= 1) <= c[++xp])
				break;	// enough codes to use up j bits
			    f -= c[xp];	// else deduct codes from patterns
			}
		    }
		    if(w + j > el && w < el)
			j = el - w;	// make EOB code end at table
		    z = 1 << j;	// table entries for j-bit table
		    lx[1 + h] = j; // set table size in stack

		    // allocate and link in new table
		    q = new Array(z);
		    for(o = 0; o < z; o++) {
			q[o] = new zip_HuftNode();
		    }

		    if(tail == null)
			tail = this.root = new zip_HuftList();
		    else
			tail = tail.next = new zip_HuftList();
		    tail.next = null;
		    tail.list = q;
		    u[h] = q;	// table starts after link

		    /* connect to last table, if there is one */
		    if(h > 0) {
			x[h] = i;		// save pattern for backing up
			r.b = lx[h];	// bits to dump before this table
			r.e = 16 + j;	// bits in this table
			r.t = q;		// pointer to this table
			j = (i & ((1 << w) - 1)) >> (w - lx[h]);
			u[h-1][j].e = r.e;
			u[h-1][j].b = r.b;
			u[h-1][j].n = r.n;
			u[h-1][j].t = r.t;
		    }
		}

		// set up table entry in r
		r.b = k - w;
		if(pidx >= n)
		    r.e = 99;		// out of values--invalid code
		else if(p[pidx] < s) {
		    r.e = (p[pidx] < 256 ? 16 : 15); // 256 is end-of-block code
		    r.n = p[pidx++];	// simple code is just the value
		} else {
		    r.e = e[p[pidx] - s];	// non-simple--look up in lists
		    r.n = d[p[pidx++] - s];
		}

		// fill code-like entries with r //
		f = 1 << (k - w);
		for(j = i >> w; j < z; j += f) {
		    q[j].e = r.e;
		    q[j].b = r.b;
		    q[j].n = r.n;
		    q[j].t = r.t;
		}

		// backwards increment the k-bit code i
		for(j = 1 << (k - 1); (i & j) != 0; j >>= 1)
		    i ^= j;
		i ^= j;

		// backup over finished tables
		while((i & ((1 << w) - 1)) != x[h]) {
		    w -= lx[h];		// don't need to update q
		    h--;
		}
	    }
	}

	/* return actual size of base table */
	this.m = lx[1];

	/* Return true (1) if we were given an incomplete table */
	this.status = ((y != 0 && g != 1) ? 1 : 0);
    } /* end of constructor */
}


/* routines (inflate) */

function zip_GET_BYTE() {
    if(zip_inflate_data.length == zip_inflate_pos)
	return -1;
    return zip_inflate_data.charCodeAt(zip_inflate_pos++) & 0xff;
}

function zip_NEEDBITS(n) {
    while(zip_bit_len < n) {
	zip_bit_buf |= zip_GET_BYTE() << zip_bit_len;
	zip_bit_len += 8;
    }
}

function zip_GETBITS(n) {
    return zip_bit_buf & zip_MASK_BITS[n];
}

function zip_DUMPBITS(n) {
    zip_bit_buf >>= n;
    zip_bit_len -= n;
}

function zip_inflate_codes(buff, off, size) {
    /* inflate (decompress) the codes in a deflated (compressed) block.
       Return an error code or zero if it all goes ok. */
    var e;		// table entry flag/number of extra bits
    var t;		// (zip_HuftNode) pointer to table entry
    var n;

    if(size == 0)
      return 0;

    // inflate the coded data
    n = 0;
    for(;;) {			// do until end of block
	zip_NEEDBITS(zip_bl);
	t = zip_tl.list[zip_GETBITS(zip_bl)];
	e = t.e;
	while(e > 16) {
	    if(e == 99)
		return -1;
	    zip_DUMPBITS(t.b);
	    e -= 16;
	    zip_NEEDBITS(e);
	    t = t.t[zip_GETBITS(e)];
	    e = t.e;
	}
	zip_DUMPBITS(t.b);

	if(e == 16) {		// then it's a literal
	    zip_wp &= zip_WSIZE - 1;
	    buff[off + n++] = zip_slide[zip_wp++] = t.n;
	    if(n == size)
		return size;
	    continue;
	}

	// exit if end of block
	if(e == 15)
	    break;

	// it's an EOB or a length

	// get length of block to copy
	zip_NEEDBITS(e);
	zip_copy_leng = t.n + zip_GETBITS(e);
	zip_DUMPBITS(e);

	// decode distance of block to copy
	zip_NEEDBITS(zip_bd);
	t = zip_td.list[zip_GETBITS(zip_bd)];
	e = t.e;

	while(e > 16) {
	    if(e == 99)
		return -1;
	    zip_DUMPBITS(t.b);
	    e -= 16;
	    zip_NEEDBITS(e);
	    t = t.t[zip_GETBITS(e)];
	    e = t.e;
	}
	zip_DUMPBITS(t.b);
	zip_NEEDBITS(e);
	zip_copy_dist = zip_wp - t.n - zip_GETBITS(e);
	zip_DUMPBITS(e);

	// do the copy
	while(zip_copy_leng > 0 && n < size) {
	    zip_copy_leng--;
	    zip_copy_dist &= zip_WSIZE - 1;
	    zip_wp &= zip_WSIZE - 1;
	    buff[off + n++] = zip_slide[zip_wp++]
		= zip_slide[zip_copy_dist++];
	}

	if(n == size)
	    return size;
    }

    zip_method = -1; // done
    return n;
}

function zip_inflate_stored(buff, off, size) {
    /* "decompress" an inflated type 0 (stored) block. */
    var n;

    // go to byte boundary
    n = zip_bit_len & 7;
    zip_DUMPBITS(n);

    // get the length and its complement
    zip_NEEDBITS(16);
    n = zip_GETBITS(16);
    zip_DUMPBITS(16);
    zip_NEEDBITS(16);
    if(n != ((~zip_bit_buf) & 0xffff))
	return -1;			// error in compressed data
    zip_DUMPBITS(16);

    // read and output the compressed data
    zip_copy_leng = n;

    n = 0;
    while(zip_copy_leng > 0 && n < size) {
	zip_copy_leng--;
	zip_wp &= zip_WSIZE - 1;
	zip_NEEDBITS(8);
	buff[off + n++] = zip_slide[zip_wp++] =
	    zip_GETBITS(8);
	zip_DUMPBITS(8);
    }

    if(zip_copy_leng == 0)
      zip_method = -1; // done
    return n;
}

function zip_inflate_fixed(buff, off, size) {
    /* decompress an inflated type 1 (fixed Huffman codes) block.  We should
       either replace this with a custom decoder, or at least precompute the
       Huffman tables. */

    // if first time, set up tables for fixed blocks
    if(zip_fixed_tl == null) {
	var i;			// temporary variable
	var l = new Array(288);	// length list for huft_build
	var h;	// zip_HuftBuild

	// literal table
	for(i = 0; i < 144; i++)
	    l[i] = 8;
	for(; i < 256; i++)
	    l[i] = 9;
	for(; i < 280; i++)
	    l[i] = 7;
	for(; i < 288; i++)	// make a complete, but wrong code set
	    l[i] = 8;
	zip_fixed_bl = 7;

	h = new zip_HuftBuild(l, 288, 257, zip_cplens, zip_cplext,
			      zip_fixed_bl);
	if(h.status != 0) {
	    alert("HufBuild error: "+h.status);
	    return -1;
	}
	zip_fixed_tl = h.root;
	zip_fixed_bl = h.m;

	// distance table
	for(i = 0; i < 30; i++)	// make an incomplete code set
	    l[i] = 5;
	zip_fixed_bd = 5;

	h = new zip_HuftBuild(l, 30, 0, zip_cpdist, zip_cpdext, zip_fixed_bd);
	if(h.status > 1) {
	    zip_fixed_tl = null;
	    alert("HufBuild error: "+h.status);
	    return -1;
	}
	zip_fixed_td = h.root;
	zip_fixed_bd = h.m;
    }

    zip_tl = zip_fixed_tl;
    zip_td = zip_fixed_td;
    zip_bl = zip_fixed_bl;
    zip_bd = zip_fixed_bd;
    return zip_inflate_codes(buff, off, size);
}

function zip_inflate_dynamic(buff, off, size) {
    // decompress an inflated type 2 (dynamic Huffman codes) block.
    var i;		// temporary variables
    var j;
    var l;		// last length
    var n;		// number of lengths to get
    var t;		// (zip_HuftNode) literal/length code table
    var nb;		// number of bit length codes
    var nl;		// number of literal/length codes
    var nd;		// number of distance codes
    var ll = new Array(286+30); // literal/length and distance code lengths
    var h;		// (zip_HuftBuild)

    for(i = 0; i < ll.length; i++)
	ll[i] = 0;

    // read in table lengths
    zip_NEEDBITS(5);
    nl = 257 + zip_GETBITS(5);	// number of literal/length codes
    zip_DUMPBITS(5);
    zip_NEEDBITS(5);
    nd = 1 + zip_GETBITS(5);	// number of distance codes
    zip_DUMPBITS(5);
    zip_NEEDBITS(4);
    nb = 4 + zip_GETBITS(4);	// number of bit length codes
    zip_DUMPBITS(4);
    if(nl > 286 || nd > 30)
      return -1;		// bad lengths

    // read in bit-length-code lengths
    for(j = 0; j < nb; j++)
    {
	zip_NEEDBITS(3);
	ll[zip_border[j]] = zip_GETBITS(3);
	zip_DUMPBITS(3);
    }
    for(; j < 19; j++)
	ll[zip_border[j]] = 0;

    // build decoding table for trees--single level, 7 bit lookup
    zip_bl = 7;
    h = new zip_HuftBuild(ll, 19, 19, null, null, zip_bl);
    if(h.status != 0)
	return -1;	// incomplete code set

    zip_tl = h.root;
    zip_bl = h.m;

    // read in literal and distance code lengths
    n = nl + nd;
    i = l = 0;
    while(i < n) {
	zip_NEEDBITS(zip_bl);
	t = zip_tl.list[zip_GETBITS(zip_bl)];
	j = t.b;
	zip_DUMPBITS(j);
	j = t.n;
	if(j < 16)		// length of code in bits (0..15)
	    ll[i++] = l = j;	// save last length in l
	else if(j == 16) {	// repeat last length 3 to 6 times
	    zip_NEEDBITS(2);
	    j = 3 + zip_GETBITS(2);
	    zip_DUMPBITS(2);
	    if(i + j > n)
		return -1;
	    while(j-- > 0)
		ll[i++] = l;
	} else if(j == 17) {	// 3 to 10 zero length codes
	    zip_NEEDBITS(3);
	    j = 3 + zip_GETBITS(3);
	    zip_DUMPBITS(3);
	    if(i + j > n)
		return -1;
	    while(j-- > 0)
		ll[i++] = 0;
	    l = 0;
	} else {		// j == 18: 11 to 138 zero length codes
	    zip_NEEDBITS(7);
	    j = 11 + zip_GETBITS(7);
	    zip_DUMPBITS(7);
	    if(i + j > n)
		return -1;
	    while(j-- > 0)
		ll[i++] = 0;
	    l = 0;
	}
    }

    // build the decoding tables for literal/length and distance codes
    zip_bl = zip_lbits;
    h = new zip_HuftBuild(ll, nl, 257, zip_cplens, zip_cplext, zip_bl);
    if(zip_bl == 0)	// no literals or lengths
	h.status = 1;
    if(h.status != 0) {
	if(h.status == 1)
	    ;// **incomplete literal tree**
	return -1;		// incomplete code set
    }
    zip_tl = h.root;
    zip_bl = h.m;

    for(i = 0; i < nd; i++)
	ll[i] = ll[i + nl];
    zip_bd = zip_dbits;
    h = new zip_HuftBuild(ll, nd, 0, zip_cpdist, zip_cpdext, zip_bd);
    zip_td = h.root;
    zip_bd = h.m;

    if(zip_bd == 0 && nl > 257) {   // lengths but no distances
	// **incomplete distance tree**
	return -1;
    }

    if(h.status == 1) {
	;// **incomplete distance tree**
    }
    if(h.status != 0)
	return -1;

    // decompress until an end-of-block code
    return zip_inflate_codes(buff, off, size);
}

function zip_inflate_start() {
    var i;

    if(zip_slide == null)
	zip_slide = new Array(2 * zip_WSIZE);
    zip_wp = 0;
    zip_bit_buf = 0;
    zip_bit_len = 0;
    zip_method = -1;
    zip_eof = false;
    zip_copy_leng = zip_copy_dist = 0;
    zip_tl = null;
}

function zip_inflate_internal(buff, off, size) {
    // decompress an inflated entry
    var n, i;

    n = 0;
    while(n < size) {
	if(zip_eof && zip_method == -1)
	    return n;

	if(zip_copy_leng > 0) {
	    if(zip_method != zip_STORED_BLOCK) {
		// STATIC_TREES or DYN_TREES
		while(zip_copy_leng > 0 && n < size) {
		    zip_copy_leng--;
		    zip_copy_dist &= zip_WSIZE - 1;
		    zip_wp &= zip_WSIZE - 1;
		    buff[off + n++] = zip_slide[zip_wp++] =
			zip_slide[zip_copy_dist++];
		}
	    } else {
		while(zip_copy_leng > 0 && n < size) {
		    zip_copy_leng--;
		    zip_wp &= zip_WSIZE - 1;
		    zip_NEEDBITS(8);
		    buff[off + n++] = zip_slide[zip_wp++] = zip_GETBITS(8);
		    zip_DUMPBITS(8);
		}
		if(zip_copy_leng == 0)
		    zip_method = -1; // done
	    }
	    if(n == size)
		return n;
	}

	if(zip_method == -1) {
	    if(zip_eof)
		break;

	    // read in last block bit
	    zip_NEEDBITS(1);
	    if(zip_GETBITS(1) != 0)
		zip_eof = true;
	    zip_DUMPBITS(1);

	    // read in block type
	    zip_NEEDBITS(2);
	    zip_method = zip_GETBITS(2);
	    zip_DUMPBITS(2);
	    zip_tl = null;
	    zip_copy_leng = 0;
	}

	switch(zip_method) {
	  case 0: // zip_STORED_BLOCK
	    i = zip_inflate_stored(buff, off + n, size - n);
	    break;

	  case 1: // zip_STATIC_TREES
	    if(zip_tl != null)
		i = zip_inflate_codes(buff, off + n, size - n);
	    else
		i = zip_inflate_fixed(buff, off + n, size - n);
	    break;

	  case 2: // zip_DYN_TREES
	    if(zip_tl != null)
		i = zip_inflate_codes(buff, off + n, size - n);
	    else
		i = zip_inflate_dynamic(buff, off + n, size - n);
	    break;

	  default: // error
	    i = -1;
	    break;
	}

	if(i == -1) {
	    if(zip_eof)
		return 0;
	    return -1;
	}
	n += i;
    }
    return n;
}

function zip_inflate(str) {
    var out, buff;
    var i, j;

    zip_inflate_start();
    zip_inflate_data = str;
    zip_inflate_pos = 0;

    buff = new Array(1024);
    out = "";
    while((i = zip_inflate_internal(buff, 0, buff.length)) > 0) {
	for(j = 0; j < i; j++)
	    out += String.fromCharCode(buff[j]);
    }
    zip_inflate_data = null; // G.C.
    return out;
}

//
// end of the script of Masanao Izumo.
//

// we add the compression method for JSZip
if(!JSZip.compressions["DEFLATE"]) {
  JSZip.compressions["DEFLATE"] = {
    magic : "\x08\x00",
    uncompress : zip_inflate
  }
} else {
  JSZip.compressions["DEFLATE"].uncompress = zip_inflate;
}

})();
return JSZip;
});

define('jszip',['./unzip'],function(JSZip){
    return function(buffer){
        var zip = new JSZip(buffer);
        var files = zip.file(/.+/);
        var out = {};
        files.forEach(function(a){
	        if(a.name.slice(-7).toLowerCase()==="geojson"){
		        out[a.name]=a.asText();
	        }else{
		        out[a.name]=a.asArrayBuffer();
	        }
        });
        return out;
    };
});

(function (global, undefined) {
    

    var tasks = (function () {
        function Task(handler, args) {
            this.handler = handler;
            this.args = args;
        }
        Task.prototype.run = function () {
            // See steps in section 5 of the spec.
            if (typeof this.handler === "function") {
                // Choice of `thisArg` is not in the setImmediate spec; `undefined` is in the setTimeout spec though:
                // http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html
                this.handler.apply(undefined, this.args);
            } else {
                var scriptSource = "" + this.handler;
                /*jshint evil: true */
                eval(scriptSource);
            }
        };

        var nextHandle = 1; // Spec says greater than zero
        var tasksByHandle = {};
        var currentlyRunningATask = false;

        return {
            addFromSetImmediateArguments: function (args) {
                var handler = args[0];
                var argsToHandle = Array.prototype.slice.call(args, 1);
                var task = new Task(handler, argsToHandle);

                var thisHandle = nextHandle++;
                tasksByHandle[thisHandle] = task;
                return thisHandle;
            },
            runIfPresent: function (handle) {
                // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
                // So if we're currently running a task, we'll need to delay this invocation.
                if (!currentlyRunningATask) {
                    var task = tasksByHandle[handle];
                    if (task) {
                        currentlyRunningATask = true;
                        try {
                            task.run();
                        } finally {
                            delete tasksByHandle[handle];
                            currentlyRunningATask = false;
                        }
                    }
                } else {
                    // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
                    // "too much recursion" error.
                    global.setTimeout(function () {
                        tasks.runIfPresent(handle);
                    }, 0);
                }
            },
            remove: function (handle) {
                delete tasksByHandle[handle];
            }
        };
    }());

    function canUseNextTick() {
        // Don't get fooled by e.g. browserify environments.
        return typeof process === "object" &&
               Object.prototype.toString.call(process) === "[object process]";
    }

    function canUseMessageChannel() {
        return !!global.MessageChannel;
    }

    function canUsePostMessage() {
        // The test against `importScripts` prevents this implementation from being installed inside a web worker,
        // where `global.postMessage` means something completely different and can't be used for this purpose.

        if (!global.postMessage || global.importScripts) {
            return false;
        }

        var postMessageIsAsynchronous = true;
        var oldOnMessage = global.onmessage;
        global.onmessage = function () {
            postMessageIsAsynchronous = false;
        };
        global.postMessage("", "*");
        global.onmessage = oldOnMessage;

        return postMessageIsAsynchronous;
    }

    function canUseReadyStateChange() {
        return "document" in global && "onreadystatechange" in global.document.createElement("script");
    }

    function installNextTickImplementation(attachTo) {
        attachTo.setImmediate = function () {
            var handle = tasks.addFromSetImmediateArguments(arguments);

            process.nextTick(function () {
                tasks.runIfPresent(handle);
            });

            return handle;
        };
    }

    function installMessageChannelImplementation(attachTo) {
        var channel = new global.MessageChannel();
        channel.port1.onmessage = function (event) {
            var handle = event.data;
            tasks.runIfPresent(handle);
        };
        attachTo.setImmediate = function () {
            var handle = tasks.addFromSetImmediateArguments(arguments);

            channel.port2.postMessage(handle);

            return handle;
        };
    }

    function installPostMessageImplementation(attachTo) {
        // Installs an event handler on `global` for the `message` event: see
        // * https://developer.mozilla.org/en/DOM/window.postMessage
        // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages

        var MESSAGE_PREFIX = "com.bn.NobleJS.setImmediate" + Math.random();

        function isStringAndStartsWith(string, putativeStart) {
            return typeof string === "string" && string.substring(0, putativeStart.length) === putativeStart;
        }

        function onGlobalMessage(event) {
            // This will catch all incoming messages (even from other windows!), so we need to try reasonably hard to
            // avoid letting anyone else trick us into firing off. We test the origin is still this window, and that a
            // (randomly generated) unpredictable identifying prefix is present.
            if (event.source === global && isStringAndStartsWith(event.data, MESSAGE_PREFIX)) {
                var handle = event.data.substring(MESSAGE_PREFIX.length);
                tasks.runIfPresent(handle);
            }
        }
        if (global.addEventListener) {
            global.addEventListener("message", onGlobalMessage, false);
        } else {
            global.attachEvent("onmessage", onGlobalMessage);
        }

        attachTo.setImmediate = function () {
            var handle = tasks.addFromSetImmediateArguments(arguments);

            // Make `global` post a message to itself with the handle and identifying prefix, thus asynchronously
            // invoking our onGlobalMessage listener above.
            global.postMessage(MESSAGE_PREFIX + handle, "*");

            return handle;
        };
    }

    function installReadyStateChangeImplementation(attachTo) {
        attachTo.setImmediate = function () {
            var handle = tasks.addFromSetImmediateArguments(arguments);

            // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
            // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
            var scriptEl = global.document.createElement("script");
            scriptEl.onreadystatechange = function () {
                tasks.runIfPresent(handle);

                scriptEl.onreadystatechange = null;
                scriptEl.parentNode.removeChild(scriptEl);
                scriptEl = null;
            };
            global.document.documentElement.appendChild(scriptEl);

            return handle;
        };
    }

    function installSetTimeoutImplementation(attachTo) {
        attachTo.setImmediate = function () {
            var handle = tasks.addFromSetImmediateArguments(arguments);

            global.setTimeout(function () {
                tasks.runIfPresent(handle);
            }, 0);

            return handle;
        };
    }

    if (!global.setImmediate) {
        // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
        var attachTo = typeof Object.getPrototypeOf === "function" && "setTimeout" in Object.getPrototypeOf(global) ?
                          Object.getPrototypeOf(global)
                        : global;

        if (canUseNextTick()) {
            // For Node.js before 0.9
            installNextTickImplementation(attachTo);
        } else if (canUsePostMessage()) {
            // For non-IE10 modern browsers
            installPostMessageImplementation(attachTo);
        } else if (canUseMessageChannel()) {
            // For web workers, where supported
            installMessageChannelImplementation(attachTo);
        } else if (canUseReadyStateChange()) {
            // For IE 6–8
            installReadyStateChangeImplementation(attachTo);
        } else {
            // For older browsers
            installSetTimeoutImplementation(attachTo);
        }

        attachTo.clearImmediate = tasks.remove;
    }
}(typeof global === "object" && global ? global : this));

/*! lie 1.0.0 2013-08-30*/
/*! (c)2013 Ruben Verborgh & Calvin Metcalf @license MIT https://github.com/calvinmetcalf/lie*/
(function(){
	var create = function(tick,exports) {
		var func = 'function';
		// Creates a deferred: an object with a promise and corresponding resolve/reject methods
		function Deferred() {
			// The `handler` variable points to the function that will
			// 1) handle a .then(onFulfilled, onRejected) call
			// 2) handle a .resolve or .reject call (if not fulfilled)
			// Before 2), `handler` holds a queue of callbacks.
			// After 2), `handler` is a simple .then handler.
			// We use only one function to save memory and complexity.
			var handler = function(onFulfilled, onRejected, value) {
				// Case 1) handle a .then(onFulfilled, onRejected) call
				var createdDeffered;
				if (onFulfilled !== handler) {
					createdDeffered = createDeferred();
					handler.queue.push({
						deferred: createdDeffered,
						resolve: onFulfilled,
						reject: onRejected
					});
					return createdDeffered.promise;
				}
	
				// Case 2) handle a .resolve or .reject call
				// (`onFulfilled` acts as a sentinel)
				// The actual function signature is
				// .re[ject|solve](sentinel, success, value)
				var action = onRejected ? 'resolve' : 'reject',
					queue, deferred, callback;
				for (var i = 0, l = handler.queue.length; i < l; i++) {
					queue = handler.queue[i];
					deferred = queue.deferred;
					callback = queue[action];
					if (typeof callback !== func) {
						deferred[action](value);
					}
					else {
						execute(callback, value, deferred);
					}
				}
				// Replace this handler with a simple resolved or rejected handler
				handler = createHandler(promise, value, onRejected);
			};
	
			function Promise() {
				this.then = function(onFulfilled, onRejected) {
					return handler(onFulfilled, onRejected);
				};
			}
			var promise = new Promise();
			this.promise = promise;
			// The queue of deferreds
			handler.queue = [];
	
			this.resolve = function(value) {
				if(handler.queue){
					handler(handler, true, value);
				}
			};
			
			this.fulfill = this.resolve;
			
			this.reject = function(reason) {
				if(handler.queue){
					handler(handler, false, reason);
				}
			};
		}
	
		function createDeferred() {
			return new Deferred();
		}
	
		// Creates a fulfilled or rejected .then function
		function createHandler(promise, value, success) {
			return function(onFulfilled, onRejected) {
				var callback = success ? onFulfilled : onRejected,
					result;
				if (typeof callback !== func) {
					return promise;
				}
				execute(callback, value, result = createDeferred());
				return result.promise;
			};
		}
	
		// Executes the callback with the specified value,
		// resolving or rejecting the deferred
		function execute(callback, value, deferred) {
			tick(function() {
				var result;
				try {
					result = callback(value);
					if (result && typeof result.then === func) {
						result.then(deferred.resolve, deferred.reject);
					}
					else {
						deferred.resolve(result);
					}
				}
				catch (error) {
					deferred.reject(error);
				}
			});
		}
		exports = createDeferred;
		// Returns a resolved promise
		exports.resolve = function(value) {
			var promise = {};
			promise.then = createHandler(promise, value, true);
			return promise;
		};
		// Returns a rejected promise
		exports.reject = function(reason) {
			var promise = {};
			promise.then = createHandler(promise, reason, false);
			return promise;
		};
		// Returns a deferred
		

		return exports;
	};

	if(typeof define === 'function'){
		define('lie',[],function(){
			return create(typeof setImmediate === 'function'?setImmediate:setTimeout,{});
		});
	}else if(typeof module === 'undefined' || !('exports' in module)){
		create(typeof setImmediate === 'function'?setImmediate:setTimeout,typeof global === 'object' && global ? global : this);
	}else{
		module.exports = create(process.nextTick,{});
	}
})();

define('binaryajax',['./lie'],function(deferred){
return function(url){
    var promise = deferred();
	var ajax = new XMLHttpRequest();
	ajax.onreadystatechange=callback;
	ajax.open("GET",url,true);
	ajax.responseType='arraybuffer';
	ajax.send();
	function callback(resp){
		if(ajax.readyState === 4 && ajax.status === 200) {
			promise.resolve(ajax.response);
		}
	}
	return promise.promise;
}
});

define('shp',[],function(){
var parseHeader = function(buffer){
	var view = new DataView(buffer,0,100) 
	//if(view.getInt32(0,false)!==9994){
	//	return shp.reject("wrong type");
	//}
	return /*shp.resolve(*/{
		length : view.getInt32(6<<2,false),
		version : view.getInt32(7<<2,true),
		shpCode : view.getInt32(8<<2,true),
		bbox : [
			view.getFloat64(9<<2,true),
			view.getFloat64(11<<2,true),
			view.getFloat64(13<<2,true),
			view.getFloat64(13<<2,true)
		]
	}/*)*/;
}
function isClockWise(array){
	var sum = 0;
	var i = 1;
	var len = array.length;
	var prev,cur;
	while(i<len){
		prev = cur||array[0];
		cur = array[i];
		sum += ((cur[0]-prev[0])*(cur[1]+prev[1]));
		i++;
	}
	return sum > 0;
}
function polyReduce(a,b){
	if(isClockWise(b)){
		a.push([b]);
	}else{
		a[a.length-1].push(b);
	}
	return a;
}
function parsePoint(data,trans){
	return {
		"type": "Point",
		"coordinates":trans(data,0)
	};
}
function parseZPoint(data,trans){
	var pointXY = parsePoint(data,trans);
	pointXY.coordinates.push(trans(data,16));
	return pointXY;
}
function parsePointArray(data,offset,num,trans){
	var out = [];
	var done = 0;
	while(done<num){
		out.push(trans(data,offset));
		offset += 16;
		done++;
	}
	return out;
}
function parseZPointArray(data,zOffset,num,coordinates){
	var i = 0;
	while(i<num){
		coordinates[i].push(data.getFloat64(zOffset,true));
		i++;
		zOffset += 8;
	}
	return coordinates;
}
function parseArrayGroup(data,offset,partOffset,num,tot,trans){
	var out = [];
	var done = 0;
	var curNum,nextNum=0,pointNumber;
	while(done<num){
		done++;
		partOffset += 4;
		curNum = nextNum;
		if(done===num){
			nextNum = tot;
		}else{
			nextNum = data.getInt32(partOffset,true);
		}
		pointNumber = nextNum - curNum;
		if(!pointNumber){
			continue;
		}
		out.push(parsePointArray(data,offset,pointNumber,trans));
		offset += (pointNumber<<4);
	}
	return out;
}
function parseZArrayGroup(data,zOffset,num,coordinates){
	var i = 0;
	while(i<num){
		coordinates[i] = parseZPointArray(data,zOffset,coordinates[i].length,coordinates[i]);
		zOffset += (coordinates[i].length<<3);
		i++;
	}
	return coordinates;
}
function parseMultiPoint(data,trans){
	var out = {};
	out.bbox = [
		data.getFloat64(0,true),
		data.getFloat64(8,true),
		data.getFloat64(16,true),
		data.getFloat64(24,true)
	];
	var num = data.getInt32(32,true);
	var offset = 36;
	if(num===1){
		out.type = "Point";
		out.coordinates = trans(data,offset);
	}else{
		out.type = "MultiPoint";
		out.coordinates = parsePointArray(data,offset,num,trans);
	}
	return out;
}
function parseZMultiPoint(data,trans){
	var geoJson = parseMultiPoint(data,trans);
	var num;
	if(geoJson.type === "Point"){
		geoJson.coordinates.push(data.getFloat64(72,true));
		return geoJson;
	}else{
		num = geoJson.coordinates.length;
	}
	var zOffset = 56 + (num<<4);
	geoJson.coordinates =  parseZPointArray(data,zOffset,num,geoJson.coordinates);
	return geoJson;
}
function parsePolyline(data,trans){
	var out = {};
	out.bbox = [
		data.getFloat64(0,true),
		data.getFloat64(8,true),
		data.getFloat64(16,true),
		data.getFloat64(24,true)
	];
	var numParts = data.getInt32(32,true);
	var num = data.getInt32(36,true);
	var offset,partOffset;
	if(numParts === 1){
		out.type = "LineString";
		offset = 44;
		out.coordinates = parsePointArray(data,offset,num,trans);
	}else{
		out.type = "MultiLineString";
		offset = 40 + (numParts<<2);
		partOffset = 40;
		out.coordinates = parseArrayGroup(data,offset,partOffset,numParts,num,trans);
	}
	return out;
}
function parseZPolyline(data,trans){
	var geoJson = parsePolyline(data,trans);
	var num = geoJson.coordinates.length;
	var zOffset = 60 + (num<<4);
	if(geoJson.type === "LineString"){
		geoJson.coordinates =  parseZPointArray(data,zOffset,num,geoJson.coordinates);
		return geoJson;
	}else{
		geoJson.coordinates =  parseZArrayGroup(data,zOffset,num,geoJson.coordinates);
		return geoJson;
	}
}
function polyFuncs(out){
	if(out.type === "LineString"){
		out.type = "Polygon";
		out.coordinates = [out.coordinates];
		return out;
	}else{
		out.coordinates = out.coordinates.reduce(polyReduce,[]);
		if(out.coordinates.length === 1){
			out.type = "Polygon";
			out.coordinates = out.coordinates[0];
			return out;
		}else{
			out.type = "MultiPolygon";
			return out;
		}
	}
}
function parsePolygon(data,trans){
	return polyFuncs(parsePolyline(data,trans));
}
function parseZPolygon(data,trans){
	return polyFuncs(parseZPolyline(data,trans));
}
var shpFuncObj = {
	1:parsePoint,
	3:parsePolyline,
	5:parsePolygon,
	8:parseMultiPoint,
	11:parseZPoint,
	13:parseZPolyline,
	15:parseZPolygon,
	18:parseZMultiPoint
};
function shpFuncs (num,tran){
	if(num>20){
		num -= 20;
	}
	if(!(num in shpFuncObj)){
		console.log("I don't know that shp type");
		return function(){
			return function(){};
		};
	}
	var shpFunc = shpFuncObj[num];
	var parseCoord = makeParseCoord(tran);
	return function(data){
		return shpFunc(data,parseCoord);
	};
}
var getRow = function(buffer,offset){
	var view = new DataView(buffer,offset,12);
	var len = view.getInt32(4,false)<<1;
	var data = new DataView(buffer,offset+12,len-4);
	
	return {
		id:view.getInt32(0,false),
		len:len,
		data:data,
		type:view.getInt32(8,true)
	};
};

var getRows = function(buffer,parseShape,trans){
	var offset=100;
	var len = buffer.byteLength;
	var out = [];
	var current;
	while(offset<len){
		current = getRow(buffer,offset);
		offset += 8;
		offset += current.len;
		if(current.type){
			out.push(parseShape(current.data,trans));
		}
	}
	return out;
};
function makeParseCoord(trans){
	if(trans){
		return function(data,offset){
			return trans.inverse([data.getFloat64(offset,true),data.getFloat64(offset+8,true)]);
		}
	}else{
		return function(data,offset){
			return [data.getFloat64(offset,true),data.getFloat64(offset+8,true)];
		}
	}
}
return function(buffer,trans){
	var headers = parseHeader(buffer);
	return getRows(buffer,shpFuncs(headers.shpCode,trans));
};
});

define('dbf',[],function(){
function dbfHeader(buffer){
    var data = new DataView(buffer);
	var out = {}
	out.lastUpdated = new Date(data.getUint8(1,true)+1900,data.getUint8(2,true),data.getUint8(3,true));
	out.records = data.getUint32(4,true);
	out.headerLen = data.getUint16(8,true);
	out.recLen = data.getUint16(10,true)
	return out;
}

function dbfRowHeader(buffer){
	var data = new DataView(buffer);
	var out = [];
	var offset = 32;
	while(true){
		out.push({
			name : String.fromCharCode.apply(this,(new Uint8Array(buffer,offset,10))).replace(/\0|\s+$/g,''),
			dataType : String.fromCharCode(data.getUint8(offset+11)),
			len : data.getUint8(offset+16),
			decimal : data.getUint8(offset+17)
		});
		if(data.getUint8(offset+32)===13){
			break;
		}else{
			offset+=32;
		}
	}
	return out;
}
var rowFuncs = function(buffer,offset,len,type){
	var data = (new Uint8Array(buffer,offset,len));
	var textData = String.fromCharCode.apply(this,data).replace(/\0|\s+$/g,'');
	if(type === 'N'){
		return parseFloat(textData,10);
	} else if (type === 'D') {
		return new Date(textData.slice(0,4), parseInt(textData.slice(4,6),10)-1, textData.slice(6,8));
	} else {
		return textData;
	}
}
function parseRow(buffer,offset,rowHeaders){
	var out={};
	var i = 0;
	var len = rowHeaders.length;
	var field;
	var header;
	while(i<len){
		header = rowHeaders[i];
		field = rowFuncs(buffer,offset,header.len,header.dataType);
		offset += header.len;
		if(typeof field !== 'undefined'){
			out[header.name]=field;
		}
		i++;
	}
	return out;
}
return function(buffer){
	var rowHeaders = dbfRowHeader(buffer);
	var header = dbfHeader(buffer);
	var offset = ((rowHeaders.length+1)<<5)+2;
	var recLen = header.recLen;
	var records = header.records;
	var data = new DataView(buffer);
	var out = [];
	while(records){
		out.push(parseRow(buffer,offset,rowHeaders));
		offset += recLen;
		records--;
	}
	return out;
}
});

define('core',['proj4','jszip','binaryajax','shp','dbf'],function(proj4,unzip,binaryAjax,parseShp,parseDbf){
function shp(base){
    return shp.getShapefile(base);
};
shp.combine=function(arr){
	var out = {};
	out.type="FeatureCollection";
	out.features=[];
	var i = 0;
	var len = arr[0].length;
	while(i<len){
		out.features.push({
			"type": "Feature",
			"geometry": arr[0][i],
			"properties": arr[1][i]
		});
		i++;
	}
	return out;
}
shp.parseZip = function(buffer){
		var key;
		var zip=unzip(buffer);
		var names = [];
		for(key in zip){
			if(key.slice(-3).toLowerCase()==="shp"){
				names.push(key.slice(0,-4));
			}else if(key.slice(-3).toLowerCase()==="dbf"){
				zip[key]=parseDbf(zip[key]);
			}else if(key.slice(-3).toLowerCase()==="prj"){
				zip[key]=proj4(String.fromCharCode.apply(null,new Uint8Array(zip[key])));
			}else if(key.slice(-7).toLowerCase()==="geojson"){
				names.push(key);
			}
		}
	var geojson = names.map(function(name){
		var parsed
		if(name.slice(-7).toLowerCase()==="geojson"){
			parsed = JSON.parse(zip[name]);
			parsed.fileName = name.slice(0,-8);
		}else{
			parsed =  shp.combine([parseShp(zip[name +'.shp'],zip[name +'.prj']),zip[name +'.dbf']]);
			parsed.fileName = name;
		}
		return parsed;
	});
	if(geojson.length === 1){
		return geojson[0];
	}else{
		return geojson;
	}
};
function getZip(base){
	return binaryAjax(base).then(shp.parseZip);
}
shp.getShapefile = function(base){
	if(typeof base === 'string'){
		if(base.slice(-4)==='.zip'){
			return getZip(base);
		}else{ 
		return shp.all([
			binaryAjax(base+'.shp').then(shp.parseShp),
			binaryAjax(base+'.dbf').then(shp.parseDbf)
		]).then(shp.combine)}
	}else{
		return shp.resolve(shp.parseZip(base));
	}
}
return shp;
});
  return require('shp');
}));
