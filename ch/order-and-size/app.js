"use strict";
//node ids are in order in which nodes come in existence
var nodes = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];

var links = [
  { source: 0, target: 1 },
  { source: 0, target: 2 },
  { source: 1, target: 2 },
  { source: 1, target: 3 },
  { source: 2, target: 3 }
];

//universal width and height let index.htm control svg dimensions when needed
var lastNodeId = nodes.length;
var w = univSvgWidth ? univSvgWidth : 616,
  h = univSvgHeight ? univSvgHeight : 400,
  rad = 10;

var svg = d3
  .select("#svg-wrap")
  .append("svg")
  .attr("width", w)
  .attr("height", h);

var dragLine = svg
  .append("path")
  .attr("class", "dragLine hidden")
  .attr("d", "M0,0L0,0");

var edges = svg.append("g").selectAll(".edge");

var vertices = svg.append("g").selectAll(".vertex");

var force = d3
  .forceSimulation()
  .force(
    "charge",
    d3
      .forceManyBody()
      .strength(-500)
      .distanceMax((w + h) / 2)
  )
  .force("link", d3.forceLink().distance(100))
  .force("x", d3.forceX(w / 2))
  .force("y", d3.forceY(h / 2))
  .on("tick", tick);

var colors = d3.schemeCategory10;

var mousedownNode = null,
  mouseupNode = null;

var clrBtn = d3.select("#clear-graph");
clrBtn.on("click", clearGraph);

function resetMouseVar() {
  mousedownNode = null;
  mouseupNode = null;
}

//empties the graph
function clearGraph() {
  nodes.splice(0);
  links.splice(0);
  lastNodeId = 0;
  restart();
  showGraphLatex();
}

//update the simulation
function tick() {
  edges
    .attr("x1", function(d) {
      return d.source.x;
    })
    .attr("y1", function(d) {
      return d.source.y;
    })
    .attr("x2", function(d) {
      return d.target.x;
    })
    .attr("y2", function(d) {
      return d.target.y;
    });

  vertices
    .attr("cx", function(d) {
      return d.x;
    })
    .attr("cy", function(d) {
      return d.y;
    });
}

function addNode() {
  var e = d3.event;
  if (e.button == 0) {
    var coords = d3.mouse(e.target);
    var newNode = { x: coords[0], y: coords[1], id: ++lastNodeId };
    nodes.push(newNode);
    restart();
    showGraphLatex();
  }
}

//d is data, i is index according to selection
function removeNode(d, i) {
  //to make ctrl-drag works for mac/osx users
  if (d3.event.ctrlKey) return;
  nodes.splice(nodes.indexOf(d), 1);
  var linksToRemove = links.filter(function(l) {
    return l.source === d || l.target === d;
  });
  linksToRemove.map(function(l) {
    links.splice(links.indexOf(l), 1);
  });
  d3.event.preventDefault();
  restart();
  showGraphLatex();
}

function removeEdge(d, i) {
  links.splice(links.indexOf(d), 1);
  d3.event.preventDefault();
  restart();
  showGraphLatex();
}

function beginDragLine(d) {
  //to prevent call of addNode through svg
  d3.event.stopPropagation();
  //to prevent dragging of svg in firefox
  d3.event.preventDefault();
  if (d3.event.ctrlKey || d3.event.button != 0) return;
  mousedownNode = d;
  dragLine
    .classed("hidden", false)
    .attr(
      "d",
      "M" +
        mousedownNode.x +
        "," +
        mousedownNode.y +
        "L" +
        mousedownNode.x +
        "," +
        mousedownNode.y
    );
}

function updateDragLine() {
  var coords = d3.mouse(d3.event.target);
  if (!mousedownNode) return;
  dragLine.attr(
    "d",
    "M" +
      mousedownNode.x +
      "," +
      mousedownNode.y +
      "L" +
      coords[0] +
      "," +
      coords[1]
  );
}

function hideDragLine() {
  dragLine.classed("hidden", true);
  resetMouseVar();
  restart();
}

//no need to call hideDragLine in endDragLine
//mouseup on vertices propagates to svg which calls hideDragLine
function endDragLine(d) {
  if (!mousedownNode || mousedownNode === d) return;
  //return if link already exists
  for (var i = 0; i < links.length; i++) {
    var l = links[i];
    if (
      (l.source === mousedownNode && l.target === d) ||
      (l.source === d && l.target === mousedownNode)
    ) {
      return;
    }
  }
  var newLink = { source: mousedownNode, target: d };
  links.push(newLink);
  showGraphLatex();
}

//one response per ctrl keydown
var lastKeyDown = -1;

function keydown() {
  d3.event.preventDefault();
  if (lastKeyDown !== -1) return;
  lastKeyDown = d3.event.key;

  if (lastKeyDown === "Control") {
    vertices.call(
      d3
        .drag()
        .on("start", function dragstarted(d) {
          if (!d3.event.active) force.alphaTarget(1).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", function(d) {
          d.fx = d3.event.x;
          d.fy = d3.event.y;
        })
        .on("end", function(d) {
          if (!d3.event.active) force.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );
  }
}

function keyup() {
  lastKeyDown = -1;
  if (d3.event.key === "Control") {
    vertices.on("mousedown.drag", null);
  }
}

//updates the graph by updating links, nodes and binding them with DOM
//interface is defined through several events
function restart() {
  edges = edges.data(links, function(d) {
    return "v" + d.source.id + "-v" + d.target.id;
  });
  edges.exit().remove();
  edges = edges
    .enter()
    .append("line")
    .attr("class", "edge")
    .on("mousedown", function() {
      d3.event.stopPropagation();
    })
    .on("contextmenu", removeEdge)
    .on("mouseover", function(d) {
      var thisEdge = d3.select(this);
      if (thisEdge.select("title").empty()) {
        thisEdge.append("title").text("v" + d.source.id + "-v" + d.target.id);
      }
    })
    .merge(edges);

  //vertices are known by id
  vertices = vertices.data(nodes, function(d) {
    return d.id;
  });
  vertices.exit().remove();
  vertices = vertices
    .enter()
    .append("circle")
    .attr("r", rad)
    .attr("class", "vertex")
    .style("fill", function(d, i) {
      return colors[d.id % 10];
    })
    .on("mousedown", beginDragLine)
    .on("mouseup", endDragLine)
    .on("contextmenu", removeNode)
    .on("mouseover", function(d) {
      var thisVertex = d3.select(this);
      if (thisVertex.select("title").empty()) {
        thisVertex.append("title").text("v" + d.id);
      }
    })
    .merge(vertices);

  force.nodes(nodes);
  force.force("link").links(links);
  force.alpha(0.8).restart();
}

//further interface
svg
  .on("mousedown", addNode)
  .on("mousemove", updateDragLine)
  .on("mouseup", hideDragLine)
  .on("contextmenu", function() {
    d3.event.preventDefault();
  })
  .on("mouseleave", hideDragLine);

d3.select(window)
  .on("keydown", keydown)
  .on("keyup", keyup);

restart();
showGraphLatex();

//shows order and size of graph
function showGraphLatex() {
  var order = nodes.length,
    size = links.length;

  var l = "\\[\\text{Order}=" + order + "\\]\\[\\text{Size}=" + size + "\\]";
  if (2 * size === order * (order - 1)) {
    l += "\\[\\text{Size maximized!!}\\]";
  }
  document.getElementById("svg-output").textContent = l;
  //recall mathjax
  MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
}