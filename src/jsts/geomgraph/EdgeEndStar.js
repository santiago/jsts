/* Copyright (c) 2011 by The Authors.
 * Published under the LGPL 2.1 license.
 * See /license-notice.txt for the full text of the license notice.
 * See /license.txt for the full text of the license.
 */

/**
 * @requires jsts/geom/Location.js
 */



/**
 * A EdgeEndStar is an ordered list of EdgeEnds around a node. They are
 * maintained in CCW order (starting with the positive x-axis) around the node
 * for efficient lookup and topology building.
 *
 * @constructor
 */
jsts.geomgraph.EdgeEndStar = function() {
  this.edgeMap = {};
  this.edgeList = null;
  this.ptInAreaLocation = [jsts.geom.Location.NONE, jsts.geom.Location.NONE];
};


/**
 * A map which maintains the edges in sorted order around the node
 *
 * NOTE: In In JSTS a JS object replaces TreeMap. Sorting is done when needed.
 *
 * @protected
 */
jsts.geomgraph.EdgeEndStar.prototype.edgeMap = null;


/**
 * A list of all outgoing edges in the result, in CCW order
 *
 * @protected
 */
jsts.geomgraph.EdgeEndStar.prototype.edgeList = null;


/**
 * The location of the point for this star in Geometry i Areas
 *
 * @private
 */
jsts.geomgraph.EdgeEndStar.prototype.ptInAreaLocation = null;


/**
 * Insert a EdgeEnd into this EdgeEndStar
 */
jsts.geomgraph.EdgeEndStar.prototype.insert = function(e) {
  throw new jsts.error.AbstractMethodInvocationError();
};


/**
 * Insert an EdgeEnd into the map, and clear the edgeList cache, since the list
 * of edges has now changed
 *
 * @protected
 */
jsts.geomgraph.EdgeEndStar.prototype.insertEdgeEnd = function(e, obj) {
  this.edgeMap[e] = obj;
  this.edgeList = null; // edge list has changed - clear the cache
};


/**
 * @return the coordinate for the node this star is based at.
 */
jsts.geomgraph.EdgeEndStar.prototype.getCoordinate = function() {
  this.getEdges();
  if (this.edgeList.length === 0)
    return null;
  var e = this.edgeList[0];
  return e.getCoordinate();
};
jsts.geomgraph.EdgeEndStar.prototype.getDegree = function() {
  this.getEdges();
  return this.edgeList.length;
};


/**
 * Iterator access to the ordered list of edges is optimized by copying the map
 * collection to a list. (This assumes that once an iterator is requested, it is
 * likely that insertion into the map is complete).
 *
 * NOTE: jsts does not support iterators
 */
jsts.geomgraph.EdgeEndStar.prototype.getEdges = function() {
  this.edgeList = [];
  for (var key in this.edgeMap) {
    if (this.edgeMap.hasOwnProperty(key)) {
      this.edgeList.push(this.edgeMap[key]);
    }
  }

  var compare = function(a,b) {
    return a.compareTo(b);
  };
  this.edgeList.sort(compare);

  return this.edgeList;
};

jsts.geomgraph.EdgeEndStar.prototype.getNextCW = function(ee) {
  this.getEdges();
  var i = this.edgeList.indexOf(ee);
  var iNextCW = i - 1;
  if (i === 0)
    iNextCW = this.edgeList.length - 1;
  return this.edgeList[iNextCW];
};

