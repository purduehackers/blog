#set page(width: auto, height: auto, margin: 0.5in)
#set text(font: "Iosevka")

#import "@preview/fletcher:0.5.8" as fletcher: diagram, edge, node, shapes.diamond

#let small-font-size = 8pt

#figure()[ #diagram(
  node-stroke: 1pt,
  edge-stroke: 1pt,

  node(
    (0, 0),
    align(center)[Did you read \ SIGHORSE?],
    shape: diamond,
    name: "read",
    height: 1.25cm,
  ),

  node(
    (1.5, 1.5),
    align(center)[Did you enjoy \ SIGHORSE?],
    shape: diamond,
    name: "enjoy",
    height: 1.25cm,
  ),
  node(
    (3, 3),
    [You should read \ SIGBOVIK.],
    shape: rect,
    name: "end",
  ),
  edge(
    <read>,
    <enjoy>,
    [
      #set align(center)
      Yes \ #text(size: small-font-size)["Thanks!"]
    ],
    "->",
    label-side: left,
  ),
  edge(
    <read>,
    <end>,
    [
      #set align(center)
      No \
      #text(size: small-font-size)["If you didn't read SIGHORSE, \
        SIGBOVIK may be interesting."]
    ],
    "->",
    bend: -50deg,
    label-side: right,
  ),
  edge(
    <enjoy>,
    <end>,
    align(center)[
      Yes \
      #text(size: small-font-size)["More of \ the same!"]
    ],
    "->",
    label-side: right,
  ),
  edge(
    <enjoy>,
    <end>,
    [
      #set align(center)
      No \
      #text(size: small-font-size)["If you didn't \ enjoy SIGHORSE, \
      maybe SIGBOVIK would  \ be more your speed."]
    ],
    "->",
    bend: 50deg,
    label-side: left,
  ),
)]
