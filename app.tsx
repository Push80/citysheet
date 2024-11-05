import React, { useState, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import {createRoot} from 'react-dom/client';
import {Color, COORDINATE_SYSTEM, Deck, PickingInfo, OrbitView} from '@deck.gl/core';
import {PathLayer, ArcLayer, TextLayer, PolygonLayer} from '@deck.gl/layers';

var MAX_WIDTH, MAX_HEIGHT
var START_ANIMATION = false

type Coordinate = [number, number];
interface PathObject {
  path: Coordinate[];
}

type GridLine = {
  path: Coordinate;
};

type Cell = {
  coord: Coordinate;
  name: string;
  weight: number;
  width: number;
  height: number;
  value: string;
  font: string;
  font_size: number;
  color: string;
  background_color: string;
}

type Connection = {
  from: {
      name: string;
      weight: number;
      coords: [number, number];
  };
  to: {
      name: string;
      weight: number;
      coords: [number, number];
  };
}


type BartSegment = {
  inbound: number;
  outbound: number;
  from: {
    name: string;
    coordinate: [longitude: number, latitude: number];
  };
  to: {
    name: string;
    coordinate: [longitude: number, latitude: number];
  };
};

var DECK
var rows, cols, cells, row_layer, col_layer, text_layer, tower_layer, arc_layer
const HIGHLIGHT_COLOR = [255, 0, 0, 255]
export const colorRange: Color[] = [
  [1, 152, 189],
  [73, 227, 206],
  [216, 254, 181],
  [254, 237, 177],
  [254, 173, 84],
  [209, 55, 78]
];

export default function App() {
  var hovered_id = [""]
  var hovered_type = ""
  // Define the path to the JSON file
  const filepath = "/sheet_info.json"
  console.log(filepath)
  row_layer = new PathLayer<GridLine>
  col_layer = new PathLayer<GridLine>
  text_layer = new TextLayer<Cell>
  tower_layer = new PolygonLayer<Cell>
  arc_layer = new ArcLayer<Connection>
  // Read the JSON file and parse it
  fetch(filepath)
      .then(response => response.json())
      .then(data => {
          MAX_WIDTH = 0
          MAX_HEIGHT = 0
          rows = data.sheet?.rows;
          cols = data.sheet?.cols;
          cells = data.sheet?.cells;
          if (Array.isArray(rows) && Array.isArray(cols)) {
            row_layer = draw_lines(rows, "RowPaths");
            col_layer = draw_lines(cols, "ColPaths");
            text_layer = draw_cells()
            tower_layer = draw_towers()
            arc_layer = draw_arcs()
            DECK = new Deck({
              initialViewState: {
                target: [200, -200, 0],  // Center the view on (0,0) in Cartesian space
                zoom: 0,
                rotationX: 60,
                rotationOrbit: 0,
              },
              controller: {
                dragMode: 'pan' // Invert controls: regular drag pans, Ctrl+drag rotates
              },
              views: new OrbitView(),
              layers: [row_layer, col_layer, text_layer, tower_layer, arc_layer],
            });
            setTimeout(() => {
              START_ANIMATION = true
              tower_layer = draw_towers()
              arc_layer = draw_arcs()
              const layers = [row_layer, col_layer, text_layer, tower_layer, arc_layer]
              DECK.setProps({layers})
            }, 100);

            
          }
      })
      .catch(error => console.error("Error fetching JSON:", error));

  function draw_lines(coords: PathObject[], id: string): PathLayer<GridLine> {
    //This is currently drawing the grid using an array of coordinates
    const path_layer = new PathLayer<GridLine>({
      id: id,
      data: coords,
      getPath: (d: GridLine) => d.path,
      getWidth: 1,
      pickable: true,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN
    });
    return path_layer;
  }

  function draw_cells(): TextLayer<Cell> {
    text_layer = new TextLayer<Cell>({
      id: "CellLayer",
      data: cells,

      background: true,
      billboard: false,
      getPosition: (d: Cell) => [d.coord[0]+2, d.coord[1]-2, d.weight * 10 + 1],
      getText: (d: Cell) => d.value,
      /*
      getBackgroundColor: (d: Cell) => {
        const hex = d.background_color;
        // convert to RGB
        return hex.match(/[0-9a-f]{2}/g).map(x => parseInt(x, 16));
      },
      getColor: (d: Cell) => {
        const hex = d.color;
        // convert to RGB
        return hex.match(/[0-9a-f]{2}/g).map(x => parseInt(x, 16));
      },*/
      sizeScale: 0.25,
      sizeUnits: 'common',
      getAlignmentBaseline: 'top',
      getTextAnchor: 'start',

    })
    return text_layer;
  }

  function draw_towers(): PolygonLayer<Cell> {
    const cells_filtered = cells.filter(cell => cell.weight != 0)
    tower_layer = new PolygonLayer<Cell>({
      id: "TowerLayer",
      data: cells_filtered,
      getElevation: (d: Cell) => {
        const elevation = START_ANIMATION ? d.weight * 10 : 0
        return elevation
      },
      transitions: {
        getElevation: 3000
      },
      opacity: 0.25,
      getPolygon: (d: Cell) => {
        var top_left, top_right, bottom_left, bottom_right
        top_left = [d.coord[0], d.coord[1]]
        top_right = [d.coord[0] + d.width, d.coord[1]]
        bottom_left = [d.coord[0], d.coord[1] - d.height]
        bottom_right = [d.coord[0] + d.width, d.coord[1] - d.height]
        return [top_left, top_right, bottom_right, bottom_left]
      },/*{
        const center_x = d.coord[0] + (d.width / 2)
        const center_y = d.coord[1] - (d.height / 2)
        return [center_x, center_y]
      },*/
      getFillColor: d => d.weight === 0 ? [0, 0, 0, 0] : [48, 128, Math.sqrt(d.weight * 10) * 15, 255],

      extruded: true,

      //handle hover logic so that towers have arcs feeding into them be highlighted
      pickable: true,
      onHover: info => {
        const old_hovered_id = hovered_id
        hovered_id = (info.object ? [info.object.name] : [null]);
        hovered_type = "tower"
        if (hovered_id != old_hovered_id) {
          tower_layer = draw_towers()
          arc_layer = draw_arcs()

          const layers = [row_layer, col_layer, text_layer, tower_layer, arc_layer]
          DECK.setProps({layers})
        }
      },
      updateTriggers: {
        getFillColor: [hovered_id], // Only update when hovered_id changes
      }
    })
    return tower_layer
  }
  function draw_arcs(): ArcLayer<Connection> {
    // Create a lookup dictionary for quick access by cell name
    const cell_lookup: Record<string, Cell> = {};
    cells.forEach(cell => {
        cell_lookup[cell.name] = cell;
    });

    const connection_data: Connection[] = [];
    // Iterate over each cell in the input data
    cells.forEach(cell => {
        const from_cell = cell;

        // For each cell in the "used_by" array, create a new Connection object
        from_cell.used_by.forEach(to_cell_name => {
            const to_cell = cell_lookup[to_cell_name];
            if (to_cell) { // Only proceed if the target cell is found
                const width =Math.abs(from_cell.coord[0] - to_cell.coord[0]);
                const height =Math.abs(from_cell.coord[1] - to_cell.coord[1]);
                MAX_WIDTH = (width > MAX_WIDTH) ? width : MAX_WIDTH;
                MAX_HEIGHT = (height > MAX_HEIGHT) ? height : MAX_HEIGHT;
                const connection: Connection = {
                    from: {
                        name: from_cell.name,
                        weight: from_cell.weight,
                        coords: [from_cell.coord[0] + from_cell.width / 2, from_cell.coord[1] - from_cell.height / 2]
                    },
                    to: {
                        name: to_cell_name,
                        weight: to_cell.weight,
                        coords: [to_cell.coord[0] + to_cell.width / 2, to_cell.coord[1] - to_cell.height / 2]
                    }
                };
                connection_data.push(connection);
            }
        });
    });
    var connections_to_tower
    if (hovered_type == "tower") {
      connections_to_tower = findPathsToTarget(hovered_id[0])
    }
    arc_layer = new ArcLayer<Connection>({
      id: 'ArcLayer',
      data: connection_data,
      getSourcePosition: (d: Connection) => {
        return [d.from.coords[0], d.from.coords[1], START_ANIMATION ? d.from.weight * 10 : 0]
      },
      getTargetPosition: (d: Connection) => [d.to.coords[0], d.to.coords[1], START_ANIMATION ? d.to.weight * 10 : 0],
      transitions: {
        getSourcePosition: 3000,
        getTargetPosition: 3000
      },
      getSourceColor: (d: Connection) => {
        var opacity = 64 // 64 = 0.25 opacity, 255 = 1.0 opacity
        if (hovered_type == "arc") {
          if (d.from.name === hovered_id[0] && d.to.name === hovered_id[1]) {
            opacity = 255
          }      
        } else if (hovered_type == "tower") {
          if (connections_to_tower.some(path => path[0] === d.from.name && path[1] === d.to.name)) {
            opacity = 255
          }
        }
        return [48, 128, Math.sqrt(d.from.weight * 10) * 15, opacity]
      },
      getTargetColor: (d: Connection) => {
        var opacity = 64 // 64 = 0.25 opacity, 255 = 1.0 opacity
        if (hovered_type == "arc") {
          if (d.from.name === hovered_id[0] && d.to.name === hovered_id[1]) {
            opacity = 255
          }      
        } else if (hovered_type == "tower") {
          if (connections_to_tower.some(path => path[0] === d.from.name && path[1] === d.to.name)) {
            opacity = 255
          }
        }
        return [48, 128, Math.sqrt(d.to.weight * 10) * 15, opacity]
      },
      getWidth: 5,
      pickable: true,
      getHeight: (d: Connection) => {
        const dist = Math.sqrt(Math.pow(d.from.coords[0] - d.to.coords[0], 2) + (d.from.coords[1] - d.to.coords[1], 2));
        const max_dist = Math.sqrt(Math.pow(MAX_WIDTH, 2) + Math.pow(MAX_HEIGHT, 2));
        const normalized_dist =  1 - dist / max_dist;
        const min = 0.4
        const max = 3
        var result = min + normalized_dist * (max - min)
        return result
      },

      onHover: info => {
        const old_hovered_id = hovered_id
        hovered_id = (info.object ? [info.object.from.name, info.object.to.name] : [null]);
        hovered_type = "arc"

        if (hovered_id != old_hovered_id) {
          tower_layer = draw_towers()
          arc_layer = draw_arcs()

          const layers = [row_layer, col_layer, text_layer, tower_layer, arc_layer]
          DECK.setProps({layers})
        }
      },
      updateTriggers: {
        getSourceColor: [hovered_id], // Only update when hovered_id changes
        getTargetColor: [hovered_id]  // Only update when hovered_id changes
      },
      
    });
    return arc_layer
    type CellPath = [string, string];
    function findPathsToTarget(target: string): CellPath[] {
      // Helper function to recursively find paths to a specific target
      function findPaths(curr_target: string): CellPath[] {
          // Find all connections that lead to the current target
          const connections_to_target = connection_data.filter(c => c.to.name === curr_target);
  
          const paths: CellPath[] = [];
          
          for (const c of connections_to_target) {
              const source = c.from.name;
              const target = c.to.name;
  
              // Add the direct connection pair [source, target] to paths
              paths.push([source, target]);
  
              // Recursively find paths to the source
              const subPaths = findPaths(source);
              
              // For each subpath, add the current connection as the next step
              for (const subPath of subPaths) {
                  paths.push(subPath);
              }
          }
          
          return paths;
      }
      // Initialize by finding paths to the initial target
      return findPaths(target);
    }
  }
}





export function renderToDOM(container: HTMLDivElement) {
  createRoot(container).render(<App />);
}