jsts.geomgraph.EdgeEndStar.prototype.computeLabelling = function(geomGraph) {
  this.computeEdgeEndLabels(geomGraph[0].getBoundaryNodeRule());
  this.propagateSideLabels(0);
  this.propagateSideLabels(1);

  /**
   * If there are edges that still have null labels for a geometry this must be
   * because there are no area edges for that geometry incident on this node. In
   * this case, to label the edge for that geometry we must test whether the
   * edge is in the interior of the geometry. To do this it suffices to
   * determine whether the node for the edge is in the interior of an area. If
   * so, the edge has location INTERIOR for the geometry. In all other cases
   * (e.g. the node is on a line, on a point, or not on the geometry at all) the
   * edge has the location EXTERIOR for the geometry.
   * <p>
   * Note that the edge cannot be on the BOUNDARY of the geometry, since then
   * there would have been a parallel edge from the Geometry at this node also
   * labelled BOUNDARY and this edge would have been labelled in the previous
   * step.
   * <p>
   * This code causes a problem when dimensional collapses are present, since it
   * may try and determine the location of a node where a dimensional collapse
   * has occurred. The point should be considered to be on the EXTERIOR of the
   * polygon, but locate() will return INTERIOR, since it is passed the original
   * Geometry, not the collapsed version.
   *
   * If there are incident edges which are Line edges labelled BOUNDARY, then
   * they must be edges resulting from dimensional collapses. In this case the
   * other edges can be labelled EXTERIOR for this Geometry.
   *
   * MD 8/11/01 - NOT TRUE! The collapsed edges may in fact be in the interior
   * of the Geometry, which means the other edges should be labelled INTERIOR
   * for this Geometry. Not sure how solve this... Possibly labelling needs to
   * be split into several phases: area label propagation, symLabel merging,
   * then finally null label resolution.
   */
  var hasDimensionalCollapseEdge = [false, false];
  this.getEdges();
  for (var i = 0; i < this.edgeList.length; i++) {
    var e = this.edgeList[i];
    var label = e.getLabel();
    for (var geomi = 0; geomi < 2; geomi++) {
      if (label.isLine(geomi) && label.getLocation(geomi) === jsts.geom.Location.BOUNDARY)
        hasDimensionalCollapseEdge[geomi] = true;
    }
  }
  for (var i = 0; i < this.edgeList.length; i++) {
    var e = this.edgeList[i];
    var label = e.getLabel();
    for (var geomi = 0; geomi < 2; geomi++) {
      if (label.isAnyNull(geomi)) {
        var loc = jsts.geom.Location.NONE;
        if (hasDimensionalCollapseEdge[geomi]) {
          loc = jsts.geom.Location.EXTERIOR;
        } else {
          var p = e.getCoordinate();
          loc = this.getLocation(geomi, p, geomGraph);
        }
        label.setAllLocationsIfNull(geomi, loc);
      }
    }
  }
};


/**
 * @private
 */
jsts.geomgraph.EdgeEndStar.prototype.computeEdgeEndLabels = function(
    boundaryNodeRule) {
  // Compute edge label for each EdgeEnd
  this.getEdges();
  for (var i = 0; i < this.edgeList.length; i++) {
    var ee = this.edgeList[i];
    ee.computeLabel(boundaryNodeRule);
  }
};


/**
 * @private
 */
jsts.geomgraph.EdgeEndStar.prototype.getLocation = function(geomIndex, p, geom) {
  // compute location only on demand
  if (this.ptInAreaLocation[geomIndex] === jsts.geom.Location.NONE) {
    this.ptInAreaLocation[geomIndex] = jsts.algorithm.locate.SimplePointInAreaLocator.locate(p,
        geom[geomIndex].getGeometry());
  }
  return this.ptInAreaLocation[geomIndex];
};

jsts.geomgraph.EdgeEndStar.prototype.isAreaLabelsConsistent = function(
    geomGraph) {
  this.computeEdgeEndLabels(geomGraph.getBoundaryNodeRule());
  return this.checkAreaLabelsConsistent(0);
};


/**
 * @private
 */
jsts.geomgraph.EdgeEndStar.prototype.checkAreaLabelsConsistent = function(
    geomIndex) {
  // Since edges are stored in CCW order around the node,
  // As we move around the ring we move from the right to the left side of the
  // edge
  this.getEdges();
  // if no edges, trivially consistent
  if (this.edgeList.length <= 0)
    return true;
  // initialize startLoc to location of last L side (if any)
  var lastEdgeIndex = this.edgeList.edges.length - 1;
  var startLabel = this.edgeList[lastEdgeIndex].getLabel();
  var startLoc = startLabel.getLocation(geomIndex, jsts.geomgraph.Position.LEFT);

  // TODO: Assert.isTrue(startLoc != Location.NONE, 'Found unlabelled area
  // edge');

  var currLoc = startLoc;
  for (var i = 0; i < this.edgeList.length; i++) {
    var e = this.edgeList[i];
    var label = e.getLabel();
    // we assume that we are only checking a area
    // TODO: Assert.isTrue(label.isArea(geomIndex), 'Found non-area edge');
    var leftLoc = label.getLocation(geomIndex, jsts.geomgraph.Position.LEFT);
    var rightLoc = label.getLocation(geomIndex, jsts.geomgraph.Position.RIGHT);
    // check that edge is really a boundary between inside and outside!
    if (leftLoc === rightLoc) {
      return false;
    }
    // check side location conflict
    // Assert.isTrue(rightLoc == currLoc, "side location conflict " + locStr);
    if (rightLoc !== currLoc) {
      return false;
    }
    currLoc = leftLoc;
  }
  return true;
};


/**
 * @private
 */
jsts.geomgraph.EdgeEndStar.prototype.propagateSideLabels = function(geomIndex) {
  // Since edges are stored in CCW order around the node,
  // As we move around the ring we move from the right to the left side of the
  // edge
  var startLoc = jsts.geom.Location.NONE;

  // initialize loc to location of last L side (if any)
  // System.out.println("finding start location");
  this.getEdges();
  for (var i = 0; i < this.edgeList.length; i++) {
    var e = this.edgeList[i];
    var label = e.getLabel();
    if (label.isArea(geomIndex) &&
        label.getLocation(geomIndex, jsts.geomgraph.Position.LEFT) !== jsts.geom.Location.NONE)
      startLoc = label.getLocation(geomIndex, jsts.geomgraph.Position.LEFT);
  }

  // no labelled sides found, so no labels to propagate
  if (startLoc === jsts.geom.Location.NONE)
    return;

  var currLoc = startLoc;
  this.getEdges();
  for (var i = 0; i < this.edgeList.length; i++) {
    var e = this.edgeList[i];
    var label = e.getLabel();
    // set null ON values to be in current location
    if (label.getLocation(geomIndex, jsts.geomgraph.Position.ON) === jsts.geom.Location.NONE)
      label.setLocation(geomIndex, jsts.geomgraph.Position.ON, currLoc);
    // set side labels (if any)
    if (label.isArea(geomIndex)) {
      var leftLoc = label.getLocation(geomIndex, jsts.geomgraph.Position.LEFT);
      var rightLoc = label
          .getLocation(geomIndex, jsts.geomgraph.Position.RIGHT);
      // if there is a right location, that is the next location to propagate
      if (rightLoc !== jsts.geom.Location.NONE) {
        if (rightLoc !== currLoc)
          throw new jsts.error.TopologyError('side location conflict', e
              .getCoordinate());
        if (leftLoc === jsts.geom.Location.NONE) {
          // TODO: Assert.shouldNeverReachHere('found single null side (at ' +
          // e.getCoordinate() + ')');
        }
        currLoc = leftLoc;
      } else {
        /**
         * RHS is null - LHS must be null too. This must be an edge from the
         * other geometry, which has no location labelling for this geometry.
         * This edge must lie wholly inside or outside the other geometry (which
         * is determined by the current location). Assign both sides to be the
         * current location.
         */
        // TODO: Assert.isTrue(label.getLocation(geomIndex, Position.LEFT) ==
        // Location.NONE, 'found single null side');
        label.setLocation(geomIndex, jsts.geomgraph.Position.RIGHT, currLoc);
        label.setLocation(geomIndex, jsts.geomgraph.Position.LEFT, currLoc);
      }
    }
  }
};

jsts.geomgraph.EdgeEndStar.prototype.findIndex = function(eSearch) {
  this.getEdges(); // force edgelist to be computed
  for (var i = 0; i < this.edgeList.length; i++) {
    var e = this.edgeList[i];
    if (e === eSearch)
      return i;
  }
  return -1;
};
